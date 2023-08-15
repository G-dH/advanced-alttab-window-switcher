/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * SwitcherList
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2023
 * @license    GPL-3.0
 */

'use strict';

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GObject from 'gi://GObject';

import * as SwitcherPopup from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import { AppIcon, WindowIcon, ShowAppsIcon } from './switcherItems.js';

// gettext
let _;


/* Item structure:
   Window: (WindowIcon)icon.window
                           .app
                           .titleLabel
                           ._is_window
                           ._icon
                           ._id
                           ._closeButton


   App:    (AppIcon)icon.app
                        .titleLabel
                        .cachedWindows
                        ._appDetails
                        ._is_app
                        .icon
                        ._id

*/

export function init(extension) {
    _ = extension.gettext.bind(extension);
}

export function cleanGlobal() {
    _ = null;
}

export const SwitcherList = GObject.registerClass(
class SwitcherList extends SwitcherPopup.SwitcherList {
    _init(items, options, switcherParams) {
        super._init(false); // squareItems = false
        this._options = options;
        this._switcherParams = switcherParams;

        this._statusLabel = new St.Label({
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'status-label',
        });

        this.add_child(this._statusLabel);
        if (!this._options.STATUS)
            this._statusLabel.hide();


        this.icons = [];

        let showAppsIcon;
        if (this._switcherParams.showingApps && (this._options.INCLUDE_SHOW_APPS_ICON || this._switcherParams.mouseControl)) {
            showAppsIcon = this._getShowAppsIcon();
            if (this._switcherParams.reverseOrder) {
                this.addItem(showAppsIcon, showAppsIcon.titleLabel);
                this.icons.push(showAppsIcon);
            }
            this._showAppsIcon = showAppsIcon;
        }

        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let icon;
            if (item.get_title) {
                icon = new WindowIcon(item, i, this._switcherParams, this._options);
                /* if (switcherParams.mouseControl && item === global.display.get_tab_list(0, null)[0]) {
                    icon._is_focused = true;
                }*/
            } else {
                icon = new AppIcon(item, i, this._switcherParams, this._options);
                /* if (switcherParams.mouseControl && item.cachedWindows.length && (item.cachedWindows[0] === global.display.get_tab_list(0, null)[0])) {
                    icon._is_focused = true;
                }*/
                icon.connect('menu-state-changed',
                    (o, open) => {
                        this._options.cancelTimeout = open;
                    }
                );
            }

            this.icons.push(icon);

            /* if (icon._is_focused) {
                this._items[this._items.length - 1].add_style_class_name(this._options.colorStyle.FOCUSED);
            }*/

            // compensate item height added by "running dot (line)" indicator
            const listItem = this.addItem(icon, icon.titleLabel);
            if (icon._is_app && (this._switcherParams.includeFavorites || this._switcherParams.searchActive)) {
                const margin = 1;
                listItem.set_style(`padding-bottom: ${margin}px;`);
            }

            // the icon could be an app, not only a window
            if (icon._is_window) {
                icon._unmanagedSignalId = icon.window.connect('unmanaged', this._removeWindow.bind(this));
            } else if (icon._is_app) {
                if (icon.app.cachedWindows.length > 0) {
                    icon.app.cachedWindows.forEach(w => {
                        w._unmanagedSignalId = w.connect('unmanaged', this._removeWindow.bind(this));
                    });
                }
            }
        }

        if (showAppsIcon && !this._switcherParams.reverseOrder) {
            this.addItem(showAppsIcon, showAppsIcon.titleLabel);
            this.icons.push(showAppsIcon);
        }

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _getShowAppsIcon() {
        const showAppsIcon = new ShowAppsIcon({
            iconSize: this._options.APP_MODE_ICON_SIZE,
            showLabel: this._options.SHOW_APP_TITLES,
            style: this._options.colorStyle.TITLE_LABEL,
        });

        return showAppsIcon;
    }

    _onDestroy() {
        this.icons.forEach(icon => {
            if (icon._unmanagedSignalId) {
                icon.window.disconnect(icon._unmanagedSignalId);
            } else if (icon.app) {
                icon.app.cachedWindows.forEach(w => {
                    if (w._unmanagedSignalId)
                        w.disconnect(w._unmanagedSignalId);
                });
            }
        });
    }

    vfunc_get_preferred_height(forWidth) {
        let [minHeight, natHeight] = super.vfunc_get_preferred_height(forWidth);

        let spacing = this.get_theme_node().get_padding(St.Side.BOTTOM);
        let [labelMin, labelNat] = this._statusLabel.get_preferred_height(-1);

        let multiplier = 0;
        multiplier += this._options.STATUS ? 1 : 0;
        minHeight += multiplier * labelMin + spacing;
        natHeight += multiplier * labelNat + spacing;

        return [minHeight, natHeight];
    }

    vfunc_allocate(box, flags) {
        // no flags in GS 40+
        const useFlags = flags !== undefined;
        let themeNode = this.get_theme_node();
        let contentBox = themeNode.get_content_box(box);
        const spacing = themeNode.get_padding(St.Side.BOTTOM);
        const statusLabelHeight = this._options.STATUS ? this._statusLabel.height : spacing;
        const totalLabelHeight =
            statusLabelHeight;

        box.y2 -= totalLabelHeight;
        if (useFlags)
            super.vfunc_allocate(box, flags);
        else
            super.vfunc_allocate(box);

        // Hooking up the parent vfunc will call this.set_allocation() with
        // the height without the label height, so call it again with the
        // correct size here.
        box.y2 += totalLabelHeight;

        if (useFlags)
            this.set_allocation(box, flags);
        else
            this.set_allocation(box);

        const childBox = new Clutter.ActorBox();
        childBox.x1 = contentBox.x1 + 5;
        childBox.x2 = contentBox.x2;
        childBox.y2 = contentBox.y2;
        childBox.y1 = childBox.y2 - statusLabelHeight;
        if (useFlags)
            this._statusLabel.allocate(childBox, flags);
        else
            this._statusLabel.allocate(childBox);
    }

    _onItemMotion(item) {
        // Avoid reentrancy
        const icon = this.icons[this._items.indexOf(item)];
        if (item !== this._items[this._highlighted] || (this._options.INTERACTIVE_INDICATORS && !icon._mouseControlsSet)) {
            this._itemEntered(this._items.indexOf(item));
        }

        return Clutter.EVENT_PROPAGATE;
    }

    _onItemEnter(item) {
        // Avoid reentrance
        // if (item !== this._items[this._highlighted])
        this._itemEntered(this._items.indexOf(item));

        return Clutter.EVENT_PROPAGATE;
    }

    highlight(index) {
        if (this._items[this._highlighted]) {
            this._items[this._highlighted].remove_style_pseudo_class('selected');
            if (this._options.colorStyle.STYLE)
                this._items[this._highlighted].remove_style_class_name(this._options.colorStyle.SELECTED);
            /* if (this.icons[this._highlighted]._is_focused)
                this._items[this._highlighted].add_style_class_name(this._options.colorStyle.FOCUSED);*/
        }

        if (this._items[index]) {
            this._items[index].add_style_pseudo_class('selected');
            if (this._options.colorStyle.STYLE) {
                // this._items[index].remove_style_class_name(this._options.colorStyle.FOCUSED);
                this._items[index].add_style_class_name(this._options.colorStyle.SELECTED);
            }
        }

        this._highlighted = index;

        let adjustment = this._scrollView.hscroll.adjustment;
        let [value] = adjustment.get_values();
        let [absItemX] = this._items[index].get_transformed_position();
        let [, posX] = this.transform_stage_point(absItemX, 0);
        let [containerWidth] = this.get_transformed_size();
        if (posX + this._items[index].get_width() > containerWidth)
            this._scrollToRight(index);
        else if (this._items[index].allocation.x1 - value < 0)
            this._scrollToLeft(index);
    }

    _removeWindow(window) {
        if (this.icons[0].window) {
            let index = this.icons.findIndex(icon => {
                return icon.window === window;
            });
            if (index === -1)
                return;

            this.icons.splice(index, 1);
            this.removeItem(index);
        } else {
            this.emit('item-removed', -1);
        }
    }
});

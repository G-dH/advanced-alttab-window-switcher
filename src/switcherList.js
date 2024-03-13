/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * SwitcherList
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GObject from 'gi://GObject';

import * as SwitcherPopup from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import { AppIcon, WindowIcon, SysActionIcon, ShowAppsIcon } from './switcherItems.js';

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

export function init(me) {
    _ = me._;
}

export function cleanGlobal() {
    _ = null;
}

export const SwitcherList = GObject.registerClass({
    GTypeName: `SwitcherList${Math.floor(Math.random() * 1000)}`,
}, class SwitcherList extends SwitcherPopup.SwitcherList {
    _init(items, opt, switcherParams) {
        super._init(false); // squareItems = false
        this.opt = opt;
        this._switcherParams = switcherParams;

        this._statusLabel = new St.Label({
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'status-label',
        });

        this.add_child(this._statusLabel);
        if (!this.opt.STATUS)
            this._statusLabel.hide();


        this.icons = [];

        let showAppsIcon;
        let showAppsItemBox;
        if (this._switcherParams.showingApps && (this.opt.INCLUDE_SHOW_APPS_ICON || this._switcherParams.mouseControl)) {
            showAppsIcon = this._getShowAppsIcon();
            if (this._switcherParams.reverseOrder) {
                showAppsItemBox = this.addItem(showAppsIcon, showAppsIcon.titleLabel);
                this.icons.push(showAppsIcon);
            }
            this._showAppsIcon = showAppsIcon;
        }

        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let icon;
            if (item.get_title) {
                icon = new WindowIcon(item, i, this._switcherParams, this.opt);
            } else if (item.get_app_info) {
                icon = new AppIcon(item, i, this._switcherParams, this.opt);
                icon.connect('menu-state-changed',
                    (o, open) => {
                        this.opt.cancelTimeout = open;
                    }
                );
            } else {
                icon = new SysActionIcon(item, i, this._switcherParams, this.opt);
            }

            this.icons.push(icon);

            // compensate item height added by "running dot (line)" indicator
            const listItem = this.addItem(icon, icon.titleLabel);
            // In GS 46 the item bg become solid color and highlighting is made by altering the base color
            if (!this.opt.COLOR_STYLE_DEFAULT)
                listItem.add_style_class_name('item-box-custom');
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
            showAppsItemBox = this.addItem(showAppsIcon, showAppsIcon.titleLabel);
            this.icons.push(showAppsIcon);
        }

        if (!this.opt.COLOR_STYLE_DEFAULT && showAppsItemBox)
            showAppsItemBox.add_style_class_name('item-box-custom');

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _getShowAppsIcon() {
        const showAppsIcon = new ShowAppsIcon({
            iconSize: this.opt.APP_MODE_ICON_SIZE,
            showLabel: this.opt.SHOW_APP_TITLES,
            style: this.opt.colorStyle.TITLE_LABEL,
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
        multiplier += this.opt.STATUS ? 1 : 0;
        minHeight += multiplier * labelMin + spacing;
        natHeight += multiplier * labelNat + spacing;

        return [minHeight, natHeight];
    }

    vfunc_allocate(box) {
        let themeNode = this.get_theme_node();
        let contentBox = themeNode.get_content_box(box);
        const spacing = themeNode.get_padding(St.Side.BOTTOM);
        const statusLabelHeight = this.opt.STATUS ? this._statusLabel.height : spacing;
        const totalLabelHeight = statusLabelHeight;

        box.y2 -= totalLabelHeight;
        super.vfunc_allocate(box);

        // Hooking up the parent vfunc will call this.set_allocation() with
        // the height without the label height, so call it again with the
        // correct size here.
        box.y2 += totalLabelHeight;


        this.set_allocation(box);

        const childBox = new Clutter.ActorBox();
        childBox.x1 = contentBox.x1 + 5;
        childBox.x2 = contentBox.x2;
        childBox.y2 = contentBox.y2;
        childBox.y1 = childBox.y2 - statusLabelHeight;
        this._statusLabel.allocate(childBox);
    }

    _onItemMotion(item) {
        // Avoid reentrancy
        const icon = this.icons[this._items.indexOf(item)];
        if (item !== this._items[this._highlighted] || (this.opt.INTERACTIVE_INDICATORS && !icon._mouseControlsSet)) {
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
            if (this.opt.colorStyle.STYLE)
                this._items[this._highlighted].remove_style_class_name(this.opt.colorStyle.SELECTED);
        }

        if (this._items[index]) {
            this._items[index].add_style_pseudo_class('selected');
            if (this.opt.colorStyle.STYLE) {
                // this._items[index].remove_style_class_name(this.opt.colorStyle.FOCUSED);
                this._items[index].add_style_class_name(this.opt.colorStyle.SELECTED);
            }
        }

        this._highlighted = index;

        let adjustment = this._scrollView.get_hscroll_bar().adjustment;
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

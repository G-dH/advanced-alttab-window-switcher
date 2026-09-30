/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * SwitcherList
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2025
 * @license    GPL-3.0
 */

'use strict';

import Clutter from 'gi://Clutter';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Meta from 'gi://Meta';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as SwitcherPopup from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import { AppIcon, WindowIcon, SysActionIcon, ShowAppsIcon } from './switcherItems.js';

// gettext
let _;

// same as in the stock SwitcherList
const POPUP_SCROLL_TIME = 100; // milliseconds


/* Item structure:
   Window: (WindowIcon)icon.window
                           .app
                           .titleLabel
                           ._isWindow
                           ._icon
                           ._id
                           ._closeButton


   App:    (AppIcon)icon.app
                        .titleLabel
                        .cachedWindows
                        ._appDetails
                        ._isApp
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
    _init(items, opt, wsp) {
        super._init(false); // squareItems = false
        this._opt = opt;
        this._vertical = opt.VERTICAL_LIST;
        if (this._vertical)
            this._setVerticalOrientation();
        this._switcherParams = this._getSwitcherParams(opt, wsp);
        this._wsp = wsp;

        this._addStatusLabel();

        this.icons = [];

        let showAppsIcon;
        let showAppsItemBox;
        const dashMode = this._switcherParams.dashMode;
        if (!items[0].get_title && (!dashMode && this._opt.INCLUDE_SHOW_APPS_ICON || (dashMode && opt.DASH_APP_INCLUDE_APPS_ICON))) {
            showAppsIcon = this._getShowAppsIcon();
            if (this._switcherParams.reverseOrder) {
                showAppsItemBox = this.addItem(showAppsIcon, showAppsIcon.titleLabel);
                this.icons.push(showAppsIcon);
            }
        }

        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let icon;
            if (item.get_title) {
                icon = new WindowIcon(item, i, this._switcherParams, this._opt);
            } else if (item.get_app_info) {
                icon = new AppIcon(item, i, this._switcherParams, this._opt);
                icon.connect('menu-state-changed',
                    (o, open) => {
                        this._opt.cancelTimeout = open;
                    }
                );
            } else {
                icon = new SysActionIcon(item, i, this._switcherParams, this._opt);
            }

            this.icons.push(icon);

            // compensate item height added by "running dot (line)" indicator
            const listItem = this.addItem(icon, icon.titleLabel);
            // In GS 46 the item bg become solid color and highlighting is made by altering the base color
            if (!this._opt.COLOR_STYLE_DEFAULT)
                listItem.add_style_class_name('item-box-custom');
            if (icon._isApp && (this._switcherParams.includeFavorites || this._switcherParams.searchActive)) {
                const margin = 1;
                listItem.set_style(`padding-bottom: ${margin}px;`);
            }

            // the icon could be an app, not only a window
            if (icon._isWindow) {
                icon.window.connectObject('unmanaged', this._removeWindow.bind(this), this);
            } else if (icon._isApp) {
                if (icon.app.cachedWindows.length > 0) {
                    icon.app.cachedWindows.forEach(w => {
                        w.connectObject('unmanaged', this._removeWindow.bind(this), this);
                    });
                }
            }
        }

        if (showAppsIcon && !this._switcherParams.reverseOrder) {
            showAppsItemBox = this.addItem(showAppsIcon, showAppsIcon.titleLabel);
            this.icons.push(showAppsIcon);
        }

        if (!this._opt.COLOR_STYLE_DEFAULT && showAppsItemBox)
            showAppsItemBox.add_style_class_name('item-box-custom');

        this.connect('destroy', this._onDestroy.bind(this));
    }

    // Stock SwitcherList is horizontal only. The scroll view, the arrows
    // and the items keep their names, but for the vertical list
    // _leftArrow/_scrollableLeft mean "up" and _rightArrow/_scrollableRight mean "down".
    _setVerticalOrientation() {
        this._list.orientation = Clutter.Orientation.VERTICAL;
        this._scrollView.style_class = 'vfade';

        this._leftArrow.destroy();
        this._rightArrow.destroy();
        this._leftArrow = this._createArrow(St.Side.TOP);
        this._rightArrow = this._createArrow(St.Side.BOTTOM);
    }

    _createArrow(side) {
        const arrow = new St.DrawingArea({
            style_class: 'switcher-arrow',
            pseudo_class: 'highlighted',
        });
        arrow.connect('repaint', () => SwitcherPopup.drawArrow(arrow, side));
        this.add_child(arrow);
        return arrow;
    }

    _addStatusLabel() {
        if (!this._opt.STATUS)
            return;

        this._statusLabel = new St.Label({
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'status-label',
        });

        this.add_child(this._statusLabel);
    }

    _getSwitcherParams(opt, wsp) {
        let showWinTitles = opt.WINDOW_TITLES === 1 || (opt.WINDOW_TITLES === 3 && wsp._singleApp);
        return {
            dashMode: wsp._dashMode,
            mouseControl: !wsp._keyboardTriggered,
            showingApps: wsp._showingApps,
            showItemTitle: wsp._showingApps ? opt.SHOW_APP_TITLES : showWinTitles,
            showWinTitles,
            winPrevSize: wsp._singleApp ? opt.SINGLE_APP_PREVIEW_SIZE : opt.WINDOW_PREVIEW_SIZE,
            hotKeys: opt.HOT_KEYS && wsp._keyboardTriggered,
            singleApp: wsp._singleApp,
            addAppDetails: !!wsp._searchQuery,
            includeFavorites: wsp._includeFavorites,
            searchActive: !!wsp._searchQuery,
            reverseOrder: wsp._shouldReverse(),
        };
    }

    _getShowAppsIcon() {
        const showAppsIcon = new ShowAppsIcon({
            iconSize: this._opt.APP_MODE_ICON_SIZE,
            showLabel: this._opt.SHOW_APP_TITLES,
            style: this._opt.colorStyle.TITLE_LABEL,
        });

        showAppsIcon.connect('button-press-event', (a, event) => {
            const btn = event.get_button();
            if (btn === Clutter.BUTTON_SECONDARY) {
                Main.overview.toggle();
                return Clutter.EVENT_STOP;
            } else if (btn === Clutter.BUTTON_MIDDLE) {
                this._wsp._openPrefsWindow();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });

        return showAppsIcon;
    }

    _onDestroy() {
        this.icons.forEach(icon => {
            if (icon.app?.cachedWindows) {
                icon.app.cachedWindows.forEach(w => {
                    w.disconnectObject(this);
                });
            } else {
                icon.window?.disconnectObject(this);
            }
        });
    }

    vfunc_get_preferred_height() {
        let maxChildMin = 0;
        let maxChildNat = 0;

        for (let i = 0; i < this._items.length; i++) {
            let [childMin, childNat] = this._items[i].get_preferred_height(-1);
            maxChildMin = Math.max(childMin, maxChildMin);
            maxChildNat = Math.max(childNat, maxChildNat);
        }

        if (this._squareItems) {
            let [childMin] = this._maxChildWidth(-1);
            maxChildMin = Math.max(childMin, maxChildMin);
            maxChildNat = maxChildMin;
        }

        let multiplier = 1;
        if (this._vertical) {
            // the natural height is the sum of the items, the minimal one allows the list to scroll
            multiplier = this._items.length;
            maxChildNat = this._items.reduce((sum, item) => sum + item.get_preferred_height(-1)[1], 0);
        }
        let spacing = this._list.get_theme_node().get_length('spacing') * (multiplier - 1);
        maxChildMin += this._vertical ? 0 : spacing;
        maxChildNat += spacing;

        let themeNode = this.get_theme_node();
        let [minHeight, natHeight] = themeNode.adjust_preferred_height(maxChildMin, maxChildNat);

        spacing = this.get_theme_node().get_padding(St.Side.BOTTOM);
        let labelMin, labelNat;
        if (this._statusLabel)
            [labelMin, labelNat] = this._statusLabel.get_preferred_height(-1);
        else
            [labelMin, labelNat] = [0, 0];

        multiplier = 0;
        multiplier += this._opt.STATUS ? 1 : 0;
        minHeight += multiplier * labelMin + spacing;
        natHeight += multiplier * labelNat + spacing;

        return [minHeight, natHeight];
    }

    vfunc_allocate(box) {
        let themeNode = this.get_theme_node();
        let contentBox = themeNode.get_content_box(box);
        const spacing = themeNode.get_padding(St.Side.BOTTOM);
        const statusLabelHeight = this._statusLabel ? this._statusLabel.height : spacing;
        const totalLabelHeight = statusLabelHeight;

        box.y2 -= totalLabelHeight;
        super.vfunc_allocate(box);

        // Hooking up the parent vfunc will call this.set_allocation() with
        // the height without the label height, so call it again with the
        // correct size here.
        box.y2 += totalLabelHeight;


        this.set_allocation(box);

        if (this._vertical)
            this._allocateVerticalArrows(contentBox);

        if (this._statusLabel) {
            const childBox = new Clutter.ActorBox();
            childBox.x1 = contentBox.x1 + 5;
            childBox.x2 = contentBox.x2;
            childBox.y2 = contentBox.y2;
            childBox.y1 = childBox.y2 - statusLabelHeight;
            this._statusLabel.allocate(childBox);
        }
    }

    _allocateVerticalArrows(contentBox) {
        const themeNode = this.get_theme_node();
        const [, listHeight] = this._list.get_preferred_height(-1);
        const scrollable = listHeight > contentBox.y2 - contentBox.y1 - this._getStatusLabelHeight();
        const childBox = new Clutter.ActorBox();

        let arrowHeight = Math.floor(themeNode.get_padding(St.Side.TOP) / 3);
        let arrowWidth = arrowHeight * 2;
        childBox.x1 = this.width / 2 - arrowHeight;
        childBox.y1 = themeNode.get_padding(St.Side.TOP) / 2;
        childBox.x2 = childBox.x1 + arrowWidth;
        childBox.y2 = childBox.y1 + arrowHeight;
        this._leftArrow.allocate(childBox);
        this._leftArrow.opacity = this._scrollableLeft && scrollable ? 255 : 0;

        arrowHeight = Math.floor(themeNode.get_padding(St.Side.BOTTOM) / 3);
        arrowWidth = arrowHeight * 2;
        childBox.x1 = this.width / 2 - arrowHeight;
        childBox.y2 = this.height - this._getStatusLabelHeight() - themeNode.get_padding(St.Side.BOTTOM) / 2;
        childBox.y1 = childBox.y2 - arrowHeight;
        childBox.x2 = childBox.x1 + arrowWidth;
        this._rightArrow.allocate(childBox);
        this._rightArrow.opacity = this._scrollableRight && scrollable ? 255 : 0;
    }

    _getStatusLabelHeight() {
        return this._statusLabel ? this._statusLabel.height : 0;
    }

    _onItemMotion(item) {
        // Avoid reentrancy
        const icon = this.icons[this._items.indexOf(item)];
        if (item !== this._items[this._highlighted] || (this._opt.INTERACTIVE_INDICATORS && !icon._mouseControlsSet))
            this._itemEntered(this._items.indexOf(item));

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
            if (this._opt.colorStyle.STYLE)
                this._items[this._highlighted].remove_style_class_name(this._opt.colorStyle.SELECTED);
        }

        if (this._items[index]) {
            this._items[index].add_style_pseudo_class('selected');
            if (this._opt.colorStyle.STYLE) {
                // this._items[index].remove_style_class_name(this._opt.colorStyle.FOCUSED);
                this._items[index].add_style_class_name(this._opt.colorStyle.SELECTED);
            }
        }

        this._highlighted = index;

        if (this._vertical) {
            this._scrollToItemVertical(index);
            return;
        }

        let adjustment = this._scrollView.get_hadjustment
            ? this._scrollView.get_hadjustment()
            : this._scrollView.get_hscroll_bar().adjustment;
        let [value] = adjustment.get_values();
        let [absItemX] = this._items[index].get_transformed_position();
        let [, posX] = this.transform_stage_point(absItemX, 0);
        let [containerWidth] = this.get_transformed_size();
        if (posX + this._items[index].get_width() > containerWidth)
            this._scrollToRight(index);
        else if (this._items[index].allocation.x1 - value < 0)
            this._scrollToLeft(index);
    }

    _scrollToItemVertical(index) {
        const adjustment = this._scrollView.vadjustment;
        const [value, , , , , pageSize] = adjustment.get_values();
        const item = this._items[index];

        // the list is not allocated yet
        if (!item || pageSize <= 0)
            return;

        if (item.allocation.y1 < value)
            this._scrollToLeft(index);
        else if (item.allocation.y2 > value + pageSize)
            this._scrollToRight(index);
    }

    _scrollVertical(index, up) {
        const adjustment = this._scrollView.vadjustment;
        let [value, , upper, , , pageSize] = adjustment.get_values();
        const item = this._items[index];

        if (item.allocation.y1 < value)
            value = Math.max(0, item.allocation.y1);
        else if (item.allocation.y2 > value + pageSize)
            value = Math.min(upper, item.allocation.y2 - pageSize);

        if (up)
            this._scrollableRight = true;
        else
            this._scrollableLeft = true;

        adjustment.ease(value, {
            progress_mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            duration: POPUP_SCROLL_TIME,
            onComplete: () => {
                if (up && index === 0)
                    this._scrollableLeft = false;
                else if (!up && index === this._items.length - 1)
                    this._scrollableRight = false;
                this.queue_relayout();
            },
        });
    }

    // "left" and "right" are the names of the stock (horizontal) methods, in the vertical list they scroll up and down
    _scrollToLeft(index) {
        if (this._vertical)
            this._scrollVertical(index, true);
        else
            super._scrollToLeft(index);
    }

    _scrollToRight(index) {
        if (this._vertical)
            this._scrollVertical(index, false);
        else
            super._scrollToRight(index);
    }

    _removeWindow(window) {
        if (this.icons[0].window) {
            let index = this.icons.findIndex(icon =>
                icon.window === window
            );
            if (index === -1)
                return;

            this.icons.splice(index, 1);
            this.removeItem(index);
        } else {
            this.emit('item-removed', -1);
        }
    }

    // //////////////////////////////////////////////////////////

    _updateMouseControls(selectedIndex) {
        if (!this._wsp.mouseActive || !this._wsp._timeoutIds) // timeoutIds are missing if the popup belongs to the Tiling assistant
            return;

        // activate indicators only when mouse pointer is (probably) used to control the switcher
        if (this._updateNeeded) {
            this.icons.forEach(w => {
                if (w._closeButton)
                    w._closeButton.opacity = 0;

                if (w._aboveStickyIndicatorBox)
                    w._aboveStickyIndicatorBox.opacity = 0;

                if (w._hotkeyIndicator)
                    w._hotkeyIndicator.opacity = 255;
            });
        }

        if (selectedIndex === undefined)
            return;

        const item = this.icons[selectedIndex];
        if (!item)
            return;

        // workaround - only the second call of _isPointerOut() returns correct answer
        // this._wsp._isPointerOut();
        if (item.window /* && !this._wsp._isPointerOut() */) {
            if (!item._closeButton) {
                item._createCloseButton(item.window);
                this._updateNeeded = true;
                item._closeButton.connect('enter-event', () => {
                    item._closeButton.add_style_class_name('window-close-hover');
                });
                item._closeButton.connect('leave-event', () => {
                    item._closeButton.remove_style_class_name('window-close-hover');
                });
            }
            item._closeButton.opacity = 255;
        }

        if (!this._opt.INTERACTIVE_INDICATORS/* || this._wsp._isPointerOut()*/)
            return;

        if (item.window && !item._aboveStickyIndicatorBox) {
            item._aboveStickyIndicatorBox = item._getIndicatorBox();
            item._icon.add_child(item._aboveStickyIndicatorBox);
        }

        if (item._aboveStickyIndicatorBox) {
            item._aboveStickyIndicatorBox.opacity = 255;
            if  (item._hotkeyIndicator)
                item._hotkeyIndicator.opacity = 0;
        }

        if (item._aboveIcon && !item._aboveIcon.reactive) {
            item._aboveIcon.reactive = true;
            item._aboveIcon.opacity = 255;
            const canAbove =
                !((item.window.get_maximized && item.window.get_maximized() === Meta.MaximizeFlags.BOTH) || // GNOME <= 48
                (item.window.is_maximized && item.window.is_maximized())); // Since GNOME 49

            item._aboveIcon.connect('button-press-event', () => {
                if (canAbove)
                    this._wsp._toggleWinAbove();
                return Clutter.EVENT_STOP;
            });

            if (canAbove) {
                item._aboveIcon.connect('enter-event', () => {
                    item._aboveIcon.add_style_class_name('window-state-indicators-hover');
                });
                item._aboveIcon.connect('leave-event', () => {
                    item._aboveIcon.remove_style_class_name('window-state-indicators-hover');
                });
            }
        }

        if (item._stickyIcon && !item._stickyIcon.reactive) {
            item._stickyIcon.reactive = true;
            item._stickyIcon.opacity = 255;
            item._stickyIcon.connect('button-press-event', () => {
                this._wsp._toggleWinSticky();
                return Clutter.EVENT_STOP;
            });
            item._stickyIcon.connect('enter-event', () => {
                item._stickyIcon.add_style_class_name('window-state-indicators-hover');
            });
            item._stickyIcon.connect('leave-event', () => {
                item._stickyIcon.remove_style_class_name('window-state-indicators-hover');
            });
        }

        if (item.window && !item._menuIcon) {
            item._menuIcon = new St.Icon({
                style_class: 'window-state-indicators',
                icon_name: 'view-more-symbolic',
                icon_size: 14,
                y_expand: true,
                y_align: Clutter.ActorAlign.START,
            });
            item._menuIcon.add_style_class_name(this._opt.colorStyle.INDICATOR_OVERLAY);
            item._aboveStickyIndicatorBox.add_child(item._menuIcon);
            item._menuIcon.reactive = true;
            item._menuIcon.opacity = 255;
            item._menuIcon.connect('button-press-event', () => {
                this._wsp._openWindowMenu();
                return Clutter.EVENT_STOP;
            });
            item._menuIcon.connect('enter-event', () => {
                item._menuIcon.add_style_class_name('window-state-indicators-hover');
            });
            item._menuIcon.connect('leave-event', () => {
                item._menuIcon.remove_style_class_name('window-state-indicators-hover');
            });
        }

        if (item._appIcon && !item._appIcon.reactive) {
            item._appIcon.reactive = true;
            item._appIcon.connect('button-press-event', (actor, event) => {
                const button = event.get_button();
                if (button === Clutter.BUTTON_PRIMARY) {
                    this._wsp._toggleSingleAppMode();
                    return Clutter.EVENT_STOP;
                } else if (button === Clutter.BUTTON_MIDDLE) {
                    this._wsp._openNewWindow();
                    return Clutter.EVENT_STOP;
                } else if (button === Clutter.BUTTON_SECONDARY) {
                    this._wsp._toggleSwitcherMode();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            item._appIcon.connect('enter-event', () => {
                item._appIcon.add_style_class_name(this._opt.colorStyle.INDICATOR_OVERLAY_HOVER);
            });
            item._appIcon.connect('leave-event', () => {
                item._appIcon.remove_style_class_name(this._opt.colorStyle.INDICATOR_OVERLAY_HOVER);
            });
        }

        if (item._wsIndicator && !item._wsIndicator.reactive) {
            const cws = global.workspaceManager.get_active_workspace();
            const ws = item.window.get_workspace();

            item._wsIndicator.reactive = true;
            item._wsIndicator.connect('button-press-event', (actor, event) => {
                const button = event.get_button();
                if (button === Clutter.BUTTON_PRIMARY) {
                    if (this._wsp._getSelectedTarget().get_workspace().index() !== global.workspaceManager.get_active_workspace_index())
                        this._wsp._actions.moveToCurrentWS();
                    return Clutter.EVENT_STOP;
                } else if (button === Clutter.BUTTON_MIDDLE) {
                    return Clutter.EVENT_PROPAGATE;
                } else if (button === Clutter.BUTTON_SECONDARY) {
                    if (ws === cws)
                        Main.overview.toggle();
                    else
                        Main.wm.actionMoveWorkspace(ws);

                    /* this._wsp._filterSwitched = true;
                    this._wsp._winFilterMode = FilterMode.WORKSPACE;
                    this._wsp._updateSwitcher();*/
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            if (ws === cws)
                return;

            item._wsIndicator.connect('enter-event', () => {
                const ws = global.workspaceManager.get_active_workspace_index() + 1;
                const winWs = item.window.get_workspace().index() + 1;
                const monitor = item.window.get_monitor();
                const currentMonitor = global.display.get_current_monitor();
                const multiMonitor = global.display.get_n_monitors() - 1;
                item._wsIndicator.text = `${winWs}${multiMonitor ? `.${monitor.toString()}` : ''} → ${ws}${multiMonitor ? `.${currentMonitor.toString()}` : ''}`;
                // item._wsIndicator.add_style_class_name('ws-indicator-hover');
            });
            item._wsIndicator.connect('leave-event', () => {
                // item._wsIndicator.remove_style_class_name('ws-indicator-hover');
                item._wsIndicator.text = (item.window.get_workspace().index() + 1).toString();
            });
        }

        if (item._winCounterIndicator && !item._winCounterIndicator.reactive) {
            item._winCounterIndicator.reactive = true;
            item._winCounterIndicator.connect('button-press-event', (actor, event) => {
                const button = event.get_button();
                if (button === Clutter.BUTTON_PRIMARY) {
                    this._wsp._toggleSingleAppMode();
                    return Clutter.EVENT_STOP;
                } else if (button === Clutter.BUTTON_MIDDLE) {
                    return Clutter.EVENT_PROPAGATE;
                } else if (button === Clutter.BUTTON_SECONDARY) {
                    // inactive
                }
                return Clutter.EVENT_PROPAGATE;
            });

            item._winCounterIndicator.connect('enter-event', () => {
                item._winCounterIndicator.add_style_class_name(this._opt.colorStyle.RUNNING_COUNTER_HOVER);
            });
            item._winCounterIndicator.connect('leave-event', () => {
                item._winCounterIndicator.remove_style_class_name(this._opt.colorStyle.RUNNING_COUNTER_HOVER);
            });
        }

        item._mouseControlsSet = true;
        this._wsp._mouseHoveringItemIndex = selectedIndex;
    }
});

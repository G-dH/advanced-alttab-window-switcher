/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * SwitcherItems
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2023
 * @license    GPL-3.0
 */

'use strict';

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Shell from 'gi://Shell';
import GObject from 'gi://GObject';

import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as IconGrid from 'resource:///org/gnome/shell/ui/iconGrid.js';
import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';

// gettext
let _;

const LABEL_FONT_SIZE = 0.9;

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

export function init(extension) {
    _ = extension.gettext.bind(extension);
}

export function cleanGlobal() {
    _ = null;
}

function _createWindowClone(window, size) {
    let [width, height] = window.get_size();
    let scale = Math.min(1.0, size / width, size / height);
    return new Clutter.Clone({
        source: window,
        width: width * scale,
        height: height * scale,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
        // usual hack for the usual bug in ClutterBinLayout...
        x_expand: true,
        y_expand: true,
    });
}

export const WindowIcon = GObject.registerClass(
class WindowIcon extends St.BoxLayout {
    _init(item, iconIndex, switcherParams, options) {
        const metaWin = item;
        super._init({
            style_class: 'thumbnail-box',
            vertical: true,
            reactive: true,
        });
        this._options = options;
        this._switcherParams = switcherParams;
        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });
        this._id = metaWin.get_id();

        this.add_child(this._icon);
        this._icon.destroy_all_children();

        this._createWindowIcon(metaWin);

        if (this._switcherParams.hotKeys && iconIndex < 12) {
            this._hotkeyIndicator = _createHotKeyNumIcon(iconIndex, options.colorStyle.INDICATOR_OVERLAY);
            this._icon.add_child(this._hotkeyIndicator);
        }

        if (this.titleLabel && this._switcherParams.showWinTitles)
            this.add_child(this.titleLabel);
    }

    _createCloseButton(metaWin) {
        const closeButton = new St.Icon({
            style_class: 'window-close-aatws',
            icon_name: 'window-close-symbolic',
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.START,
            x_expand: true,
            y_expand: true,
            reactive: true,
        });
        closeButton.connect('button-press-event', () => {
            return Clutter.EVENT_STOP;
        });
        closeButton.connect('button-release-event', () => {
            metaWin.delete(global.get_current_time());
            return Clutter.EVENT_STOP;
        });

        this._closeButton = closeButton;
        this._closeButton.opacity = 0;
        this._icon.add_child(this._closeButton);
    }

    _createWindowIcon(window) {
        this._is_window = true;
        this.window = window;

        let title = window.get_title();
        if (this._switcherParams.showItemTitle) {
            // move workspace/folder name to the front, so it will be visible if label is ellipsized
            if (title.includes(' - VSCodium')) {
                const split = title.split(' - ');
                if (split.length === 3)
                    title = `${split[1]} - ${split[0]} - ${split[2]}`;
            }
        }

        this.titleLabel = new St.Label({
            text: title,
            style_class: this._options.colorStyle.TITLE_LABEL,
            x_align: Clutter.ActorAlign.CENTER,
        });

        let tracker = Shell.WindowTracker.get_default();
        this.app = tracker.get_window_app(window);

        let mutterWindow = this.window.get_compositor_private();
        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        let switched = false;
        let size, cloneSize;

        size = this._switcherParams.winPrevSize;
        cloneSize = size;

        if (!this._switcherParams.singleAppMode && this._options.APP_ICON_SIZE > size) {
            size = this._options.APP_ICON_SIZE;
            switched = true;
            cloneSize = Math.floor((mutterWindow.width / mutterWindow.height) * this._switcherParams.winPrevSize);
        }

        let clone = _createWindowClone(mutterWindow, cloneSize * scaleFactor);
        let icon;

        if (this.app) {
            icon = this._createAppIcon(this.app,
                this._options.APP_ICON_SIZE);
            this._appIcon = icon;
            this._appIcon.reactive = false;
        }

        let base, front;
        if (switched) {
            base  = icon;
            front = clone;
        } else {
            base  = clone;
            front = icon;
        }

        if (this.window.minimized && this._options.MARK_MINIMIZED)
            front.opacity = 80;


        this._alignFront(front);

        this._icon.add_child(base);
        this._icon.add_child(front);

        // will be used to connect on icon signals (switcherList.icons[n]._front)
        this._front = front;

        if (this.window.is_above() || this.window.is_on_all_workspaces())
            this._icon.add_child(this._getIndicatorBox());


        if (this._options.WS_INDEXES) {
            this._wsIndicator = this._createWsIcon(window.get_workspace().index() + 1);
            this._icon.add_child(this._wsIndicator);
        }

        this._icon.set_size(size * scaleFactor, size * scaleFactor);
    }

    _alignFront(icon) {
        icon.x_align = icon.y_align = Clutter.ActorAlign.END;
    }

    _createAppIcon(app, size) {
        let appIcon = app
            ? app.create_icon_texture(size)
            : new St.Icon({ icon_name: 'icon-missing', icon_size: size });
        appIcon.x_expand = appIcon.y_expand = true;
        appIcon.reactive = true;
        return appIcon;
    }

    _createWsIcon(index) {
        let currentWS = global.workspace_manager.get_active_workspace_index();

        let label = new St.Label({
            text: `${index}`,
            style_class: this._options.colorStyle.INDICATOR_OVERLAY,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.END,
        });
        if (currentWS + 1 === index)
            label.add_style_class_name(this._options.colorStyle.INDICATOR_OVERLAY_HIGHLIGHTED);


        return label;
    }

    _getIndicatorBox() {
        const indicatorBox = new St.BoxLayout({
            vertical: false,
            // style_class: this._options.colorStyle.INDICATOR_OVERLAY,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.START,
        });

        indicatorBox.add_child(this._createAboveIcon());
        indicatorBox.add_child(this._createStickyIcon());

        return indicatorBox;
    }

    _createAboveIcon() {
        let icon = new St.Icon({
            style_class: 'window-state-indicators',
            icon_name: 'go-top-symbolic',
            icon_size: 16,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            /* x_expand: true,
            x_align: Clutter.ActorAlign.START,
            */
        });
        icon.add_style_class_name(this._options.colorStyle.INDICATOR_OVERLAY);
        if (!this.window.is_above()) {
            icon.add_style_class_name(this._options.colorStyle.INDICATOR_OVERLAY_INACTIVE);
            icon.opacity = 0;
        } else {
            icon.add_style_class_name('window-state-indicators-active');
        }
        this._aboveIcon = icon;
        return icon;
    }

    _createStickyIcon() {
        let icon = new St.Icon({
            style_class: 'window-state-indicators',
            icon_name: 'view-pin-symbolic',
            icon_size: 16,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
            /* x_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            */
        });
        icon.add_style_class_name(this._options.colorStyle.INDICATOR_OVERLAY);
        this._stickyIcon = icon;
        if (!this.window.is_on_all_workspaces()) {
            icon.add_style_class_name(this._options.colorStyle.INDICATOR_OVERLAY_INACTIVE);
            icon.opacity = 0;
        } else {
            icon.add_style_class_name('window-state-indicators-active');
        }
        return icon;
    }
});

// ////////////////////////////////////////////////////////////////////////

export const AppIcon = GObject.registerClass(
class AppIcon extends AppDisplay.AppIcon {
    _init(app, iconIndex, switcherParams, options) {
        super._init(app);
        this._options = options;

        // avoid conflict with rest of the system
        this._onMenuPoppedDown = () => { };
        // mouse events should go through the AppIcon to the switcher button
        this.reactive = false;

        // remove scroll connection created by my OFP extension
        if (this._scrollConnectionID)
            this.disconnect(this._scrollConnectionID);

        this._switcherParams = switcherParams;

        const appInfo = app.get_app_info();
        let appName = app.get_name();

        if (this._switcherParams.addAppDetails && appInfo) {
            if (appInfo.get_commandline() && appInfo.get_commandline().includes('snapd'))
                appName += ' (Snap)';
            else if (appInfo.get_commandline() && appInfo.get_commandline().includes('flatpak'))
                appName += ' (Flatpak)';
            else if (appInfo.get_commandline() && appInfo.get_commandline().toLowerCase().includes('.appimage'))
                appName += ' (AppImage)';

            const genericName = appInfo.get_generic_name() || '';
            const description = appInfo.get_description() || '';
            this._appDetails = {
                generic_name: genericName,
                description,
            };
        } else if (app.cachedWindows.length) {
            this._appDetails = {
                generic_name: app.cachedWindows[0].get_title() || '',
            };
        }

        this.titleLabel = new St.Label({
            text: appName,
        });

        this._id = app.get_id();

        // remove original app icon style
        this.style_class = '';
        // symbolic icons should be visible on both dark and light background
        this.set_style('color: grey;');

        if (this._options.SHOW_APP_TITLES) {
            if (this.icon.label) {
                this.icon.label.set_style(`font-size: ${LABEL_FONT_SIZE}em;`);
                this.icon.label.set_style_class_name(this._options.colorStyle.TITLE_LABEL);
                this.icon.label.opacity = 255;
                // set label truncate method
                this.icon.label.clutterText.set({
                    line_wrap: false,
                    ellipsize: 3, // Pango.EllipsizeMode.END,
                });
                // workaround that disconnects icon.label _updateMultiline()
                this.icon.label = this.titleLabel;
                this.icon.label.show();
            }
        } else if (this.icon.label) {
            this.icon.label.hide();
        }

        const count = app.cachedWindows.length;
        let winCounterIndicator;
        if (count && this._shouldShowWinCounter(count)) {
            winCounterIndicator = this._createWinCounterIndicator(count);
            // winCounterIndicator.add_style_class_name('running-counter');
            // move the counter above app title
            /* if (this._options.SHOW_APP_TITLES && !this._switcherParams.includeFavorites) {
                winCounterIndicator.set_style(`margin-bottom: ${LABEL_FONT_SIZE * 1.4}em;`);
            } else {
                winCounterIndicator.set_style(`margin-bottom: 1px;`);
            }*/
            this._iconContainer.add_child(winCounterIndicator);
            this._winCounterIndicator = winCounterIndicator;
        }

        if (this._switcherParams.includeFavorites || this._switcherParams.searchActive) {
            if (winCounterIndicator && this._options.SHOW_APP_TITLES)
                this._winCounterIndicator.set_style(`margin-bottom: ${LABEL_FONT_SIZE * 1.8}em;`);
            else if (winCounterIndicator && !this._options.SHOW_APP_TITLES)
                winCounterIndicator.set_style('margin-bottom: 7px;');

            this._dot.add_style_class_name('running-dot');
            // change dot color to be visible on light bg cause Adwaita uses white color
            if (this._options.colorStyle.RUNNING_DOT_COLOR)
                this._dot.add_style_class_name(this._options.colorStyle.RUNNING_DOT_COLOR);

            this.icon.set_style('margin-bottom: 4px;');
            if (!count)
                this._dot.opacity = 0;
        } else {
            this._iconContainer.remove_child(this._dot);
            if (winCounterIndicator && this._options.SHOW_APP_TITLES)
                this._winCounterIndicator.set_style(`margin-bottom: ${LABEL_FONT_SIZE * 1.4}em;`);
            // this.icon.set_style('margin-bottom: 4px;');
        }

        if (this._switcherParams.hotKeys && iconIndex < 12) {
            this._hotkeyIndicator = _createHotKeyNumIcon(iconIndex, options.colorStyle.INDICATOR_OVERLAY);
            this._iconContainer.add_child(this._hotkeyIndicator);
        }

        this._is_app = true;

        // if user activates an action that includes destroying the switcher from the app menu
        // when appIcon is destroyed, the fading app menu jumps to the top left corner of the monitor (lost parent / relative position).
        // hiding the menu immediately hides this visual glitch
        this.connect('destroy', () => {
            if (this._menu)
                this._menu.actor.hide();
        });
    }

    _shouldShowWinCounter(count) {
        if (this._options.HIDE_WIN_COUNTER_FOR_SINGLE_WINDOW && count === 1)
            return false;
        else
            return this._options.SHOW_WIN_COUNTER;
    }

    // this is override of original function to adjust icon size
    _createIcon() {
        return this.app.create_icon_texture(this._options.APP_MODE_ICON_SIZE);
    }

    _createWinCounterIndicator(num) {
        let label = new St.Label({
            text: `${num}`,
            style_class: this._options.colorStyle.RUNNING_COUNTER,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            reactive: false,
        });

        return label;
    }

    vfunc_button_press_event() {
        return Clutter.EVENT_PROPAGATE;
    }
});

export const SysActionIcon = GObject.registerClass(
class SysActionIcon extends St.Widget {
    _init(app, iconIndex, switcherParams, options) {
        super._init({ reactive: true });

        this._id = app;
        this._options = options;
        this._systemActions = SystemActions.getDefault();

        const actionName = this._systemActions.getName(this._id);
        const showLabel = this._options.SHOW_APP_TITLES;
        const iconSize = this._options.APP_MODE_ICON_SIZE;

        this._is_sysActionIcon = true;

        this.icon = new IconGrid.BaseIcon(actionName, {
            setSizeManually: true,
            showLabel,
            createIcon: this._createIcon.bind(this),
        });

        this.icon.setIconSize(iconSize);
        this.icon.add_style_class_name(this._options.colorStyle.TITLE_LABEL);

        this.titleLabel = new St.Label({
            text: actionName,
        });

        this.add_child(this.icon);
    }

    _createIcon() {
        const size = this._options.APP_MODE_ICON_SIZE;
        const iconName = this._systemActions.getIconName(this._id);
        return new St.Icon({
            icon_name: iconName,
            width: size,
            height: size,
            style: 'color: grey;',
        });
    }

    activate() {
        if (this._id === 'open-screenshot-ui')
            Screenshot.showScreenshotUI();
        else
            this._systemActions.activateAction(this._id);
    }
});

export const ShowAppsIcon = GObject.registerClass(
class ShowAppsIcon extends St.Widget {
    _init(params) {
        super._init({ reactive: true });

        const iconSize = params.iconSize;
        const showLabel = params.showLabel;
        const style = params.style;


        this._is_showAppsIcon = true;
        this._id = 'show-apps-icon';

        this.icon = new IconGrid.BaseIcon(_('Apps'), {
            setSizeManually: true,
            showLabel,
            createIcon: this._createIcon.bind(this),
        });
        this.icon.setIconSize(iconSize);
        this.icon.add_style_class_name(style);

        this.titleLabel = new St.Label({
            text: _('Show Applications'),
        });

        this.add_child(this.icon);
    }

    _createIcon(size) {
        this._iconActor = new St.Icon({
            icon_name: 'view-app-grid-symbolic',
            icon_size: size,
            style_class: 'show-apps-icon',
            track_hover: true,
        });
        return this._iconActor;
    }
});

// icon indicating direct activation key
function _createHotKeyNumIcon(index, style) {
    let icon = new St.Widget({
        x_expand: true,
        y_expand: true,
        x_align: Clutter.ActorAlign.START,
        y_align: Clutter.ActorAlign.START,
    });

    let box = new St.BoxLayout({
        style_class: style,
        vertical: true,
    });

    icon.add_child(box);
    let label = new St.Label({ text: `F${(index + 1).toString()}` });
    box.add(label);

    return icon;
}

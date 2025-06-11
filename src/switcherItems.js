/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * SwitcherItems
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2025
 * @license    GPL-3.0
 */

'use strict';

const { Clutter, GObject, Shell, St, Meta } = imports.gi;

const Main            = imports.ui.main;
const AppMenu         = imports.ui.appMenu.AppMenu;
const IconGrid        = imports.ui.iconGrid;
const SystemActions   = imports.misc.systemActions;
const Screenshot      = imports.ui.screenshot;
const PopupMenu       = imports.ui.popupMenu;
const BoxPointer      = imports.ui.boxpointer;

const shellVersion    = parseFloat(imports.misc.config.PACKAGE_VERSION);

const LABEL_FONT_SIZE = 0.9;

// gettext
let _;

// ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
function init(me) {
    _ = me._;
}

function cleanGlobal() {
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

var WindowIcon = GObject.registerClass({
    GTypeName: `WindowIcon${Math.floor(Math.random() * 1000)}`,
}, class WindowIcon extends St.BoxLayout {
    _init(item, iconIndex, switcherParams, opt) {
        const metaWin = item;
        super._init({
            style_class: 'thumbnail-box',
            vertical: true,
            reactive: true,
        });
        this._opt = opt;
        this._switcherParams = switcherParams;
        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });
        this._id = metaWin.get_id();

        this.add_child(this._icon);
        this._icon.destroy_all_children();

        this._createWindowIcon(metaWin);

        if (this._switcherParams.hotKeys && iconIndex < 12) {
            this._hotkeyIndicator = _createHotKeyNumIcon(iconIndex, opt.colorStyle.INDICATOR_OVERLAY);
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
        this._isWindow = true;
        this.window = window;

        let title = window.get_title();
        this.titleLabel = new St.Label({
            text: title,
            style_class: this._opt.colorStyle.TITLE_LABEL,
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

        if (!this._switcherParams.singleAppMode && this._opt.APP_ICON_SIZE > size) {
            size = this._opt.APP_ICON_SIZE;
            switched = true;
            cloneSize = Math.floor((mutterWindow.width / mutterWindow.height) * this._switcherParams.winPrevSize);
        }

        let clone = _createWindowClone(mutterWindow, cloneSize * scaleFactor);
        let icon;

        if (this.app && this._opt.APP_ICON_SIZE) {
            icon = this._createAppIcon(this.app,
                this._opt.APP_ICON_SIZE);
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

        if (this.window.minimized && this._opt.MARK_MINIMIZED)
            front.opacity = 80;

        this._icon.add_child(base);
        if (front) {
            this._alignFront(front);
            this._icon.add_child(front);
        }

        // will be used to connect on icon signals (switcherList.icons[n]._front)
        this._front = front;

        if (this.window.is_above() || this.window.is_on_all_workspaces())
            this._icon.add_child(this._getIndicatorBox());


        if (this._opt.WS_INDEXES) {
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
            style_class: this._opt.colorStyle.INDICATOR_OVERLAY,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.END,
        });
        if (currentWS + 1 === index)
            label.add_style_class_name(this._opt.colorStyle.INDICATOR_OVERLAY_HIGHLIGHTED);


        return label;
    }

    _getIndicatorBox() {
        const indicatorBox = new St.BoxLayout({
            vertical: false,
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
            icon_size: 14,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
        });
        icon.add_style_class_name(this._opt.colorStyle.INDICATOR_OVERLAY);
        if (!this.window.is_above() || this.window.get_maximized() === Meta.MaximizeFlags.BOTH) {
            icon.add_style_class_name(this._opt.colorStyle.INDICATOR_OVERLAY_INACTIVE);
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
            icon_size: 14,
            y_expand: true,
            y_align: Clutter.ActorAlign.START,
        });
        icon.add_style_class_name(this._opt.colorStyle.INDICATOR_OVERLAY);
        this._stickyIcon = icon;
        const primary = global.display.get_primary_monitor();
        const monitor = this.window.get_monitor();
        const wsPrimaryOnly = this._opt.mutterSettings.get_boolean('workspaces-only-on-primary');
        if (!this.window.is_on_all_workspaces() ||
            (wsPrimaryOnly && monitor !== primary)
        ) {
            icon.add_style_class_name(this._opt.colorStyle.INDICATOR_OVERLAY_INACTIVE);
            icon.opacity = 0;
        } else {
            icon.add_style_class_name('window-state-indicators-active');
        }
        return icon;
    }
});

// ////////////////////////////////////////////////////////////////////////

var AppIcon = GObject.registerClass({
    GTypeName: `AppIcon${Math.floor(Math.random() * 1000)}`,
    Signals: {
        'menu-state-changed': { param_types: [GObject.TYPE_BOOLEAN] },
        'sync-tooltip': {},
    },
}, class AppIcon extends St.Button {
    _init(app, iconIndex, switcherParams, opt) {
        super._init({});
        this._opt = opt;

        this.app = app;
        this._id = app.get_id();
        this._name = app.get_name();
        this._isApp = true;

        this._iconContainer = new St.Widget({
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
        });

        this.set_child(this._iconContainer);

        const iconParams = {};
        iconParams['createIcon'] = this._createIcon.bind(this);
        iconParams['setSizeManually'] = true;
        this.icon = new IconGrid.BaseIcon(app.get_name(), iconParams);
        this._iconContainer.add_child(this.icon);

        this._dot = new St.Widget({
            style_class: 'app-grid-running-dot app-well-app-running-dot running-dot-aatws',
            layout_manager: new Clutter.BinLayout(),
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
        });

        this._iconContainer.add_child(this._dot);

        this._menu = null;
        this._menuManager = new PopupMenu.PopupMenuManager(this);

        this._menuTimeoutId = 0;
        this.app.connectObject('notify::state',
            () => this._updateRunningStyle(), this);
        this._updateRunningStyle();

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

        // symbolic icons should be visible on both dark and light background
        this.set_style('color: grey;');


        if (this._opt.SHOW_APP_TITLES && this.icon.label) {
            this.icon.label.set_style(`font-size: ${LABEL_FONT_SIZE}em;`);
            this.icon.label.set_style_class_name(this._opt.colorStyle.TITLE_LABEL);
            this.icon.label.opacity = 255;
            // set label truncate method
            this.icon.label.clutterText.set({
                line_wrap: false,
                ellipsize: 3, // Pango.EllipsizeMode.END,
            });
            // workaround that disconnects icon.label _updateMultiline()
            this.icon.label = this.titleLabel;
        } else {
            this.icon.label?.hide();
        }

        const count = app.cachedWindows.length;
        let winCounterIndicator;
        if (count && this._shouldShowWinCounter(count)) {
            winCounterIndicator = this._createWinCounterIndicator(count);
            this._iconContainer.add_child(winCounterIndicator);
            this._winCounterIndicator = winCounterIndicator;
        }

        if (this._switcherParams.includeFavorites || this._switcherParams.searchActive) {
            if (winCounterIndicator && this._opt.SHOW_APP_TITLES)
                this._winCounterIndicator.set_style(`margin-bottom: ${LABEL_FONT_SIZE * 1.8}em;`);
            else if (winCounterIndicator && !this._opt.SHOW_APP_TITLES)
                winCounterIndicator.set_style('margin-bottom: 7px;');

            // Change running dot color to be visible on light bg (Adwaita theme uses white dot)
            if (this._opt.colorStyle.RUNNING_DOT_COLOR)
                this._dot.add_style_class_name(this._opt.colorStyle.RUNNING_DOT_COLOR);

            this.icon.set_style('margin-bottom: 4px;');
            if (!count)
                this._dot.opacity = 0;
        } else {
            this._iconContainer.remove_child(this._dot);
            if (winCounterIndicator && this._opt.SHOW_APP_TITLES)
                this._winCounterIndicator.set_style(`margin-bottom: ${LABEL_FONT_SIZE * 1.4}em;`);
        }

        if (this._switcherParams.hotKeys && iconIndex < 12) {
            this._hotkeyIndicator = _createHotKeyNumIcon(iconIndex, opt.colorStyle.INDICATOR_OVERLAY);
            this._iconContainer.add_child(this._hotkeyIndicator);
        }

        // if user activates an action that includes destroying the switcher from the app menu
        // when appIcon is destroyed, the fading app menu jumps to the top left corner of the monitor (lost parent / relative position).
        // hiding the menu immediately hides this visual glitch
        this.connect('destroy', () => {
            this._menu?.actor.hide();
        });
    }

    _shouldShowWinCounter(count) {
        if (this._opt.HIDE_WIN_COUNTER_FOR_SINGLE_WINDOW && count === 1)
            return false;
        else
            return this._opt.SHOW_WIN_COUNTER;
    }

    // this is override of original function to adjust icon size
    _createIcon() {
        return this.app.create_icon_texture(this._opt.APP_MODE_ICON_SIZE);
    }

    _updateRunningStyle() {
        if (this.app.state !== Shell.AppState.STOPPED)
            this._dot.show();
        else
            this._dot.hide();
    }

    _createWinCounterIndicator(num) {
        let label = new St.Label({
            text: `${num}`,
            style_class: this._opt.colorStyle.RUNNING_COUNTER,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            reactive: false,
        });

        return label;
    }

    popupMenu(side = St.Side.LEFT) {
        if (!this._menu) {
            this._menu = new AppMenu(this, side, {
                favoritesSection: true,
                showSingleWindows: true,
            });
            this._menu.setApp(this.app);
            this._menu.connectObject('open-state-changed', (menu, isPoppedUp) => {
                if (!isPoppedUp)
                    this._onMenuPoppedDown();
            }, this);
            Main.uiGroup.add_child(this._menu.actor);
            this._menuManager.addMenu(this._menu);
            this._menu.connectObject('destroy', () => {
                this._menu.disconnectObject(this);
                this._menu = null;
            }, this);
        }

        this.emit('menu-state-changed', true);

        this._menu.open(BoxPointer.PopupAnimation.FULL);
        this._menuManager.ignoreRelease();
        this.emit('sync-tooltip');

        return false;
    }

    _onMenuPoppedDown() {
        this.emit('menu-state-changed', false);
    }

    vfunc_button_press_event() {
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_touch_event() {
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_clicked() {
        return Clutter.EVENT_PROPAGATE;
    }
});

var SysActionIcon = GObject.registerClass({
    GTypeName: `SysActionIcon${Math.floor(Math.random() * 1000)}`,
},
class SysActionIcon extends St.Widget {
    _init(app, iconIndex, switcherParams, opt) {
        super._init({ reactive: true });

        this._id = app;
        this._opt = opt;
        this._systemActions = SystemActions.getDefault();

        const actionName = this._systemActions.getName(this._id);
        const showLabel = this._opt.SHOW_APP_TITLES;

        this._isSysActionIcon = true;

        this.icon = new IconGrid.BaseIcon(actionName, {
            setSizeManually: true,
            showLabel,
            createIcon: this._createIcon.bind(this),
        });

        this.icon.set_style_class_name(this._opt.colorStyle.TITLE_LABEL);

        this.titleLabel = new St.Label({
            text: actionName,
        });

        this.add_child(this.icon);
    }

    _createIcon() {
        return new St.Icon({
            iconName: this._systemActions.getIconName(this._id),
            iconSize: this._opt.APP_MODE_ICON_SIZE,
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

var ShowAppsIcon = GObject.registerClass({
    GTypeName: `ShowAppsIcon${Math.floor(Math.random() * 1000)}`,
}, class ShowAppsIcon extends St.Widget {
    _init(params) {
        super._init({ reactive: true });

        const iconSize = params.iconSize;
        const showLabel = params.showLabel;
        const style = params.style;


        this._isShowAppsIcon = true;
        this._id = 'show-apps-icon';

        this.icon = new IconGrid.BaseIcon(_('Apps'), {
            setSizeManually: true,
            showLabel,
            createIcon: this._createIcon.bind(this),
        });
        this.icon.setIconSize(iconSize);
        this.icon.set_style_class_name(style);

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
    box.add_child(label);

    return icon;
}

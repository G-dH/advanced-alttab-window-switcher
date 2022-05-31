'use strict';

const GLib = imports.gi.GLib;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Config = imports.misc.config;
var   shellVersion = parseFloat(Config.PACKAGE_VERSION);

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
var _ = Gettext.gettext;

const _schema = 'org.gnome.shell.extensions.advanced-alt-tab-window-switcher';

var Actions = {
    NONE:              0,
    SELECT_ITEM:       1,
    ACTIVATE:          2,
    SINGLE_APP:        3,
    SWITCH_FILTER:     4,
    SWITCHER_MODE:     5,
    SWITCH_WS:         6,
    GROUP_APP:         7,
    CURRENT_MON_FIRST: 8,
    MENU:              9,
    SHOW:             10,
    MOVE_TO_WS:       11,
    THUMBNAIL:        12,
    HIDE:             13,
    CLOSE_QUIT:       14,
    CLOSE_ALL_APP:    15, // close all windows of selected application
    KILL:             16,
    NEW_WINDOW:       17,
    ALLWAYS_ON_TOP:   18,
    STICKY:           19, // always on visible ws
    MOVE_MAX:         20, // move window to the current ws and maximize it
    FS_ON_NEW_WS:     21, // fullscreen window on new ws next to the current one

    PREFS:            99,
};

var Options = class Options {
    constructor() {
        this._gsettings = ExtensionUtils.getSettings(_schema);
        // delay write to backend to avoid excessive disk writes when adjusting scales and spinbuttons
        this._writeTimeoutId = 0;
        this._gsettings.delay();
        this._gsettings.connect('changed', () => {
            if (this._writeTimeoutId)
                GLib.Source.remove(this._writeTimeoutId);

            this._writeTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                300,
                () => {
                    this._gsettings.apply();
                    this._writeTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }
            );
        });

        this._connectionIds = [];

        this.options = {
            superKeyMode: ['int', 'super-key-mode'],
            enableSuper: ['boolean', 'enable-super'],
            superDoublePressAction: ['int', 'super-double-press-action'],
            switcherPopupPosition: ['int', 'switcher-popup-position'],
            switcherPopupMonitor: ['int', 'switcher-popup-monitor'],
            switcherPopupShiftHotkeys: ['boolean', 'switcher-popup-shift-hotkeys'],
            switcherPopupTimeout: ['int', 'switcher-popup-timeout'],
            switcherPopupPreviewSelected: ['int', 'switcher-popup-preview-selected'],
            switcherPopupUpDownAction: ['int', 'switcher-popup-up-down-action'],
            switcherPopupStartSearch: ['boolean', 'switcher-popup-start-search'],
            switcherPopupWrap: ['boolean', 'switcher-popup-wrap'],
            switcherPopupHotKeys: ['boolean', 'switcher-popup-hot-keys'],
            switcherPopupHoverSelect: ['boolean', 'switcher-popup-hover-select'],
            switcherPopupScrollOut: ['int', 'switcher-popup-scroll-out'],
            switcherPopupScrollIn: ['int', 'switcher-popup-scroll-in'],
            switcherPopupTooltipTitle: ['int', 'switcher-popup-tooltip-title'],
            switcherPopupTooltipLabelScale: ['int', 'switcher-popup-tooltip-label-scale'],
            switcherPopupPrimClickIn: ['int', 'switcher-popup-prim-click-in'],
            switcherPopupSecClickIn: ['int', 'switcher-popup-sec-click-in'],
            switcherPopupMidClickIn: ['int', 'switcher-popup-mid-click-in'],
            switcherPopupPrimClickOut: ['int', 'switcher-popup-prim-click-out'],
            switcherPopupSecClickOut: ['int', 'switcher-popup-sec-click-out'],
            switcherPopupMidClickOut: ['int', 'switcher-popup-mid-click-out'],
            switcherPopupStatus: ['boolean', 'switcher-popup-status'],
            switcherPopupSyncFilter: ['boolean', 'switcher-popup-sync-filter'],
            singleAppPreviewSize: ['int', 'win-switcher-single-prev-size'],
            winSwitcherPopupFilter: ['int', 'win-switcher-popup-filter'],
            winSwitcherPopupSorting: ['int', 'win-switcher-popup-sorting'],
            winSwitcherPopupOrder: ['int', 'win-switcher-popup-order'],
            winSwitcherPopupTitles: ['int', 'win-switcher-popup-titles'],
            winSwitcherPopupScrollItem: ['int', 'win-switcher-popup-scroll-item'],
            winSwitcherPopupPrimClickItem: ['int', 'win-switcher-popup-prim-click-item'],
            winSwitcherPopupSecClickItem: ['int', 'win-switcher-popup-sec-click-item'],
            winSwitcherPopupMidClickItem: ['int', 'win-switcher-popup-mid-click-item'],
            winMinimizedLast: ['boolean', 'win-switch-minimized-to-end'],
            winMarkMinimized: ['boolean', 'win-switch-mark-minimized'],
            winSkipMinimized: ['boolean', 'win-switch-skip-minimized'],
            winIncludeModals: ['boolean', 'win-switch-include-modals'],
            winSwitcherPopupWsIndexes: ['boolean', 'win-switcher-popup-ws-indexes'],
            winSwitcherPopupSearchApps: ['boolean', 'win-switcher-popup-search-apps'],
            winSwitcherPopupSearchAll: ['boolean', 'win-switcher-popup-search-all'],
            winSwitcherPopupPreviewSize: ['int', 'win-switcher-popup-preview-size'],
            winSwitcherPopupIconSize: ['int', 'win-switcher-popup-icon-size'],
            appSwitcherPopupFilter: ['int', 'app-switcher-popup-filter'],
            appSwitcherPopupSorting: ['int', 'app-switcher-popup-sorting'],
            appSwitcherPopupRaiseFirstOnly: ['boolean', 'app-switcher-popup-raise-first-only'],
            appSwitcherPopupSearchPrefRunning: ['boolean', 'app-switcher-popup-search-pref-running'],
            appSwitcherPopupResultsLimit: ['int', 'app-switcher-popup-results-limit'],
            appSwitcherPopupIconSize: ['int', 'app-switcher-popup-icon-size'],
            appSwitcherPopupFavMru: ['boolean', 'app-switcher-popup-fav-mru'],
            appSwitcherPopupFavoriteApps: ['boolean', 'app-switcher-popup-fav-apps'],
            appSwitcherPopupWinCounter: ['boolean', 'app-switcher-popup-win-counter'],
            appSwitcherPopupHideWinCounterForSingleWindow: ['boolean', 'app-switcher-popup-hide-win-counter-for-single-window'],
            appSwitcherPopupTitles: ['boolean', 'app-switcher-popup-titles'],
            appSwitcherPopupScrollItem: ['int', 'app-switcher-popup-scroll-item'],
            appSwitcherPopupPrimClickItem: ['int', 'app-switcher-popup-prim-click-item'],
            appSwitcherPopupSecClickItem: ['int', 'app-switcher-popup-sec-click-item'],
            appSwitcherPopupMidClickItem: ['int', 'app-switcher-popup-mid-click-item'],
            wsSwitchIgnoreLast: ['boolean', 'ws-switch-ignore-last'],
            wsSwitchWrap: ['boolean', 'ws-switch-wrap'],
            wsSwitchPopup: ['boolean', 'ws-switch-popup'],
            wsSwitchIndicatorMode: ['int', 'ws-switch-indicator-mode'],
            wsShowSwitcherPopup: ['boolean', 'ws-switch-popup'],
            switcherPopupPointer: ['boolean', 'switcher-popup-pointer'],
            switcherPopupExtAppStable: ['boolean', 'switcher-popup-ext-app-stable'],
            switcherPopupReverseAuto: ['boolean', 'switcher-popup-reverse-auto'],
            switcherPopupPointerTimeout: ['int', 'switcher-popup-pointer-timeout'],
            switcherPopupActivateOnHide: ['boolean', 'switcher-popup-activate-on-hide'],
            wmAlwaysActivateFocused: ['boolean', 'wm-always-activate-focused'],
            winThumbnailScale: ['int', 'win-thumbnail-scale'],
            hotkeySwitchFilter: ['string', 'hotkey-switch-filter'],
            hotkeySingleApp: ['string', 'hotkey-single-app'],
            hotkeyCloseQuit: ['string', 'hotkey-close-quit'],
            hotkeySearch: ['string', 'hotkey-search'],
            hotkeyNewWin: ['string', 'hotkey-new-win'],
            hotkeyMoveWinToMonitor: ['string', 'hotkey-move-win-to-monitor'],
            hotkeyAbove: ['string', 'hotkey-above'],
            hotkeySticky: ['string', 'hotkey-sticky'],
            hotkeyCloseAllApp: ['string', 'hotkey-close-all-app'],
            hotkeyFsOnNewWs: ['string', 'hotkey-fs-on-new-ws'],
            hotkeyMaximize: ['string', 'hotkey-maximize'],
            hotkeyGroupWs: ['string', 'hotkey-group-ws'],
            hotkeySwitcherMode: ['string', 'hotkey-switcher-mode'],
            hotkeyThumbnail: ['string', 'hotkey-thumbnail'],
            hotkeyPrefs: ['string', 'hotkey-prefs'],
            hotkeyLeft: ['string', 'hotkey-left'],
            hotkeyDown: ['string', 'hotkey-down'],
            hotkeyUp: ['string', 'hotkey-up'],
            hotkeyRight: ['string', 'hotkey-right'],
        };
        this.cachedOptions = {};
        this.connect('changed', this._updateCachedSettings.bind(this));
    }

    _updateCachedSettings(settings, key) {
        Object.keys(this.options).forEach(v => this.get(v, true));
    }

    get(option, updateCache = false) {
        if (updateCache || this.cachedOptions[option] === undefined) {
            const [format, key, settings] = this.options[option];
            let gSettings;
            if (settings !== undefined) {
                gSettings = settings();
            } else {
                gSettings = this._gsettings;
            }

            this.cachedOptions[option] = gSettings.get_value(key).deep_unpack();
        }

        return this.cachedOptions[option];
    }

    set(option, value) {
        const [format, key] = this.options[option];
        switch (format) {
            case 'string':
                this._gsettings.set_string(key, value);
                break;
            case 'int':
                this._gsettings.set_int(key, value);
                break;
            case 'boolean':
                this._gsettings.set_boolean(key, value);
                break;
        }
    }

    getDefault(option) {
        const [format, key] = this.options[option];
        return this._gsettings.get_default_value(key).deep_unpack();
    }

    connect(name, callback) {
        const id = this._gsettings.connect(name, callback);
        this._connectionIds.push(id);
        return id;
    }

    destroy() {
        this._connectionIds.forEach(id => this._gsettings.disconnect(id));
        if (this._writeTimeoutId)
            GLib.Source.remove(this._writeTimeoutId);
            this._writeTimeoutId = 0;
    }
};

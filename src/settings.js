/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * Settings
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

const ColorStyleDefault = {
    STYLE: ' ',
    SWITCHER_LIST: ' ',
    CAPTION_LABEL: 'dash-label',
    TITLE_LABEL: ' ',
    SELECTED: ' ',
    FOCUSED: 'focused-dark',
    INDICATOR_OVERLAY: 'indicator-overlay-dark',
    INDICATOR_OVERLAY_HIGHLIGHTED: 'indicator-overlay-highlight-dark',
    INDICATOR_OVERLAY_HOVER: 'indicator-overlay-hover',
    INDICATOR_OVERLAY_INACTIVE: 'indicator-overlay-inactive-dark',
    RUNNING_COUNTER: 'running-counter-dark',
    RUNNING_COUNTER_HOVER: 'running-counter-hover',
    RUNNING_DOT_COLOR: ' ',
    ARROW: ' ',
};

const ColorStyleDark = {
    STYLE: '1',
    SWITCHER_LIST: 'switcher-list-dark',
    CAPTION_LABEL: 'caption-label-dark',
    TITLE_LABEL: 'title-label-dark',
    SELECTED: 'selected-dark',
    FOCUSED: 'focused-dark',
    INDICATOR_OVERLAY: 'indicator-overlay-dark',
    INDICATOR_OVERLAY_HIGHLIGHTED: 'indicator-overlay-highlight-dark',
    INDICATOR_OVERLAY_HOVER: 'indicator-overlay-hover',
    INDICATOR_OVERLAY_INACTIVE: 'indicator-overlay-inactive-dark',
    RUNNING_COUNTER: 'running-counter-dark',
    RUNNING_COUNTER_HOVER: 'running-counter-hover',
    RUNNING_DOT_COLOR: ' ',
    ARROW: 'arrow-dark',
};

const ColorStyleLight = {
    STYLE: '2',
    SWITCHER_LIST: 'switcher-list-light',
    CAPTION_LABEL: 'caption-label-light',
    TITLE_LABEL: 'title-label-light',
    SELECTED: 'selected-light',
    FOCUSED: 'focused-light',
    INDICATOR_OVERLAY: 'indicator-overlay-light',
    INDICATOR_OVERLAY_HIGHLIGHTED: 'indicator-overlay-highlight-light',
    INDICATOR_OVERLAY_HOVER: 'indicator-overlay-hover',
    INDICATOR_OVERLAY_INACTIVE: 'indicator-overlay-inactive-light',
    RUNNING_COUNTER: 'running-counter-light',
    RUNNING_COUNTER_HOVER: 'running-counter-hover',
    RUNNING_DOT_COLOR: '',
    RUNNING_DOT_ADWAITA: 'running-dot-color',
    ARROW: 'arrow-light',
};


export const Options = class Options {
    constructor(me) {
        this._gSettings = me.gSettings;

        this._connectionIds = [];
        this.colorStyle = ColorStyleDefault;

        this.cancelTimeout = false; // state variable used by the switcher popup and needs to be available for other modules

        // delay write to backend to avoid excessive disk writes when adjusting scales and spinbuttons
        this._writeTimeoutId = 0;
        this._gSettings.delay();
        this.connect('changed', () => {
            if (this._writeTimeoutId)
                GLib.Source.remove(this._writeTimeoutId);

            this._writeTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                100,
                () => {
                    this._gSettings.apply();
                    this._updateCachedSettings();
                    this._writeTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }
            );
        });

        this.options = {
            superKeyMode: ['int', 'super-key-mode'],
            enableSuper: ['boolean', 'enable-super'],
            superDoublePressAction: ['int', 'super-double-press-action'],
            hotEdgePosition: ['int', 'hot-edge-position'],
            hotEdgeMode: ['int', 'hot-edge-mode'],
            hotEdgeFullScreen: ['boolean', 'hot-edge-fullscreen'],
            hotEdgeMonitor: ['int', 'hot-edge-monitor'],
            hotEdgePressure: ['int', 'hot-edge-pressure'],
            hotEdgeWidth: ['int', 'hot-edge-width'],
            showDash: ['int', 'show-dash'],
            inputSourceId: ['string', 'input-source-id'],
            rememberInput: ['boolean', 'remember-input'],
            animationTimeFactor: ['int', 'animation-time-factor'],

            switcherPopupPosition: ['int', 'switcher-popup-position'],
            switcherPopupMonitor: ['int', 'switcher-popup-monitor'],
            switcherPopupShiftHotkeys: ['boolean', 'switcher-popup-shift-hotkeys'],
            switcherPopupDelKeyClose: ['boolean', 'switcher-popup-del-key-close'],
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
            switcherPopupTheme: ['int', 'switcher-popup-theme'],
            switcherPopupInteractiveIndicators: ['boolean', 'switcher-popup-interactive-indicators'],
            switcherPopupShowIfNoWin: ['boolean', 'switcher-popup-show-if-no-win'],
            switcherPopupSecondTabSwitchFilter: ['boolean', 'switcher-popup-second-tab-switch-filter'],
            switcherWsThumbnails: ['int', 'switcher-ws-thumbnails'],
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
            appSwitcherPopupShowWinsOnActivate: ['int', 'app-switcher-popup-show-wins-on-activate'],
            appSwitcherPopupIncludeShowAppsIcon: ['boolean', 'app-switcher-popup-include-show-apps-icon'],
            appSwitcherPopupScrollItem: ['int', 'app-switcher-popup-scroll-item'],
            appSwitcherPopupPrimClickItem: ['int', 'app-switcher-popup-prim-click-item'],
            appSwitcherPopupSecClickItem: ['int', 'app-switcher-popup-sec-click-item'],
            appSwitcherPopupMidClickItem: ['int', 'app-switcher-popup-mid-click-item'],
            wsSwitchIgnoreLast: ['boolean', 'ws-switch-ignore-last'],
            wsSwitchWrap: ['boolean', 'ws-switch-wrap'],
            wsShowSwitcherPopup: ['boolean', 'ws-switch-popup'],
            switcherPopupPointer: ['boolean', 'switcher-popup-pointer'],
            switcherPopupExtAppFavorites: ['boolean', 'switcher-popup-ext-app-favorites'],
            switcherPopupExtAppStable: ['boolean', 'switcher-popup-ext-app-stable'],
            switcherPopupReverseAuto: ['boolean', 'switcher-popup-reverse-auto'],
            switcherPopupPointerTimeout: ['int', 'switcher-popup-pointer-timeout'],
            switcherPopupActivateOnHide: ['boolean', 'switcher-popup-activate-on-hide'],
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
            hotkeyFavorites: ['string', 'hotkey-favorites'],
        };
        this.cachedOptions = {};

        this._setOptionConstants();

        this._intSettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.interface' });
        this._updateColorScheme();
        this._intSettingsSigId = this._intSettings.connect('changed::color-scheme', this._updateColorScheme.bind(this));
    }

    _updateColorScheme(/* settings, key */) {
        // const gtkTheme = this._intSettings.get_string('gtk-theme');
        const darkScheme = this._intSettings.get_string('color-scheme') === 'prefer-dark';
        let colorStyle = this.get('switcherPopupTheme');

        switch (colorStyle) {
        case 0:
            this.colorStyle = ColorStyleDefault;
            break;
        case 1:
            this.colorStyle = ColorStyleDark;
            break;
        case 2:
            this.colorStyle = ColorStyleLight;
            break;
        case 3:
            this.colorStyle = darkScheme ? ColorStyleDark : ColorStyleLight;
            break;
        case 4:
            this.colorStyle = darkScheme ? ColorStyleLight : ColorStyleDark;
            break;
        default:
            this.colorStyle = ColorStyleDefault;
        }

        ColorStyleLight.RUNNING_DOT_COLOR = this.colorStyle === ColorStyleLight /* && gtkTheme === 'Adwaita'*/
            ? ColorStyleLight.RUNNING_DOT_ADWAITA
            : '';
    }

    _updateCachedSettings(/* settings, key */) {
        Object.keys(this.options).forEach(v => this.get(v, true));
        this._updateColorScheme();
        this._setOptionConstants();
    }

    get(option, updateCache = false) {
        if (updateCache || this.cachedOptions[option] === undefined) {
            const [, key, settings] = this.options[option];
            let gSettings;
            if (settings !== undefined)
                gSettings = settings();
            else
                gSettings = this._gSettings;


            this.cachedOptions[option] = gSettings.get_value(key).deep_unpack();
        }

        return this.cachedOptions[option];
    }

    set(option, value) {
        const [format, key] = this.options[option];
        switch (format) {
        case 'string':
            this._gSettings.set_string(key, value);
            break;
        case 'int':
            this._gSettings.set_int(key, value);
            break;
        case 'boolean':
            this._gSettings.set_boolean(key, value);
            break;
        }
    }

    getDefault(option) {
        const [, key] = this.options[option];
        return this._gSettings.get_default_value(key).deep_unpack();
    }

    connect(name, callback) {
        const id = this._gSettings.connect(name, callback);
        this._connectionIds.push(id);
        return id;
    }

    destroy() {
        this._connectionIds.forEach(id => this._gSettings.disconnect(id));
        if (this._writeTimeoutId)
            GLib.Source.remove(this._writeTimeoutId);
        this._writeTimeoutId = 0;
        this._gSettings = null;

        this._intSettings.disconnect(this._intSettingsSigId);
        this._intSettings = null;
    }

    _setOptionConstants() {
        this.ENABLE_SUPER          = this.get('enableSuper');
        this.SUPER_DOUBLE_PRESS_ACT = this.get('superDoublePressAction'); // 1 - dafault, 2, Overview, 3 - App Grid, 4 - Activate Previous Window
        this.POSITION_POINTER      = this.get('switcherPopupPointer'); // place popup at pointer position
        this.REVERSE_AUTO          = this.get('switcherPopupReverseAuto');  // reverse list in order to the first item be closer to the mouse pointer. only if !_keyboardTriggered
        this.POPUP_POSITION        = this.get('switcherPopupPosition');
        this.NO_MODS_TIMEOUT       = this.get('switcherPopupPointerTimeout');
        this.INITIAL_DELAY         = this.get('switcherPopupTimeout');
        this.WRAPAROUND            = this.get('switcherPopupWrap');
        this.ACTIVATE_ON_HIDE      = this.get('switcherPopupActivateOnHide');
        this.UP_DOWN_ACTION        = this.get('switcherPopupUpDownAction');
        this.HOT_KEYS              = this.get('switcherPopupHotKeys');
        this.SHIFT_AZ_HOTKEYS      = this.get('switcherPopupShiftHotkeys');
        this.DELETE_KEY_CLOSE      = this.get('switcherPopupDelKeyClose');
        this.STATUS                = this.get('switcherPopupStatus');
        this.PREVIEW_SELECTED      = this.get('switcherPopupPreviewSelected');
        this.SEARCH_ALL            = this.get('winSwitcherPopupSearchAll');
        this.ITEM_CAPTIONS         = this.get('switcherPopupTooltipTitle');
        this.SEARCH_DEFAULT        = this.get('switcherPopupStartSearch');
        this.CAPTIONS_SCALE        = this.get('switcherPopupTooltipLabelScale') / 100;
        this.HOVER_SELECT          = this.get('switcherPopupHoverSelect');
        this.SYNC_FILTER           = this.get('switcherPopupSyncFilter');
        this.INTERACTIVE_INDICATORS = this.get('switcherPopupInteractiveIndicators');
        this.INPUT_SOURCE_ID       = this.get('inputSourceId');
        this.REMEMBER_INPUT        = this.get('rememberInput');
        this.WS_THUMBNAILS         = this.get('switcherWsThumbnails');
        this.ANIMATION_TIME_FACTOR = this.get('animationTimeFactor') / 100;
        this.SHOW_WS_SWITCHER_POPUP = this.get('wsShowSwitcherPopup');
        this.SHOW_IF_NO_WIN        = this.get('switcherPopupShowIfNoWin');
        this.SECOND_TAB_SWITCH     = this.get('switcherPopupSecondTabSwitchFilter');

        // Window switcher
        this.WIN_FILTER_MODE       = this.get('winSwitcherPopupFilter');
        this.GROUP_MODE            = this.get('winSwitcherPopupOrder');
        this.WIN_SORTING_MODE      = this.get('winSwitcherPopupSorting');
        this.MINIMIZED_LAST        = this.get('winMinimizedLast');
        this.MARK_MINIMIZED        = this.get('winMarkMinimized');
        this.SKIP_MINIMIZED        = this.get('winSkipMinimized');
        this.INCLUDE_MODALS        = this.get('winIncludeModals');
        this.SEARCH_APPS           = this.get('winSwitcherPopupSearchApps');
        this.SINGLE_APP_PREVIEW_SIZE = this.get('singleAppPreviewSize');
        this.WINDOW_TITLES         = this.get('winSwitcherPopupTitles');
        this.WINDOW_PREVIEW_SIZE   = this.get('winSwitcherPopupPreviewSize');
        this.APP_ICON_SIZE         = this.get('winSwitcherPopupIconSize');
        this.WS_INDEXES            = this.get('winSwitcherPopupWsIndexes');

        // App switcher
        this.APP_FILTER_MODE       = this.get('appSwitcherPopupFilter');
        this.APP_SORTING_MODE      = this.get('appSwitcherPopupSorting');
        this.SORT_FAVORITES_BY_MRU = this.get('appSwitcherPopupFavMru');
        this.APP_RAISE_FIRST_ONLY  = this.get('appSwitcherPopupRaiseFirstOnly');
        this.APP_SEARCH_LIMIT      = this.get('appSwitcherPopupResultsLimit');
        this.INCLUDE_FAVORITES     = this.get('appSwitcherPopupFavoriteApps');
        this.SHOW_APP_TITLES       = this.get('appSwitcherPopupTitles');
        this.SHOW_WIN_COUNTER      = this.get('appSwitcherPopupWinCounter');
        this.HIDE_WIN_COUNTER_FOR_SINGLE_WINDOW = this.get('appSwitcherPopupHideWinCounterForSingleWindow');
        this.APP_MODE_ICON_SIZE    = this.get('appSwitcherPopupIconSize');
        this.SEARCH_PREF_RUNNING   = this.get('appSwitcherPopupSearchPrefRunning');
        this.INCLUDE_SHOW_APPS_ICON = this.get('appSwitcherPopupIncludeShowAppsIcon');
        this.LIST_WINS_ON_ACTIVATE = this.get('appSwitcherPopupShowWinsOnActivate');
        this.INCLUDE_FAV_MOUSE     = this.get('switcherPopupExtAppFavorites');
        this.COLOR_STYLE_DEFAULT   = !this.get('switcherPopupTheme');

        this.DASH_APP_STABLE_SEQUENCE = this.get('switcherPopupExtAppStable');
    }
};

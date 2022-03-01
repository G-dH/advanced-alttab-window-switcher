'use strict';

const { GLib, Gio } = imports.gi;

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

var MscOptions = class MscOptions {
    constructor() {
        this._gsettings = ExtensionUtils.getSettings(_schema);
        this._connectionIds = [];
    }

    connect(name, callback) {
        const id = this._gsettings.connect(name, callback);
        this._connectionIds.push(id);
        return id;
    }

    destroy() {
        this._connectionIds.forEach(id => this._gsettings.disconnect(id));
    }

    // common options
    get superKeyMode() {
        return this._gsettings.get_int('super-key-mode');
    }

    set superKeyMode(int_val) {
        this._gsettings.set_int('super-key-mode', int_val);
    }

    get switcherPopupPosition() {
        return this._gsettings.get_int('switcher-popup-position');
    }

    set switcherPopupPosition(int_val) {
        this._gsettings.set_int('switcher-popup-position', int_val);
    }

    get switcherPopupMonitor() {
        return this._gsettings.get_int('switcher-popup-monitor');
    }

    set switcherPopupMonitor(int_val) {
        this._gsettings.set_int('switcher-popup-monitor', int_val);
    }

    get switcherPopupShiftHotkeys() {
        return this._gsettings.get_boolean('switcher-popup-shift-hotkeys');
    }

    set switcherPopupShiftHotkeys(bool_val) {
        this._gsettings.set_boolean('switcher-popup-shift-hotkeys', bool_val);
    }

    get switcherPopupTimeout() {
        return this._gsettings.get_int('switcher-popup-timeout');
    }

    set switcherPopupTimeout(int_val) {
        this._gsettings.set_int('switcher-popup-timeout', int_val);
    }

    get switcherPopupPreviewSelected() {
        return this._gsettings.get_int('switcher-popup-preview-selected');
    }

    set switcherPopupPreviewSelected(int_val) {
        this._gsettings.set_int('switcher-popup-preview-selected', int_val);
    }

    get switcherPopupUpDownAction() {
        return this._gsettings.get_int('switcher-popup-up-down-action');
    }

    set switcherPopupUpDownAction(int_val) {
        this._gsettings.set_int('switcher-popup-up-down-action', int_val);
    }

    get switcherPopupStartSearch() {
        return this._gsettings.get_boolean('switcher-popup-start-search');
    }

    set switcherPopupStartSearch(bool_val) {
        this._gsettings.set_boolean('switcher-popup-start-search', bool_val);
    }

    get switcherPopupWrap() {
        return this._gsettings.get_boolean('switcher-popup-wrap');
    }

    set switcherPopupWrap(bool_val) {
        this._gsettings.set_boolean('switcher-popup-wrap', bool_val);
    }

    get switcherPopupHotKeys() {
        return this._gsettings.get_boolean('switcher-popup-hot-keys');
    }

    set switcherPopupHotKeys(bool_val) {
        this._gsettings.set_boolean('switcher-popup-hot-keys', bool_val);
    }

    get switcherPopupHoverSelect() {
        return this._gsettings.get_boolean('switcher-popup-hover-select');
    }

    set switcherPopupHoverSelect(bool_val) {
        this._gsettings.set_boolean('switcher-popup-hover-select', bool_val);
    }

    get switcherPopupScrollOut() {
        return this._gsettings.get_int('switcher-popup-scroll-out');
    }

    set switcherPopupScrollOut(int_val) {
        this._gsettings.set_int('switcher-popup-scroll-out', int_val);
    }

    get switcherPopupScrollIn() {
        return this._gsettings.get_int('switcher-popup-scroll-in');
    }

    set switcherPopupScrollIn(int_val) {
        this._gsettings.set_int('switcher-popup-scroll-in', int_val);
    }

    get switcherPopupOverlayTitle() {
        return this._gsettings.get_boolean('switcher-popup-overlay-title');
    }

    set switcherPopupOverlayTitle(bool_val) {
        this._gsettings.set_boolean('switcher-popup-overlay-title', bool_val);
    }

    get switcherPopupTooltipLabelScale() {
        return this._gsettings.get_int('switcher-popup-tooltip-label-scale');
    }

    set switcherPopupTooltipLabelScale(int_val) {
        this._gsettings.set_int('switcher-popup-tooltip-label-scale', int_val);
    }

    get switcherPopupPrimClickIn() {
        return this._gsettings.get_int('switcher-popup-prim-click-in');
    }

    set switcherPopupPrimClickIn(int_val) {
        this._gsettings.set_int('switcher-popup-prim-click-in', int_val);
    }

    get switcherPopupSecClickIn() {
        return this._gsettings.get_int('switcher-popup-sec-click-in');
    }

    set switcherPopupSecClickIn(int_val) {
        this._gsettings.set_int('switcher-popup-sec-click-in', int_val);
    }

    get switcherPopupMidClickIn() {
        return this._gsettings.get_int('switcher-popup-mid-click-in');
    }

    set switcherPopupMidClickIn(int_val) {
        this._gsettings.set_int('switcher-popup-mid-click-in', int_val);
    }


    get switcherPopupPrimClickOut() {
        return this._gsettings.get_int('switcher-popup-prim-click-out');
    }

    set switcherPopupPrimClickOut(int_val) {
        this._gsettings.set_int('switcher-popup-prim-click-out', int_val);
    }

    get switcherPopupSecClickOut() {
        return this._gsettings.get_int('switcher-popup-sec-click-out');
    }

    set switcherPopupSecClickOut(int_val) {
        this._gsettings.set_int('switcher-popup-sec-click-out', int_val);
    }

    get switcherPopupMidClickOut() {
        return this._gsettings.get_int('switcher-popup-mid-click-out');
    }

    set switcherPopupMidClickOut(int_val) {
        this._gsettings.set_int('switcher-popup-mid-click-out', int_val);
    }


    get switcherPopupStatus() {
        return this._gsettings.get_boolean('switcher-popup-status');
    }

    set switcherPopupStatus(bool_val) {
        this._gsettings.set_boolean('switcher-popup-status', bool_val);
    }

    get singleAppPreviewSize() {
        return this._gsettings.get_int('win-switcher-single-prev-size');
    }

    set singleAppPreviewSize(int_val) {
        this._gsettings.set_int('win-switcher-single-prev-size', int_val);
    }


    // window switcher options
    get winSwitcherPopupFilter() {
        return this._gsettings.get_int('win-switcher-popup-filter');
    }

    set winSwitcherPopupFilter(int_val) {
        this._gsettings.set_int('win-switcher-popup-filter', int_val);
    }

    get winSwitcherPopupSorting() {
        return this._gsettings.get_int('win-switcher-popup-sorting');
    }

    set winSwitcherPopupSorting(int_val) {
        this._gsettings.set_int('win-switcher-popup-sorting', int_val);
    }

    get winSwitcherPopupOrder() {
        return this._gsettings.get_int('win-switcher-popup-order');
    }

    set winSwitcherPopupOrder(int_val) {
        this._gsettings.set_int('win-switcher-popup-order', int_val);
    }

    get winSwitcherPopupTitles() {
        return this._gsettings.get_int('win-switcher-popup-titles');
    }

    set winSwitcherPopupTitles(int_val) {
        this._gsettings.set_int('win-switcher-popup-titles', int_val);
    }


    get winSwitcherPopupScrollItem() {
        return this._gsettings.get_int('win-switcher-popup-scroll-item');
    }

    set winSwitcherPopupScrollItem(int_val) {
        this._gsettings.set_int('win-switcher-popup-scroll-item', int_val);
    }

    get winSwitcherPopupPrimClickItem() {
        return this._gsettings.get_int('win-switcher-popup-prim-click-item');
    }

    set winSwitcherPopupPrimClickItem(int_val) {
        this._gsettings.set_int('win-switcher-popup-prim-click-item', int_val);
    }

    get winSwitcherPopupSecClickItem() {
        return this._gsettings.get_int('win-switcher-popup-sec-click-item');
    }

    set winSwitcherPopupSecClickItem(int_val) {
        this._gsettings.set_int('win-switcher-popup-sec-click-item', int_val);
    }

    get winSwitcherPopupMidClickItem() {
        return this._gsettings.get_int('win-switcher-popup-mid-click-item');
    }

    set winSwitcherPopupMidClickItem(int_val) {
        this._gsettings.set_int('win-switcher-popup-mid-click-item', int_val);
    }

    get winMinimizedToEnd() {
        return this._gsettings.get_boolean('win-switch-minimized-to-end');
    }

    set winMinimizedToEnd(bool_val) {
        this._gsettings.set_boolean('win-switch-minimized-to-end', bool_val);
    }

    get winMarkMinimized() {
        return this._gsettings.get_boolean('win-switch-mark-minimized');
    }

    set winMarkMinimized(bool_val) {
        this._gsettings.set_boolean('win-switch-mark-minimized', bool_val);
    }

    get winSkipMinimized() {
        return this._gsettings.get_boolean('win-switch-skip-minimized');
    }

    set winSkipMinimized(bool_val) {
        this._gsettings.set_boolean('win-switch-skip-minimized', bool_val);
    }

    get winSwitcherPopupWsIndexes() {
        return this._gsettings.get_boolean('win-switcher-popup-ws-indexes');
    }

    set winSwitcherPopupWsIndexes(bool_val) {
        this._gsettings.set_boolean('win-switcher-popup-ws-indexes', bool_val);
    }

    get winSwitcherPopupSearchApps() {
        return this._gsettings.get_boolean('win-switcher-popup-search-apps');
    }

    set winSwitcherPopupSearchApps(bool_val) {
        this._gsettings.set_boolean('win-switcher-popup-search-apps', bool_val);
    }

    get winSwitcherPopupSearchAll() {
        return this._gsettings.get_boolean('win-switcher-popup-search-all');
    }

    set winSwitcherPopupSearchAll(bool_val) {
        this._gsettings.set_boolean('win-switcher-popup-search-all', bool_val);
    }

    get winSwitcherPopupPreviewSize() {
        return this._gsettings.get_int('win-switcher-popup-preview-size');
    }

    set winSwitcherPopupPreviewSize(int_val) {
        this._gsettings.set_int('win-switcher-popup-preview-size', int_val);
    }

    get winSwitcherPopupIconSize() {
        return this._gsettings.get_int('win-switcher-popup-icon-size');
    }

    set winSwitcherPopupIconSize(int_val) {
        this._gsettings.set_int('win-switcher-popup-icon-size', int_val);
    }

    // app switcher options
    get appSwitcherPopupFilter() {
        return this._gsettings.get_int('app-switcher-popup-filter');
    }

    set appSwitcherPopupFilter(int_val) {
        this._gsettings.set_int('app-switcher-popup-filter', int_val);
    }

    get appSwitcherPopupSorting() {
        return this._gsettings.get_int('app-switcher-popup-sorting');
    }

    set appSwitcherPopupSorting(int_val) {
        this._gsettings.set_int('app-switcher-popup-sorting', int_val);
    }

    get appSwitcherPopupRaiseFirstOnly() {
        return this._gsettings.get_boolean('app-switcher-popup-raise-first-only');
    }

    set appSwitcherPopupRaiseFirstOnly(bool_val) {
        this._gsettings.set_boolean('app-switcher-popup-raise-first-only', bool_val);
    }

    get appSwitcherPopupSearchPrefRunning() {
        return this._gsettings.get_boolean('app-switcher-popup-search-pref-running');
    }

    set appSwitcherPopupSearchPrefRunning(bool_val) {
        this._gsettings.set_boolean('app-switcher-popup-search-pref-running', bool_val);
    }

    get appSwitcherPopupResultsLimit() {
        return this._gsettings.get_int('app-switcher-popup-results-limit');
    }

    set appSwitcherPopupResultsLimit(int_val) {
        this._gsettings.set_int('app-switcher-popup-results-limit', int_val);
    }

    get appSwitcherPopupIconSize() {
        return this._gsettings.get_int('app-switcher-popup-icon-size');
    }

    set appSwitcherPopupIconSize(int_val) {
        this._gsettings.set_int('app-switcher-popup-icon-size', int_val);
    }

    get appSwitcherPopupFavMru() {
        return this._gsettings.get_boolean('app-switcher-popup-fav-mru');
    }

    set appSwitcherPopupFavMru(bool_val) {
        this._gsettings.set_boolean('app-switcher-popup-fav-mru', bool_val);
    }

    get appSwitcherPopupFavoriteApps() {
        return this._gsettings.get_boolean('app-switcher-popup-fav-apps');
    }

    set appSwitcherPopupFavoriteApps(bool_val) {
        this._gsettings.set_boolean('app-switcher-popup-fav-apps', bool_val);
    }

    get appSwitcherPopupWinCounter() {
        return this._gsettings.get_boolean('app-switcher-popup-win-counter');
    }

    set appSwitcherPopupWinCounter(bool_val) {
        this._gsettings.set_boolean('app-switcher-popup-win-counter', bool_val);
    }

    get appSwitcherPopupTitles() {
        return this._gsettings.get_boolean('app-switcher-popup-titles');
    }

    set appSwitcherPopupTitles(bool_val) {
        this._gsettings.set_boolean('app-switcher-popup-titles', bool_val);
    }

    get appSwitcherPopupScrollItem() {
        return this._gsettings.get_int('app-switcher-popup-scroll-item');
    }

    set appSwitcherPopupScrollItem(int_val) {
        this._gsettings.set_int('app-switcher-popup-scroll-item', int_val);
    }

    get appSwitcherPopupPrimClickItem() {
        return this._gsettings.get_int('app-switcher-popup-prim-click-item');
    }

    set appSwitcherPopupPrimClickItem(int_val) {
        this._gsettings.set_int('app-switcher-popup-prim-click-item', int_val);
    }

    get appSwitcherPopupSecClickItem() {
        return this._gsettings.get_int('app-switcher-popup-sec-click-item');
    }

    set appSwitcherPopupSecClickItem(int_val) {
        this._gsettings.set_int('app-switcher-popup-sec-click-item', int_val);
    }

    get appSwitcherPopupMidClickItem() {
        return this._gsettings.get_int('app-switcher-popup-mid-click-item');
    }

    set appSwitcherPopupMidClickItem(int_val) {
        this._gsettings.set_int('app-switcher-popup-mid-click-item', int_val);
    }


    // workspace switcher options
    get wsSwitchIgnoreLast() {
        return this._gsettings.get_boolean('ws-switch-ignore-last');
    }

    set wsSwitchIgnoreLast(bool_val) {
        this._gsettings.set_boolean('ws-switch-ignore-last', bool_val);
    }

    get wsSwitchWrap() {
        return this._gsettings.get_boolean('ws-switch-wrap');
    }

    set wsSwitchWrap(bool_val) {
        this._gsettings.set_boolean('ws-switch-wrap', bool_val);
    }

    get wsSwitchPopup() {
        return this._gsettings.get_boolean('ws-switch-popup');
    }

    set wsSwitchPopup(bool_val) {
        this._gsettings.set_boolean('ws-switch-popup', bool_val);
    }

    /*    get wsSwitchIndicatorMode() {
        return this._gsettings.get_int('ws-switch-indicator-mode');
    }
    set wsSwitchIndicatorMode(mode) {
        this._gsettings.set_int('ws-switch-indicator-mode', mode);
    }
*/
    // options for external trigger
    get switcherPopupPointer() {
        return this._gsettings.get_boolean('switcher-popup-pointer');
    }

    set switcherPopupPointer(bool_val) {
        this._gsettings.set_boolean('switcher-popup-pointer', bool_val);
    }

    get switcherPopupReverseAuto() {
        return this._gsettings.get_boolean('switcher-popup-reverse-auto');
    }

    set switcherPopupReverseAuto(bool_val) {
        this._gsettings.set_boolean('switcher-popup-reverse-auto', bool_val);
    }

    get switcherPopupPointerTimeout() {
        return this._gsettings.get_int('switcher-popup-pointer-timeout');
    }

    set switcherPopupPointerTimeout(int_val) {
        this._gsettings.set_int('switcher-popup-pointer-timeout', int_val);
    }

    get switcherPopupActivateOnHide() {
        return this._gsettings.get_boolean('switcher-popup-activate-on-hide');
    }

    set switcherPopupActivateOnHide(bool_val) {
        this._gsettings.set_boolean('switcher-popup-activate-on-hide', bool_val);
    }

    // thumbnails options
    get winThumbnailScale() {
        return this._gsettings.get_int('win-thumbnail-scale');
    }

    set winThumbnailScale(int_val) {
        this._gsettings.set_int('win-thumbnail-scale', int_val);
    }



    // Hotkeys
    get hotkeySwitchFilter() {
        return this._gsettings.get_string('hotkey-switch-filter');
    }

    set hotkeySwitchFilter(string) {
        this._gsettings.set_string('hotkey-switch-filter', string);
    }

    get hotkeySingleApp() {
        return this._gsettings.get_string('hotkey-single-app');
    }

    set hotkeySingleApp(string) {
        this._gsettings.set_string('hotkey-single-app', string);
    }

    get hotkeyCloseQuit() {
        return this._gsettings.get_string('hotkey-close-quit');
    }

    set hotkeyCloseQuit(string) {
        this._gsettings.set_string('hotkey-close-quit', string);
    }

    get hotkeySearch() {
        return this._gsettings.get_string('hotkey-search');
    }

    set hotkeySearch(string) {
        this._gsettings.set_string('hotkey-search', string);
    }

    get hotkeyNewWin() {
        return this._gsettings.get_string('hotkey-new-win');
    }

    set hotkeyNewWin(string) {
        this._gsettings.set_string('hotkey-new-win', string);
    }

    get hotkeyMoveWinToMonitor() {
        return this._gsettings.get_string('hotkey-move-win-to-monitor');
    }

    set hotkeyMoveWinToMonitor(string) {
        this._gsettings.set_string('hotkey-move-win-to-monitor', string);
    }

    get hotkeyAbove() {
        return this._gsettings.get_string('hotkey-above');
    }

    set hotkeyAbove(string) {
        this._gsettings.set_string('hotkey-above', string);
    }

    get hotkeySticky() {
        return this._gsettings.get_string('hotkey-sticky');
    }

    set hotkeySticky(string) {
        this._gsettings.set_string('hotkey-sticky', string);
    }

    get hotkeyCloseAllApp() {
        return this._gsettings.get_string('hotkey-close-all-app');
    }

    set hotkeyCloseAllApp(string) {
        this._gsettings.set_string('hotkey-close-all-app', string);
    }

    get hotkeyFsOnNewWs() {
        return this._gsettings.get_string('hotkey-fs-on-new-ws');
    }

    set hotkeyFsOnNewWs(string) {
        this._gsettings.set_string('hotkey-fs-on-new-ws', string);
    }

    get hotkeyMaximize() {
        return this._gsettings.get_string('hotkey-maximize');
    }

    set hotkeyMaximize(string) {
        this._gsettings.set_string('hotkey-maximize', string);
    }

    get hotkeyGroupWs() {
        return this._gsettings.get_string('hotkey-group-ws');
    }

    set hotkeyGroupWs(string) {
        this._gsettings.set_string('hotkey-group-ws', string);
    }

    get hotkeySwitcherMode() {
        return this._gsettings.get_string('hotkey-switcher-mode');
    }

    set hotkeySwitcherMode(string) {
        this._gsettings.set_string('hotkey-switcher-mode', string);
    }

    get hotkeyThumbnail() {
        return this._gsettings.get_string('hotkey-thumbnail');
    }

    set hotkeyThumbnail(string) {
        this._gsettings.set_string('hotkey-thumbnail', string);
    }

    get hotkeyPrefs() {
        return this._gsettings.get_string('hotkey-prefs');
    }

    set hotkeyPrefs(string) {
        this._gsettings.set_string('hotkey-prefs', string);
    }

    get hotkeyLeft() {
        return this._gsettings.get_string('hotkey-left');
    }

    set hotkeyLeft(string) {
        this._gsettings.set_string('hotkey-left', string);
    }

    get hotkeyDown() {
        return this._gsettings.get_string('hotkey-down');
    }

    set hotkeyDown(string) {
        this._gsettings.set_string('hotkey-down', string);
    }

    get hotkeyUp() {
        return this._gsettings.get_string('hotkey-up');
    }

    set hotkeyUp(string) {
        this._gsettings.set_string('hotkey-up', string);
    }

    get hotkeyRight() {
        return this._gsettings.get_string('hotkey-right');
    }

    set hotkeyRight(string) {
        this._gsettings.set_string('hotkey-right', string);
    }
};

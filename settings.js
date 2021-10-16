/* Copyright 2021 GdH <https://github.com/G-dH>
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
'use strict';

const {GLib, Gio} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const Config = imports.misc.config;
var   shellVersion = Config.PACKAGE_VERSION;

const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
var _ = Gettext.gettext;

const _schema = 'org.gnome.shell.extensions.advanced-alt-tab-window-switcher';
const _path = '/org/gnome/shell/extensions/advanced-alt-tab-window-switcher';

var Actions = {
    NOTHING:           0,
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
    KILL:             15,
    NEW_WINDOW:       16,
    PREFS:            99,
};

var MscOptions = class MscOptions {
    constructor() {
        this._gsettings = this._loadSettings();
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

    _loadSettings(schm) {
        const schema = `${_schema}`;
        const path = `${_path}/`;
        return getSettings(schema, path);
    }

    // common options
    get switcherPopupPosition() {
        return this._gsettings.get_int('switcher-popup-position');
    }

    set switcherPopupPosition(int_val) {
        this._gsettings.set_int('switcher-popup-position', int_val);
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

    get switcherPopupShowImmediately() {
        return this._gsettings.get_boolean('switcher-popup-show-immediately');
    }

    set switcherPopupShowImmediately(bool_val) {
        this._gsettings.set_boolean('switcher-popup-show-immediately', bool_val);
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



    get switcherPopupInfo() {
        return this._gsettings.get_boolean('switcher-popup-info');
    }

    set switcherPopupInfo(bool_val) {
        this._gsettings.set_boolean('switcher-popup-info', bool_val);
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

    get wsSwitchIndicator() {
        return this._gsettings.get_boolean('ws-switch-indicator');
    }

    set wsSwitchIndicator(bool_val) {
        this._gsettings.set_boolean('ws-switch-indicator', bool_val);
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

/*    getKeyBind(key) {
        return this._gsettingsKB.get_strv(key);
    }
    setKeyBind(key, value) {
        this._gsettingsKB.set_strv(key, value);
    }*/
};

/**
 * Copied from Gnome Shells extensionUtils.js and adapted to allow
 * loading the setting with a specific path.
 */
function getSettings(schema, path) {
    const schemaDir = Me.dir.get_child('schemas');
    let schemaSource;
    if (schemaDir.query_exists(null)) {
        schemaSource = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir.get_path(),
            Gio.SettingsSchemaSource.get_default(),
            false
        );
    } else {
        schemaSource = Gio.SettingsSchemaSource.get_default();
    }

    const schemaObj = schemaSource.lookup(schema, true);
    if (!schemaObj) {
        throw new Error(
            `Schema${schema} could not be found for extension ${
                Me.metadata.uuid}. Please check your installation.`
        );
    }

    const args = {settings_schema: schemaObj};
    if (path)
        args.path = path;


    return new Gio.Settings(args);
}

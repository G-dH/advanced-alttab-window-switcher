/* This is a part of Custom Hot Corners - Extended, the Gnome Shell extension*
 * Copyright 2020 Jan Runge <janrunx@gmail.com>
 * Copyright 2021 GdH <https://github.com/G-dH>
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

    get winSkipMinimized() {
        return this._gsettings.get_boolean('win-switch-skip-minimized');
    }
    set winSkipMinimized(bool_val) {
        this._gsettings.set_boolean('win-switch-skip-minimized', bool_val);
    }
    get winThumbnailScale() {
        return this._gsettings.get_int('win-thumbnail-scale');
    }
    set winThumbnailScale(scale) {
        this._gsettings.set_int('win-thumbnail-scale', scale);
    }
    get winSwitcherPopupTimeout() {
        return this._gsettings.get_int('win-switcher-popup-timeout');
    }
    set winSwitcherPopupTimeout(timeout) {
        this._gsettings.set_int('win-switcher-popup-timeout', timeout);
    }
    get winSwitcherPopupPointerTimeout() {
        return this._gsettings.get_int('win-switcher-popup-pointer-timeout');
    }
    set winSwitcherPopupPointerTimeout(timeout) {
        this._gsettings.set_int('win-switcher-popup-pointer-timeout', timeout);
    }
    get winSwitcherPopupShowImmediately() {
        return this._gsettings.get_boolean('win-switcher-popup-show-immediately');
    }
    set winSwitcherPopupShowImmediately(bool_val) {
        this._gsettings.set_boolean('win-switcher-popup-show-immediately', bool_val);
    }
    get winSwitcherPopupStartSearch() {
        return this._gsettings.get_boolean('win-switcher-popup-start-search');
    }
    set winSwitcherPopupStartSearch(bool_val) {
        this._gsettings.set_boolean('win-switcher-popup-start-search', bool_val);
    }
    get winSwitcherPopupPosition() {
        return this._gsettings.get_int('win-switcher-popup-position');
    }
    set winSwitcherPopupPosition(position) {
        this._gsettings.set_int('win-switcher-popup-position', position);
    }
    get winSwitcherPopupPointer() {
        return this._gsettings.get_boolean('win-switcher-popup-pointer');
    }
    set winSwitcherPopupPointer(bool_val) {
        this._gsettings.set_boolean('win-switcher-popup-pointer', bool_val);
    }
    get winSwitcherPopupWsIndexes() {
        return this._gsettings.get_boolean('win-switcher-popup-ws-indexes');
    }
    set winSwitcherPopupWsIndexes(bool_val) {
        this._gsettings.set_boolean('win-switcher-popup-ws-indexes', bool_val);
    }
    get winSwitcherPopupHotKeys() {
        return this._gsettings.get_boolean('win-switcher-popup-hot-keys');
    }
    set winSwitcherPopupHotKeys(bool_val) {
        this._gsettings.set_boolean('win-switcher-popup-hot-keys', bool_val);
    }
    get winSwitcherPopupWinFilter() {
        return this._gsettings.get_int('win-switcher-popup-win-filter');
    }
    set winSwitcherPopupWinFilter(filterMode) {
        this._gsettings.set_int('win-switcher-popup-win-filter', filterMode);
    }
    get winSwitcherPopupWinOrder() {
        return this._gsettings.get_int('win-switcher-popup-win-order');
    }
    set winSwitcherPopupWinOrder(orderMode) {
        this._gsettings.set_int('win-switcher-popup-win-order', orderMode);
    }
    get winSwitcherPopupWinSorting() {
        return this._gsettings.get_int('win-switcher-popup-win-sorting');
    }
    set winSwitcherPopupWinSorting(sorting_mode) {
        this._gsettings.set_int('win-switcher-popup-win-sorting', sorting_mode);
    }
    get winSwitcherPopupSize() {
        return this._gsettings.get_int('win-switcher-popup-size');
    }
    set winSwitcherPopupSize(size) {
        this._gsettings.set_int('win-switcher-popup-size', size);
    }
    get winSwitcherPopupIconSize() {
        return this._gsettings.get_int('win-switcher-popup-icon-size');
    }
    set winSwitcherPopupIconSize(size) {
        this._gsettings.set_int('win-switcher-popup-icon-size', size);
    }
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
    get wsSwitchIndicatorMode() {
        return this._gsettings.get_int('ws-switch-indicator-mode');
    }
    set wsSwitchIndicatorMode(mode) {
        this._gsettings.set_int('ws-switch-indicator-mode', mode);
    }
    get winSwitcherPopupSearchAll() {
        return this._gsettings.get_boolean('win-switcher-popup-search-all');
    }
    set winSwitcherPopupSearchAll(bool_val) {
        this._gsettings.set_boolean('win-switcher-popup-search-all', bool_val);
    }
/*    getKeyBind(key) {
        return this._gsettingsKB.get_strv(key);
    }
    setKeyBind(key, value) {
        this._gsettingsKB.set_strv(key, value);
    }*/
}

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
            'Schema' + schema + ' could not be found for extension ' +
            Me.metadata.uuid + '. Please check your installation.'
        );
    }

    const args = { settings_schema: schemaObj };
    if (path) {
        args.path = path;
    }

    return new Gio.Settings(args);
}

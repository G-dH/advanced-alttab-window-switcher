/* Copyright 2021 GdH <https://github.com/G-dH>
 *
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

const GLib                   = imports.gi.GLib;

const Main                   = imports.ui.main;
const AltTab                 = imports.ui.altTab;

const ExtensionUtils         = imports.misc.extensionUtils;
const Me                     = ExtensionUtils.getCurrentExtension();
const Settings               = Me.imports.settings;
const WindowSwitcherPopup    = Me.imports.windowSwitcherPopup;

let enabled                  = false;
let _origAltTabWSP;
let _origAltTabASP;

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

function enable() {
    GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        500,
        () => {
            if (enabled)
                _resumeThumbnailsIfExist();

            _origAltTabWSP = AltTab.WindowSwitcherPopup;
            _origAltTabASP = AltTab.AppSwitcherPopup;
            AltTab.WindowSwitcherPopup = WindowSwitcherPopup.WindowSwitcherPopup;
            AltTab.AppSwitcherPopup    = WindowSwitcherPopup.AppSwitcherPopup;
            enabled = true;
        }
    );
}

function disable() {
    if (_extensionEnabled()) {
        _removeThumbnails(false);
    } else {
        _removeThumbnails();
        enabled = false;
    }

    AltTab.WindowSwitcherPopup = _origAltTabWSP;
    AltTab.AppSwitcherPopup    = _origAltTabASP;
    _origAltTabWSP = null;
    _origAltTabASP = null;

    if (global.stage.windowThumbnails)
        global.stage.windowThumbnails = undefined;
}

function _resumeThumbnailsIfExist() {
    if (global.stage.windowThumbnails) {
        global.stage.windowThumbnails.forEach(
            t => {
                if (t)
                    t.show();
            }
        );
    }
}

function _removeThumbnails(full = true) {
    if (full) {
        if (global.stage.windowThumbnails) {
            global.stage.windowThumbnails.forEach(
                t => {
                    if (t)
                        t.destroy();
                }
            );
            global.stage.windowThumbnails = undefined;
        }
    } else if (global.stage.windowThumbnails) {
        global.stage.windowThumbnails.forEach(
            t => {
                if (t)
                    t.hide();
            }
        );
    }
}

function _extensionEnabled() {
    const shellSettings = Settings.getSettings(
        'org.gnome.shell',
        '/org/gnome/shell/');
    let enabled = shellSettings.get_strv('enabled-extensions');
    enabled = enabled.indexOf(Me.metadata.uuid) > -1;
    let disabled = shellSettings.get_strv('disabled-extensions');
    disabled = disabled.indexOf(Me.metadata.uuid) > -1;
    let disableUser = shellSettings.get_boolean('disable-user-extensions');

    if (enabled && !disabled && !disableUser)
        return true;
    return false;
}


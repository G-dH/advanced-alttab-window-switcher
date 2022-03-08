/* Copyright 2021-2022 GdH <https://github.com/G-dH>
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

const { GObject, GLib, Gio }    = imports.gi;

const Main                 = imports.ui.main;
const AltTab               = imports.ui.altTab;

const ExtensionUtils       = imports.misc.extensionUtils;
const Me                   = ExtensionUtils.getCurrentExtension();
const Settings             = Me.imports.settings;
const WindowSwitcherPopup  = Me.imports.windowSwitcherPopup;
const Actions              = Me.imports.actions;

let _delayId;
let enabled = false;
let _options;
let _origAltTabWSP;
let _origAltTabASP;
let _originalOverlayKeyHandlerId = null;
let _signalOverlayKey = null;
let _wmFocusToActiveHandlerId = 0;

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
}

function enable() {
    _delayId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        300,
        () => {
            _delayId = 0;
            if (enabled) {
                let actions = new Actions.Actions();
                actions.resumeThumbnailsIfExist();
                actions = undefined;
            }
            _options = new Settings.MscOptions();
            WindowSwitcherPopup.options = _options;
            _options.connect('changed::super-key-mode', _updateOverlayKeyHandler);
            _origAltTabWSP = AltTab.WindowSwitcherPopup;
            _origAltTabASP = AltTab.AppSwitcherPopup;
            AltTab.WindowSwitcherPopup = WindowSwitcherPopup.WindowSwitcherPopup;
            AltTab.AppSwitcherPopup = WindowSwitcherPopup.AppSwitcherPopup;

            if (_options.superKeyMode > 1) {
                _updateOverlayKeyHandler();
            }

            if(_options.wmAlwaysActivateFocused) {
                _wmFocusToActiveHandlerId = global.display.connect('notify::focus-window', ()=>{
                    let win = global.display.get_focus_window();
                    if (win) {
                        Main.activateWindow(win);
                    }
                });
            }
            _options.connect('changed::wm-always-activate-focused', _updateAlwaysActivateFocusedConnection);

            enabled = true;
            _delayId = 0;
            return GLib.SOURCE_REMOVE;
        }
    );
}

function disable() {
    if (_wmFocusToActiveHandlerId) {
        global.display.disconnect(_wmFocusToActiveHandlerId);
    }
    if (global.advancedWindowSwitcher) {
        global.advancedWindowSwitcher.destroy();
        global.advancedWindowSwitcher = null;
    }
    if (_delayId)
        GLib.source_remove(_delayId);

    let actions;
    if (global.stage.windowThumbnails) {
        actions = new Actions.Actions();
    }
    if (_extensionEnabled()) {
        const hide = true;
        _removeThumbnails(hide);
    } else {
        _removeThumbnails();
        enabled = false;
    }

    if (_origAltTabWSP)
        AltTab.WindowSwitcherPopup = _origAltTabWSP;
    if (_origAltTabASP)
        AltTab.AppSwitcherPopup = _origAltTabASP;
    _origAltTabWSP = null;
    _origAltTabASP = null;
    _restoreOverlayKeyHandler();
    WindowSwitcherPopup.options = null;
    _options = null;
}

function _removeThumbnails(hide = false) {
    if (!global.stage.windowThumbnails) return;

    let actions = new Actions.Actions();

    if (hide)
        actions.hideThumbnails();
    else
        actions.removeThumbnails();

    actions.clean();
    actions = undefined;
}

function _updateAlwaysActivateFocusedConnection() {
    if (_options.wmAlwaysActivateFocused && !_wmFocusToActiveHandlerId) {
        _wmFocusToActiveHandlerId = global.display.connect('notify::focus-window', ()=>{
            let win = global.display.get_focus_window();
            if (win) Main.activateWindow(win);
        });
    } else if (_wmFocusToActiveHandlerId) {
        global.display.disconnect(_wmFocusToActiveHandlerId);
        _wmFocusToActiveHandlerId = 0;
    }
}

function _updateOverlayKeyHandler() {
    // Block original overlay key handler
    _restoreOverlayKeyHandler();

    if (_options.superKeyMode === 1) {
        return;
    }

    _originalOverlayKeyHandlerId = GObject.signal_handler_find(global.display, { signalId: "overlay-key" });
    if (_originalOverlayKeyHandlerId !== null) {
        global.display.block_signal_handler(_originalOverlayKeyHandlerId);
    }

    // Connect modified overlay key handler
    let _a11ySettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.keyboard' });
    _signalOverlayKey = global.display.connect("overlay-key", () => {
        if (_a11ySettings.get_boolean('stickykeys-enable'))
            return;

        _toggleSwitcher();
    });
}

function _restoreOverlayKeyHandler() {
    // Disconnect modified overlay key handler
    if (_signalOverlayKey !== null) {
        global.display.disconnect(_signalOverlayKey);
        _signalOverlayKey = null;
    }

    // Unblock original overlay key handler
    if (_originalOverlayKeyHandlerId !== null) {
        global.display.unblock_signal_handler(_originalOverlayKeyHandlerId);
        _originalOverlayKeyHandlerId = null;
    }
}

function _toggleSwitcher() {
    let altTabPopup = new WindowSwitcherPopup.WindowSwitcherPopup();
    const appSwitcherMode = _options.superKeyMode === 2;
    altTabPopup._switcherMode = appSwitcherMode ? 1 : 0;
    altTabPopup.SHOW_APPS = appSwitcherMode ? true : false;
    altTabPopup.KEYBOARD_TRIGGERED = false;
    altTabPopup.NO_MODS_TIMEOUT = 5000;
    altTabPopup._modifierMask = 0;
    altTabPopup.POSITION_POINTER = false;
    altTabPopup.connect('destroy', () => altTabPopup = null);
    altTabPopup.show();
}

function _extensionEnabled() {
    const shellSettings = ExtensionUtils.getSettings('org.gnome.shell');
    let enabled = shellSettings.get_strv('enabled-extensions');
    enabled = enabled.indexOf(Me.metadata.uuid) > -1;
    let disabled = shellSettings.get_strv('disabled-extensions');
    disabled = disabled.indexOf(Me.metadata.uuid) > -1;
    let disableUser = shellSettings.get_boolean('disable-user-extensions');

    if (enabled && !disabled && !disableUser)
        return true;
    return false;
}

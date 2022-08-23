/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * Extension
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2022
 * @license    GPL-3.0
 */

'use strict';

const { GObject, GLib, Gio, Meta, Shell }    = imports.gi;

const Main                 = imports.ui.main;
const AltTab               = imports.ui.altTab;
const Layout                 = imports.ui.layout;

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
let _monitorsChangedSigId = 0;
let _monitorsChangedDelayId = 0;
let _pressureBarriers = null;

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
            _options = new Settings.Options();
            WindowSwitcherPopup.options = _options;
            //_options.connect('changed::super-key-mode', _updateOverlayKeyHandler);
            _options.connect('changed', _updateSettings);
            _origAltTabWSP = AltTab.WindowSwitcherPopup;
            _origAltTabASP = AltTab.AppSwitcherPopup;
            AltTab.WindowSwitcherPopup = WindowSwitcherPopup.WindowSwitcherPopup;
            AltTab.AppSwitcherPopup = WindowSwitcherPopup.AppSwitcherPopup;

            if (_options.get('superKeyMode') > 1) {
                _updateOverlayKeyHandler();
            }

            if(_options.get('wmAlwaysActivateFocused')) {
                _wmFocusToActiveHandlerId = global.display.connect('notify::focus-window', ()=>{
                    if (Main.overview._shown) return;
                    let win = global.display.get_focus_window();
                    if (win) {
                        Main.activateWindow(win);
                    }
                });
            }
            _options.connect('changed::wm-always-activate-focused', _updateAlwaysActivateFocusedConnection);

            _updateHotTrigger();

            log(`${Me.metadata.name}: enabled`);
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

    _removePressureBarrier();

    _options = null;
    log(`${Me.metadata.name}: disabled`);
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
    if (_options.get('wmAlwaysActivateFocused', true) && !_wmFocusToActiveHandlerId) {
        _wmFocusToActiveHandlerId = global.display.connect('notify::focus-window', ()=>{
            let win = global.display.get_focus_window();
            if (win) Main.activateWindow(win);
        });
    } else if (_wmFocusToActiveHandlerId) {
        global.display.disconnect(_wmFocusToActiveHandlerId);
        _wmFocusToActiveHandlerId = 0;
    }
}

function _updateSettings(settings, key) {
    if (key == 'super-key-mode') {
        _updateOverlayKeyHandler();
    }

    if (key == 'hot-edge-position' || key == 'hot-edge-monitor') {
        _updateHotTrigger();
    }

}

function _updateOverlayKeyHandler() {
    // Block original overlay key handler
    _restoreOverlayKeyHandler();

    if (_options.get('superKeyMode', true) === 1) {
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

function _toggleSwitcher(mouseTriggerred = false) {
    const altTabPopup = new WindowSwitcherPopup.WindowSwitcherPopup();
    if (mouseTriggerred) {
        altTabPopup.KEYBOARD_TRIGGERED = false;
        altTabPopup.POPUP_POSITION = _options.get('hotEdgePosition') == 1 ? 1 : 3; // 1-top, 2-bottom > 1-top, 2-center, 3-bottom
        const appSwitcherMode = _options.get('hotEdgeMode') == 0;
        altTabPopup.SHOW_APPS = appSwitcherMode ? true : false;
        altTabPopup._switcherMode = appSwitcherMode ? 1 : 0;
        altTabPopup._monitorIndex = global.display.get_current_monitor();
    } else {
        const appSwitcherMode = _options.get('superKeyMode') === 2;
        altTabPopup._switcherMode = appSwitcherMode ? 1 : 0;
        altTabPopup.SHOW_APPS = appSwitcherMode ? true : false;
        altTabPopup._overlayKeyTriggered = true;
    }
    altTabPopup._modifierMask = 0;
    altTabPopup.POSITION_POINTER = false;
    altTabPopup.show();
}

function _updateHotTrigger() {
    _removePressureBarrier();

    const position = _options.get('hotEdgePosition', true);

    if (!position) return;

    _pressureBarriers = [];
    const primaryMonitor = global.display.get_primary_monitor();

    for (let i = 0; i < Main.layoutManager.monitors.length; ++i) {
        if (!_options.get('hotEdgeMonitor', true) && i != primaryMonitor)
            continue;
        // Use code of parent class to remove old barriers but new barriers
        // must be created here since the properties are construct only.
        //super.setBarrierSize(0);
        const geometry = global.display.get_monitor_geometry(i);
        const BD = Meta.BarrierDirection;
            // for X11 session:
            //  right vertical and bottom horizontal pointer barriers must be 1px further to match the screen edge
            // ...because barriers are actually placed between pixels, along the top/left edge of the addressed pixels
            // ...Wayland behave differently and addressed pixel means the one behind which pointer can't go
            // but avoid barriers that are at the same position
            // ...and block opposite directions. Neither with X nor with Wayland
            // ...such barriers work.

        const offset = 100;
        const x1 = geometry.x + offset;
        const x2 = geometry.x + geometry.width - offset;
        let y = position == 1 ? geometry.y : geometry.y + geometry.height;
        y -= Meta.is_wayland_compositor() ? 1 : 0;

        const horizontalBarrier = new Meta.Barrier({
            display: global.display,
            x1,
            x2,
            y1: y,
            y2: y,
            directions: position == 1 ? BD.POSITIVE_Y : BD.NEGATIVE_Y
        });

        const pressureBarrier = new Layout.PressureBarrier(
            100, // pressure treshold
            Layout.HOT_CORNER_PRESSURE_TIMEOUT,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW
        );

        pressureBarrier.connect('trigger', _onPressureTriggered);
        pressureBarrier.addBarrier(horizontalBarrier);

        _pressureBarriers.push([pressureBarrier, horizontalBarrier]);
        if (!_monitorsChangedSigId)
            _monitorsChangedSigId = Main.layoutManager.connect('monitors-changed', () => {
                // avoid unnecessary executions, the singnal is being emmitted miltiple times
                if (!_monitorsChangedDelayId) {
                    _monitorsChangedDelayId = GLib.timeout_add_seconds(
                        GLib.PRIORITY_DEFAULT,
                        1,
                        () => {
                            _updateHotTrigger();
                            _monitorsChangedDelayId = 0;
                            return GLib.SOURCE_REMOVE;
                        }
                    );
                }
                return GLib.SOURCE_CONTINUE;
            });
    }
}

function _removePressureBarrier() {
    if (_pressureBarriers !== null) {
        _pressureBarriers.forEach(barrier => {
            barrier[0].removeBarrier(barrier[1]);
            barrier[1].destroy();
            barrier[0].destroy();
        });

        _pressureBarriers = null;
    }

    if (_monitorsChangedSigId) {
        Main.layoutManager.disconnect(_monitorsChangedSigId);
        _monitorsChangedSigId = 0;
    }
    if (_monitorsChangedDelayId) {
        GLib.source_remove(_monitorsChangedDelayId);
        _monitorsChangedDelayId = 0;
    }
}

function _onPressureTriggered (){
    _toggleSwitcher(true);
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

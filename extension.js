/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * Extension
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2023
 * @license    GPL-3.0
 */

'use strict';

const { GObject, GLib, Gio, Meta, Shell }    = imports.gi;

const Main                 = imports.ui.main;
const AltTab               = imports.ui.altTab;
const Layout                 = imports.ui.layout;

const ExtensionUtils       = imports.misc.extensionUtils;
const Me                   = ExtensionUtils.getCurrentExtension();
const Settings             = Me.imports.src.settings;
const WindowSwitcherPopup  = Me.imports.src.windowSwitcherPopup;
const Actions              = Me.imports.src.actions;


function init(me) {
    // me === Me
    ExtensionUtils.initTranslations(me.metadata['gettext-domain']);
    return new AATWS(me);
}

class AATWS {
    constructor(me) {
        this._metadata = me.metadata;
        this._originalOverlayKeyHandlerId = null;
        this._signalOverlayKey = null;
        this._wmFocusToActiveHandlerId = 0;
        this._monitorsChangedConId = 0;
        this._monitorsChangedDelayId = 0;
        this._pressureBarriers = null;
        this._actions = null;
    }

    enable() {
        this._opt = new Settings.Options();
        WindowSwitcherPopup.opt = this._opt;

        if (!this._actions)
            this._actions = new Actions.Actions(this._opt);
        else
            this._actions.resumeThumbnailsIfExist();
        WindowSwitcherPopup.actions = this._actions;

        // this._opt.connect('changed::super-key-mode', this._updateOverlayKeyHandler);
        this._opt.connect('changed', this._updateSettings.bind(this));

        this._origAltTabWSP = AltTab.WindowSwitcherPopup;
        this._origAltTabASP = AltTab.AppSwitcherPopup;
        AltTab.WindowSwitcherPopup = WindowSwitcherPopup.WindowSwitcherPopup;
        AltTab.AppSwitcherPopup = WindowSwitcherPopup.AppSwitcherPopup;

        if (this._opt.get('superKeyMode') > 1)
            this._updateOverlayKeyHandler();

        this._updateAlwaysActivateFocusedConnection();
        this._opt.connect('changed::wm-always-activate-focused', this._updateAlwaysActivateFocusedConnection.bind(this));

        this._updateHotTrigger();
        this._updateDashVisibility();
    }

    disable() {
        if (this._wmFocusToActiveHandlerId)
            global.display.disconnect(this._wmFocusToActiveHandlerId);

        if (this.popup) {
            this.popup.destroy();
            this.popup = null;
        }

        if (Main.sessionMode.isLocked && this._extensionEnabled()) {
            this._actions.hideThumbnails();
        } else {
            this._actions.clean();
            this._actions = null;
        }

        if (this._origAltTabWSP)
            AltTab.WindowSwitcherPopup = this._origAltTabWSP;
        if (this._origAltTabASP)
            AltTab.AppSwitcherPopup = this._origAltTabASP;
        this._origAltTabWSP = null;
        this._origAltTabASP = null;
        this._restoreOverlayKeyHandler();
        WindowSwitcherPopup.options = null;

        this._removePressureBarrier();
        this._updateDashVisibility(true);

        this._opt.destroy();
        this._opt = null;
    }

    _updateAlwaysActivateFocusedConnection() {
    // GS 43 activates focused windows immediately by default and this can lead to problems with refocusing window you're switching from
        if (this._opt.get('wmAlwaysActivateFocused', true) && Settings.shellVersion < 43 && !this._wmFocusToActiveHandlerId) {
            this._wmFocusToActiveHandlerId = global.display.connect('notify::focus-window', () => {
                if (!Main.overview._shown) {
                    let win = global.display.get_focus_window();
                    if (win)
                        Main.activateWindow(win);
                }
            });
        } else if (this._wmFocusToActiveHandlerId) {
            global.display.disconnect(this._wmFocusToActiveHandlerId);
            this._wmFocusToActiveHandlerId = 0;
        }
    }

    _updateSettings(settings, key) {
        if (key === 'super-key-mode')
            this._updateOverlayKeyHandler();


        if (key === 'hot-edge-position' || key === 'hot-edge-monitor' ||
        key === 'hot-edge-pressure' || key === 'hot-edge-width')
            this._updateHotTrigger();


        if (key === 'show-dash')
            this._updateDashVisibility();
    }

    _updateDashVisibility(reset) {
        const visible = this._opt.get('showDash', true);
        if (!visible) {
        // pass
        } else if (reset || visible === 1) {
            Main.overview.dash.visible = true;
        } else {
            Main.overview.dash.visible = false;
        }
    }

    _updateOverlayKeyHandler() {
    // Block original overlay key handler
        this._restoreOverlayKeyHandler();

        if (this._opt.get('superKeyMode', true) === 1)
            return;


        this._originalOverlayKeyHandlerId = GObject.signal_handler_find(global.display, { signalId: 'overlay-key' });
        if (this._originalOverlayKeyHandlerId !== null)
            global.display.block_signal_handler(this._originalOverlayKeyHandlerId);


        // Connect modified overlay key handler
        let _a11ySettings = new Gio.Settings({ schema_id: 'org.gnome.desktop.a11y.keyboard' });
        this._signalOverlayKey = global.display.connect('overlay-key', () => {
            if (_a11ySettings.get_boolean('stickykeys-enable'))
                return;
            this._toggleSwitcher();
        });
    }

    _restoreOverlayKeyHandler() {
    // Disconnect modified overlay key handler
        if (this._signalOverlayKey !== null) {
            global.display.disconnect(this._signalOverlayKey);
            this._signalOverlayKey = null;
        }

        // Unblock original overlay key handler
        if (this._originalOverlayKeyHandlerId !== null) {
            global.display.unblock_signal_handler(this._originalOverlayKeyHandlerId);
            this._originalOverlayKeyHandlerId = null;
        }
    }

    _toggleSwitcher(mouseTriggered = false) {
        if (Main.overview._visible)
            return;

        const altTabPopup = new WindowSwitcherPopup.WindowSwitcherPopup();
        if (mouseTriggered) {
            altTabPopup.KEYBOARD_TRIGGERED = false;
            altTabPopup.POPUP_POSITION = this._opt.get('hotEdgePosition') === 1 ? 1 : 3; // 1-top, 2-bottom > 1-top, 2-center, 3-bottom
            const appSwitcherMode = this._opt.get('hotEdgeMode') === 0;
            altTabPopup.SHOW_APPS = !!appSwitcherMode;
            altTabPopup._switcherMode = appSwitcherMode ? 1 : 0;
            altTabPopup._monitorIndex = global.display.get_current_monitor();
        } else {
            altTabPopup.KEYBOARD_TRIGGERED = true;
            const hotEdgePosition = this._opt.get('hotEdgePosition');
            let position = hotEdgePosition ? hotEdgePosition : null;
            if (position)
                altTabPopup.POPUP_POSITION = position === 1 ? 1 : 3;
            const appSwitcherMode = this._opt.get('superKeyMode') === 2;
            altTabPopup._switcherMode = appSwitcherMode ? 1 : 0;
            altTabPopup.SHOW_APPS = !!appSwitcherMode;
            altTabPopup._overlayKeyTriggered = true;
        }
        altTabPopup._modifierMask = 0;
        altTabPopup.POSITION_POINTER = false;
        altTabPopup.show();
    }

    _updateHotTrigger() {
        this._removePressureBarrier();

        const position = this._opt.get('hotEdgePosition', true);

        if (!position)
            return;

        this._pressureBarriers = [];
        const primaryMonitor = global.display.get_primary_monitor();

        for (let i = 0; i < Main.layoutManager.monitors.length; ++i) {
            if (!this._opt.get('hotEdgeMonitor', true) && i !== primaryMonitor)
                continue;
            // Use code of parent class to remove old barriers but new barriers
            // must be created here since the properties are construct only.
            // super.setBarrierSize(0);
            const geometry = global.display.get_monitor_geometry(i);
            const BD = Meta.BarrierDirection;
            // for X11 session:
            //  right vertical and bottom horizontal pointer barriers must be 1px further to match the screen edge
            // ...because barriers are actually placed between pixels, along the top/left edge of the addressed pixels
            // ...Wayland behave differently and addressed pixel means the one behind which pointer can't go
            // but avoid barriers that are at the same position
            // ...and block opposite directions. Neither with X nor with Wayland
            // ...such barriers work.

            const scale = this._opt.get('hotEdgeWidth', true) / 100;
            const offset = Math.round(geometry.width * (1 - scale) / 2);
            const x1 = geometry.x + offset;
            const x2 = geometry.x + geometry.width - offset;
            let y = position === 1 ? geometry.y : geometry.y + geometry.height;
            y -= Meta.is_wayland_compositor() ? 1 : 0;

            const horizontalBarrier = new Meta.Barrier({
                display: global.display,
                x1,
                x2,
                y1: y,
                y2: y,
                directions: position === 1 ? BD.POSITIVE_Y : BD.NEGATIVE_Y,
            });

            const pressureBarrier = new Layout.PressureBarrier(
                this._opt.get('hotEdgePressure', true), // pressure threshold
                Layout.HOT_CORNER_PRESSURE_TIMEOUT,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW
            );

            pressureBarrier.connect('trigger', this._onPressureTriggered.bind(this, Main.layoutManager.monitors[i]));
            pressureBarrier.addBarrier(horizontalBarrier);

            this._pressureBarriers.push([pressureBarrier, horizontalBarrier]);
            if (!this._monitorsChangedConId) {
                this._monitorsChangedConId = Main.layoutManager.connect('monitors-changed', () => {
                    // avoid unnecessary executions, the signal is being emitted multiple times
                    if (!this._monitorsChangedDelayId) {
                        this._monitorsChangedDelayId = GLib.timeout_add_seconds(
                            GLib.PRIORITY_DEFAULT,
                            1,
                            () => {
                                this._updateHotTrigger();
                                this._monitorsChangedDelayId = 0;
                                return GLib.SOURCE_REMOVE;
                            }
                        );
                    }
                    return GLib.SOURCE_CONTINUE;
                });
            }
        }
    }

    _removePressureBarrier() {
        if (this._pressureBarriers !== null) {
            this._pressureBarriers.forEach(barrier => {
                barrier[0].removeBarrier(barrier[1]);
                barrier[1].destroy();
                barrier[0].destroy();
            });

            this._pressureBarriers = null;
        }

        if (this._monitorsChangedConId) {
            Main.layoutManager.disconnect(this._monitorsChangedConId);
            this._monitorsChangedConId = 0;
        }
        if (this._monitorsChangedDelayId) {
            GLib.source_remove(this._monitorsChangedDelayId);
            this._monitorsChangedDelayId = 0;
        }
    }

    _onPressureTriggered(monitor) {
        const fsAllowed = this._opt.get('hotEdgeFullScreen');
        if (!(!fsAllowed && monitor.inFullscreen))
            this._toggleSwitcher(true);
    }

    _extensionEnabled() {
        const shellSettings = ExtensionUtils.getSettings('org.gnome.shell');
        let enabledE = shellSettings.get_strv('enabled-extensions');
        enabledE = enabledE.indexOf(Me.metadata.uuid) > -1;
        let disabledE = shellSettings.get_strv('disabled-extensions');
        disabledE = disabledE.indexOf(Me.metadata.uuid) > -1;
        let disableUser = shellSettings.get_boolean('disable-user-extensions');

        if (enabledE && !disabledE && !disableUser)
            return true;
        return false;
    }
}

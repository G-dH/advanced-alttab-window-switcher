/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * Extension
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2023
 * @license    GPL-3.0
 */

'use strict';

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as AltTab from 'resource:///org/gnome/shell/ui/altTab.js';
import * as Layout from 'resource:///org/gnome/shell/ui/layout.js';

import * as WindowSwitcherPopup from './src/windowSwitcherPopup.js';
import * as Actions from './src/actions.js';
import * as Settings from './src/settings.js';
import * as Util from './src/util.js';
import * as SwitcherList from './src/switcherList.js';
import * as SwitcherItems from './src/switcherItems.js';
import * as WindowMenu from './src/windowMenu.js';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

const HOT_CORNER_PRESSURE_TIMEOUT = 1000; // ms


export default class AATWS extends Extension {
    constructor(metadata) {
        super(metadata);

        this._originalOverlayKeyHandlerId = null;
        this._signalOverlayKey = null;
        this._wmFocusToActiveHandlerId = 0;
        this._monitorsChangedSigId = 0;
        this._monitorsChangedDelayId = 0;
        this._pressureBarriers = null;
    }

    enable() {
        this._options = new Settings.Options(this);

        if (!this._actions)
            this._actions = new Actions.Actions(this._options);
        else
            this._actions.resumeThumbnailsIfExist();

        WindowSwitcherPopup.init(this._options, this);
        SwitcherList.init(this);
        SwitcherItems.init(this);
        WindowMenu.init(this);

        this._overrides = new Util.Overrides();

        this._overrides.addOverride('WindowSwitcherPopup', AltTab.WindowSwitcherPopup.prototype, WindowSwitcherPopup.WindowSwitcherPopup);
        // AppSwitcherPopup is handled by the WindowSwitcherPopup
        this._overrides.addOverride('AppSwitcherPopup', AltTab.AppSwitcherPopup.prototype, WindowSwitcherPopup.WindowSwitcherPopup);
        this._overrides.addOverride('AppSwitcherPopupInit', AltTab.AppSwitcherPopup.prototype, WindowSwitcherPopup.AppSwitcherPopup);

        if (this._options.get('superKeyMode') > 1)
            this._updateOverlayKeyHandler();

        this._updateAlwaysActivateFocusedConnection();
        this._options.connect('changed::wm-always-activate-focused', this._updateAlwaysActivateFocusedConnection.bind(this));

        this._updateHotTrigger();
        this._updateDashVisibility();

        this._options.connect('changed', this._updateSettings.bind(this));
        log(`${this.metadata.name}: enabled`);
    }

    disable() {
        if (this._wmFocusToActiveHandlerId)
            global.display.disconnect(this._wmFocusToActiveHandlerId);

        if (Main.layoutManager.aatws) {
            Main.layoutManager.aatws.destroy();
            Main.layoutManager.aatws = null;
        }

        // comment out to pass ego review
        if (Main.extensionManager._getEnabledExtensions().includes(this.metadata.uuid)) {
            const hide = true;
            this._removeThumbnails(hide);
        } else {
            this._removeThumbnails();
            this._actions = null;
        }

        if (this._overrides) {
            this._overrides.removeOverride('WindowSwitcherPopup');
            this._overrides.removeOverride('AppSwitcherPopup');
        }
        this._overrides = null;

        this._restoreOverlayKeyHandler();

        this._removePressureBarrier();
        this._updateDashVisibility(true);

        WindowSwitcherPopup.cleanGlobal();
        SwitcherList.cleanGlobal();
        SwitcherItems.cleanGlobal();
        WindowMenu.cleanGlobal();
        this._options = null;
        log(`${this.metadata.name}: disabled`);
    }

    _removeThumbnails(hide = false) {
        if (hide)
            this._actions.hideThumbnails();
        else
            this._actions.removeThumbnails();
    }

    _updateAlwaysActivateFocusedConnection() {
        // GS 43 activates focused windows immediately by default and this can lead to problems with refocusing window you're switching from
        /* if (this._options.get('wmAlwaysActivateFocused', true) && Settings.shellVersion < 43 && !this._wmFocusToActiveHandlerId) {
            this._wmFocusToActiveHandlerId = global.display.connect('notify::focus-window', () => {
                if (!Main.overview._shown) {
                    let win = global.display.get_focus_window();
                    if (win)
                        Main.activateWindow(win);
                }
            });
        } else*/
        if (this._wmFocusToActiveHandlerId) {
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
        const visible = this._options.get('showDash', true);
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

        if (this._options.get('superKeyMode', true) === 1)
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

        const altTabPopup = new AltTab.WindowSwitcherPopup();
        if (mouseTriggered) {
            altTabPopup.KEYBOARD_TRIGGERED = false;
            altTabPopup.POPUP_POSITION = this._options.get('hotEdgePosition') === 1 ? 1 : 3; // 1-top, 2-bottom > 1-top, 2-center, 3-bottom
            const appSwitcherMode = this._options.get('hotEdgeMode') === 0;
            altTabPopup.SHOW_APPS = !!appSwitcherMode;
            altTabPopup._switcherMode = appSwitcherMode ? 1 : 0;
            altTabPopup._monitorIndex = global.display.get_current_monitor();
        } else {
            altTabPopup.KEYBOARD_TRIGGERED = true;
            const hotEdgePosition = this._options.get('hotEdgePosition');
            let position = hotEdgePosition ? hotEdgePosition : null;
            if (position)
                altTabPopup.POPUP_POSITION = position === 1 ? 1 : 3;
            const appSwitcherMode = this._options.get('superKeyMode') === 2;
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

        const position = this._options.get('hotEdgePosition', true);

        if (!position)
            return;

        this._pressureBarriers = [];
        const primaryMonitor = global.display.get_primary_monitor();

        for (let i = 0; i < Main.layoutManager.monitors.length; ++i) {
            if (!this._options.get('hotEdgeMonitor', true) && i !== primaryMonitor)
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

            const scale = this._options.get('hotEdgeWidth', true) / 100;
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
                this._options.get('hotEdgePressure', true), // pressure threshold
                HOT_CORNER_PRESSURE_TIMEOUT,
                Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW
            );

            pressureBarrier.connect('trigger', this._onPressureTriggered.bind(this, Main.layoutManager.monitors[i]));
            pressureBarrier.addBarrier(horizontalBarrier);

            this._pressureBarriers.push([pressureBarrier, horizontalBarrier]);
            if (!this._monitorsChangedSigId) {
                this._monitorsChangedSigId = Main.layoutManager.connect('monitors-changed', () => {
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

        if (this._monitorsChangedSigId) {
            Main.layoutManager.disconnect(this._monitorsChangedSigId);
            this._monitorsChangedSigId = 0;
        }
        if (this._monitorsChangedDelayId) {
            GLib.source_remove(this._monitorsChangedDelayId);
            this._monitorsChangedDelayId = 0;
        }
    }

    _onPressureTriggered(monitor) {
        const fsAllowed = this._options.get('hotEdgeFullScreen');
        if (!(!fsAllowed && monitor.inFullscreen))
            this._toggleSwitcher(true);
    }
}

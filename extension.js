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
import * as Signals from 'resource:///org/gnome/shell/misc/signals.js';

import * as WindowSwitcherPopup from './src/windowSwitcherPopup.js';
import * as Actions from './src/actions.js';
import * as Settings from './src/settings.js';
import * as Util from './src/util.js';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

let enabled = false;

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
        if (enabled) {
            let actions = new Actions.Actions();
            actions.resumeThumbnailsIfExist();
            actions = undefined;
        }

        this._options = new Settings.Options(this);
        this._options.connect('changed', this._updateSettings);

        WindowSwitcherPopup.init(this._options, this);

        this._overrides = new Util.Overrides();

        this._overrides.addOverride('WindowSwitcherPopup', AltTab.WindowSwitcherPopup.prototype, WindowSwitcherPopup.WindowSwitcherPopup);
        this._overrides.addOverride('AppSwitcherPopup', AltTab.AppSwitcherPopup.prototype, WindowSwitcherPopup.WindowSwitcherPopup);
        this._overrides.addOverride('AppSwitcherPopupInit', AltTab.AppSwitcherPopup.prototype, WindowSwitcherPopup.AppSwitcherPopup);

        if (this._options.get('superKeyMode') > 1)
            this._updateOverlayKeyHandler();

        this._updateAlwaysActivateFocusedConnection();
        this._options.connect('changed::wm-always-activate-focused', this._updateAlwaysActivateFocusedConnection);

        this._updateHotTrigger();
        this._updateDashVisibility();

        log(`${this.metadata.name}: enabled`);
        enabled = true;
    }

    disable() {
        if (this._wmFocusToActiveHandlerId)
            global.display.disconnect(this._wmFocusToActiveHandlerId);

        if (global.advancedWindowSwitcher) {
            global.advancedWindowSwitcher.destroy();
            global.advancedWindowSwitcher = null;
        }

        if (Main.extensionManager._getEnabledExtensions().includes(this.metadata.uuid)) {
            const hide = true;
            this._removeThumbnails(hide);
        } else {
            this._removeThumbnails();
            enabled = false;
        }

        if (this._overrides)
            this._overrides.removeAll();
        this._overrides = null;

        this._restoreOverlayKeyHandler();

        this._removePressureBarrier();
        this._updateDashVisibility(true);

        WindowSwitcherPopup.cleanGlobal();
        this._options = null;
        log(`${this.metadata.name}: disabled`);
    }

    _removeThumbnails(hide = false) {
        if (!global.stage.windowThumbnails)
            return;

        let actions = new Actions.Actions();

        if (hide)
            actions.hideThumbnails();
        else
            actions.removeThumbnails();

        actions.clean();
        actions = undefined;
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
        const altTabPopup = new WindowSwitcherPopup.WindowSwitcherPopup();
        if (mouseTriggered) {
            altTabPopup.KEYBOARD_TRIGGERED = false;
            altTabPopup.POPUP_POSITION = this._options.get('hotEdgePosition') === 1 ? 1 : 3; // 1-top, 2-bottom > 1-top, 2-center, 3-bottom
            const appSwitcherMode = this._options.get('hotEdgeMode') === 0;
            altTabPopup.SHOW_APPS = !!appSwitcherMode;
            altTabPopup._switcherMode = appSwitcherMode ? 1 : 0;
            altTabPopup._monitorIndex = global.display.get_current_monitor();
        } else {
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

            const pressureBarrier = new PressureBarrier(
                this._options.get('hotEdgePressure', true), // pressure threshold
                Layout.HOT_CORNER_PRESSURE_TIMEOUT,
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

    /* _extensionEnabled() {
        const shellSettings = ExtensionUtils.getSettings('org.gnome.shell');
        let enabled = shellSettings.get_strv('enabled-extensions');
        enabled = enabled.indexOf(Me.metadata.uuid) > -1;
        let disabled = shellSettings.get_strv('disabled-extensions');
        disabled = disabled.indexOf(Me.metadata.uuid) > -1;
        let disableUser = shellSettings.get_boolean('disable-user-extensions');

        if (enabled && !disabled && !disableUser)
            return true;
        return false;
    }*/
}

class PressureBarrier extends Signals.EventEmitter {
    constructor(threshold, timeout, actionMode) {
        super();

        this._threshold = threshold;
        this._timeout = timeout;
        this._actionMode = actionMode;
        this._barriers = [];
        this._eventFilter = null;

        this._isTriggered = false;
        this._reset();
    }

    addBarrier(barrier) {
        barrier._pressureHitId = barrier.connect('hit', this._onBarrierHit.bind(this));
        barrier._pressureLeftId = barrier.connect('left', this._onBarrierLeft.bind(this));

        this._barriers.push(barrier);
    }

    _disconnectBarrier(barrier) {
        barrier.disconnect(barrier._pressureHitId);
        barrier.disconnect(barrier._pressureLeftId);
    }

    removeBarrier(barrier) {
        this._disconnectBarrier(barrier);
        this._barriers.splice(this._barriers.indexOf(barrier), 1);
    }

    destroy() {
        this._barriers.forEach(this._disconnectBarrier.bind(this));
        this._barriers = [];
    }

    setEventFilter(filter) {
        this._eventFilter = filter;
    }

    _reset() {
        this._barrierEvents = [];
        this._currentPressure = 0;
        this._lastTime = 0;
    }

    _isHorizontal(barrier) {
        return barrier.y1 === barrier.y2;
    }

    _getDistanceAcrossBarrier(barrier, event) {
        if (this._isHorizontal(barrier))
            return Math.abs(event.dy);
        else
            return Math.abs(event.dx);
    }

    _getDistanceAlongBarrier(barrier, event) {
        if (this._isHorizontal(barrier))
            return Math.abs(event.dx);
        else
            return Math.abs(event.dy);
    }

    _trimBarrierEvents() {
        // Events are guaranteed to be sorted in time order from
        // oldest to newest, so just look for the first old event,
        // and then chop events after that off.
        let i = 0;
        let threshold = this._lastTime - this._timeout;

        while (i < this._barrierEvents.length) {
            let [time, distance_] = this._barrierEvents[i];
            if (time >= threshold)
                break;
            i++;
        }

        let firstNewEvent = i;

        for (i = 0; i < firstNewEvent; i++) {
            let [time_, distance] = this._barrierEvents[i];
            this._currentPressure -= distance;
        }

        this._barrierEvents = this._barrierEvents.slice(firstNewEvent);
    }

    _onBarrierLeft(barrier, _event) {
        barrier._isHit = false;
        if (this._barriers.every(b => !b._isHit)) {
            this._reset();
            this._isTriggered = false;
        }
    }

    _trigger() {
        this._isTriggered = true;
        this.emit('trigger');
        this._reset();
    }

    _onBarrierHit(barrier, event) {
        barrier._isHit = true;

        // If we've triggered the barrier, wait until the pointer has the
        // left the barrier hitbox until we trigger it again.
        if (this._isTriggered)
            return;

        if (this._eventFilter && this._eventFilter(event))
            return;

        // Throw out all events not in the proper keybinding mode
        if (!(this._actionMode & Main.actionMode))
            return;

        let slide = this._getDistanceAlongBarrier(barrier, event);
        let distance = this._getDistanceAcrossBarrier(barrier, event);

        if (distance >= this._threshold) {
            this._trigger();
            return;
        }

        // Throw out events where the cursor is move more
        // along the axis of the barrier than moving with
        // the barrier.
        if (slide > distance)
            return;

        this._lastTime = event.time;

        this._trimBarrierEvents();
        distance = Math.min(15, distance);

        this._barrierEvents.push([event.time, distance]);
        this._currentPressure += distance;

        if (this._currentPressure >= this._threshold)
            this._trigger();
    }
}

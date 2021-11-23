'use strict';

const GObject        = imports.gi.GObject;
const GLib           = imports.gi.GLib;
const St             = imports.gi.St;
const Meta           = imports.gi.Meta;
const Shell          = imports.gi.Shell;
const Main           = imports.ui.main;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;
const WinTmb         = Me.imports.winTmb;

const ws_indicator_mode = {
    'DISABLE': 0,
    'DEFAULT': 1,
    'INDEX': 2,
};

var get_current_monitor_geometry = function () {
    return global.display.get_monitor_geometry(global.display.get_current_monitor());
};

function _getWindowApp(metaWindow) {
    let tracker = Shell.WindowTracker.get_default();
    return tracker.get_window_app(metaWindow);
}

var Actions = class {
    constructor() {
        this._mscOptions = new Settings.MscOptions();
        this.WS_IGNORE_LAST         = this._mscOptions.wsSwitchIgnoreLast;
        this.WS_WRAPAROUND          = this._mscOptions.wsSwitchWrap;
        this.WS_INDICATOR_MODE      = this._mscOptions.wsSwitchIndicatorMode;
        this.WIN_SKIP_MINIMIZED     = this._mscOptions.winSkipMinimized;
    }

    clean() {
        this._mscOptions = null;
        this._shellSettings = null;
    }

    _getShellSettings() {
        if (!this._shellSettings) {
            this._shellSettings = Settings.getSettings(
                'org.gnome.shell',
                '/org/gnome/shell/');
        }
        return this._shellSettings;
    }

    _getActorByMetaWin(metaWindow) {
        for (let actor of global.get_window_actors()) {
            if (actor.get_meta_window() === metaWindow)
                return actor;
        }
        return null;
    }

    _getMonitorByIndex(monitorIndex) {
        let monitors = Main.layoutManager.monitors;
        for (let monitor of monitors) {
            if (monitor.index === monitorIndex)
                return monitor;
        }
        return -1;
    }

    // ///////////////////////////////////////////////////////////////////////////

    closeAppWindows(selected, itemList) {
        let winList = [];
        if (selected.cachedWindows) {
            winList = selected.cachedWindows;
        } else {
            let app = _getWindowApp(selected).get_id();
            itemList.forEach(i => {
                if (_getWindowApp(i.window).get_id() === app)
                    winList.push(i.window);
            });
        }
        let time = global.get_current_time();
        for (let win of winList) {
            // increase time by 1 ms for each window to avoid errors from GS
            win.delete(time++);
        }
    }

    moveWindowToCurrentWs(metaWindow, monitorIndex = -1) {
        let ws = global.workspace_manager.get_active_workspace();
        let win = metaWindow;
        win.change_workspace(ws);
        let targetMonitorIndex = monitorIndex > -1 ? monitorIndex : global.display.get_current_monitor();
        let currentMonitorIndex = win.get_monitor();
        if (currentMonitorIndex !== targetMonitorIndex) {
            // move window to target monitor
            let actor = this._getActorByMetaWin(win);
            let targetMonitor  = this._getMonitorByIndex(targetMonitorIndex);

            let x = targetMonitor.x + Math.max(Math.floor(targetMonitor.width - actor.width) / 2, 0);
            let y = targetMonitor.y + Math.max(Math.floor(targetMonitor.height - actor.height) / 2, 0);
            win.move_frame(true, x, y);
        }
    }

    fullscreenWinOnEmptyWs(metaWindow = null) {
        let win;
        if (!metaWindow)
            return;
        else
            win = metaWindow;
        // if property fullscreen === true, win was already maximized on new ws
        if (win.fullscreen) {
            win.unmake_fullscreen();
            if (win._originalWS) {
                let ws = false;
                for(let i = 0; i < global.workspaceManager.n_workspaces; i++) {
                    let w = global.workspaceManager.get_workspace_by_index(i);
                    if (w === win._originalWS) {
                        ws = true;
                        break;
                    }
                }
                if (ws) {
                    win.change_workspace(win._originalWS);
                    Main.wm.actionMoveWorkspace(win._originalWS);
                }
                win._originalWS = null;
            }
        } else {
            let ws = win.get_workspace();
            win.make_fullscreen();
            let nWindows = ws.list_windows().filter(
                w =>
                    //w.get_window_type() === Meta.WindowType.NORMAL &&
                    !w.is_on_all_workspaces()
                ).length;
            if (nWindows > 1) {
                win._originalWS = ws;
                let lastWs = global.workspaceManager.n_workspaces - 1;
                lastWs = global.workspaceManager.get_workspace_by_index(lastWs);
                // Main.wm.actionMoveWorkspace(lastWs);
                win.change_workspace(lastWs);
                global.workspace_manager.reorder_workspace(lastWs, ws.index() + 1);
                win.activate(global.get_current_time());
            }
        }
    }

    toggleMaximizeOnCurrentMonitor(metaWindow, monitorIndex) {
        let win = metaWindow;
        if (win.get_workspace().index() === global.workspace_manager.get_active_workspace().index()
            && monitorIndex === win.get_monitor()) {
            if (win.get_maximized() === Meta.MaximizeFlags.BOTH)
                win.unmaximize(Meta.MaximizeFlags.BOTH);
            else
                win.maximize(Meta.MaximizeFlags.BOTH);
        } else {
            // the already maximized window have to be unmaximized first, otherwise it then unminimize on the original monitor instead of the current one
            win.unmaximize(Meta.MaximizeFlags.BOTH);
            this.moveWindowToCurrentWs(win, monitorIndex);
            win.maximize(Meta.MaximizeFlags.BOTH);
        }
    }

    toggleAboveWindow(metaWindow) {
        let win = metaWindow;
        if (!win)
            return;
        if (win.is_above())
            win.unmake_above();

        else
            win.make_above();
    }

    toggleStickyWindow(metaWindow) {
        let win = metaWindow;
        if (!win)
            return;
        if (win.is_on_all_workspaces())
            win.unstick();
        else
            win.stick();
    }

    switchWorkspace(direction, noIndicator = false) {
        let n_workspaces = global.workspaceManager.n_workspaces;
        let lastWsIndex =  n_workspaces - (this.WS_IGNORE_LAST ? 2 : 1);
        let motion;

        let activeWs  = global.workspaceManager.get_active_workspace();
        let activeIdx = activeWs.index();
        let targetIdx = this.WS_WRAPAROUND
            ? (activeIdx + (direction ? 1 : lastWsIndex)) % (lastWsIndex + 1)
            : activeIdx + (direction ? 1 : -1);
        if (targetIdx < 0 || targetIdx > lastWsIndex)
            targetIdx = activeIdx;

        let ws = global.workspaceManager.get_workspace_by_index(targetIdx);

        const showIndicator = !noIndicator && this.WS_INDICATOR_MODE > 0;

        // show default workspace indicator popup
        if (showIndicator && this.WS_INDICATOR_MODE === ws_indicator_mode.DEFAULT) {
            const vertical = global.workspaceManager.layout_rows === -1;
            if (Main.wm._workspaceSwitcherPopup == null) {
                Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
                Main.wm._workspaceSwitcherPopup.reactive = false;
                Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
                    Main.wm._workspaceSwitcherPopup = null;
                });
            }

            // Do not show wokspaceSwitcher in overview
            if (!Main.overview.visible) {
                let motion = direction ? vertical ? Meta.MotionDirection.DOWN : Meta.MotionDirection.RIGHT
                    : vertical ? Meta.MotionDirection.UP   : Meta.MotionDirection.LEFT;
                Main.wm._workspaceSwitcherPopup.display(motion, ws.index());
            }
        }
        Main.wm.actionMoveWorkspace(ws);
    }

    // directions -1/+1
    reorderWorkspace(direction = 0) {
        let activeWs = global.workspace_manager.get_active_workspace();
        let activeWsIdx = activeWs.index();
        let targetIdx = activeWsIdx + direction;
        if (targetIdx > 0 || targetIdx < (global.workspace_manager.get_n_workspaces() - 1)) {
            global.workspace_manager.reorder_workspace(activeWs, targetIdx);
        }
    }

    makeThumbnailWindow(metaWindow) {
        if (!global.stage.windowThumbnails)
            global.stage.windowThumbnails = [];
        let metaWin;
        if (metaWindow)
            metaWin = metaWindow;

        if (!metaWin)
            return;

        let monitorHeight = get_current_monitor_geometry().height;
        let scale = this._mscOptions.winThumbnailScale;
        global.stage.windowThumbnails.push(new WinTmb.WindowThumbnail(metaWin, this, {
            'actionTimeout': this._mscOptions.actionEventDelay,
            'height': Math.floor(scale / 100 * monitorHeight),
            'thumbnailsOnScreen': global.stage.windowThumbnails.length,
        }));
    }
};

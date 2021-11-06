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

var Actions = class {
    constructor() {
        this._mscOptions = new Settings.MscOptions();

        this.WS_IGNORE_LAST         = this._mscOptions.wsSwitchIgnoreLast;
        this.WS_WRAPAROUND          = this._mscOptions.wsSwitchWrap;
        this.WS_INDICATOR_MODE      = this._mscOptions.wsSwitchIndicatorMode;

        this.WIN_SKIP_MINIMIZED     = this._mscOptions.winSkipMinimized;
    }

    clean(full = true) {
        // don't reset effects and destroy thumbnails if extension is enabled (GS calls ext. disable() before locking the screen f.e.)
        if (full)
            this._resetSettings();
        if (this._wsOverlay)
            this.destroyWsOverlay();
        this._removeThumbnails(full);
    }

    resume() {
        this._resumeThumbnailsIfExist();
    }

    extensionEnabled() {
        this._getShellSettings();
        let enabled = this._shellSettings.get_strv('enabled-extensions');
        if (enabled.indexOf(Me.metadata.uuid) > -1)
            return true;
        return false;
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
        for (let act of global.get_window_actors()) {
            if (act.get_meta_window() === metaWindow)
                return act;
        }
        return null;
    }

    _getWindowApp(metaWindow) {
        let tracker = Shell.WindowTracker.get_default();
        return tracker.get_window_app(metaWindow);
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

    moveWindowToCurrentWs(metaWindow, monitor = -1) {
        let ws = global.workspace_manager.get_active_workspace();
        let win = metaWindow;
        win.change_workspace(ws);
        let targetMonitorIndex = monitor > -1 ? monitor : global.display.get_current_monitor();
        let currentMonitorIndex = win.get_monitor();
        if (currentMonitorIndex !== targetMonitorIndex) {
            // move window to target monitor
            let actor = this._getActorByMetaWin(win);
            let currentMonitor = this._getMonitorByIndex(currentMonitorIndex);
            let targetMonitor  = this._getMonitorByIndex(targetMonitorIndex);

            let x = targetMonitor.x + Math.max(Math.floor(targetMonitor.width - actor.width) / 2, 0);
            let y = targetMonitor.y + Math.max(Math.floor(targetMonitor.height - actor.height) / 2, 0);
            win.move_frame(true, x, y);
        }
    }

    closeWindow(metaWindow) {
        let win = metaWindow;
        if (!win)
            return;
        win.delete(global.get_current_time());
    }

    closeWinsOfSameApp(metaWindow, windowList) {
        let app = this._getWindowApp(metaWindow).get_id();
        let time = global.get_current_time();
        for (let item of windowList) {
            if (this._getWindowApp(item.window).get_id() === app)
                item.window.delete(time++);
        }
    }

    quitApplication(metaWindow) {
        let win = metaWindow;
        if (!win)
            return;
        let app = this._getWindowApp(metaWindow);
        app.request_quit();
    }

    killApplication(metaWindow) {
        let win = metaWindow;
        if (!win)
            return;
        win.kill();
    }

    toggleMaximizeWindow(metaWindow) {
        let win = metaWindow;
        if (!win)
            return;
        if (win.maximized_horizontally && win.maximized_vertically)
            win.unmaximize(Meta.MaximizeFlags.BOTH);
        else
            win.maximize(Meta.MaximizeFlags.BOTH);
    }

    minimizeWindow(metaWindow) {
        let win = metaWindow;
        if (!win)
            return;
        win.minimize();
    }

    unminimizeAll(workspace = true) {
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        let activeWorkspace = global.workspaceManager.get_active_workspace();
        for (let win of windows) {
            if (workspace && (activeWorkspace !== win.get_workspace()))
                continue;

            win.unminimize();
        }
    }

    toggleFullscreenWindow(metaWindow) {
        let win = metaWindow;
        if (!win)
            return;
        if (win.fullscreen)
            win.unmake_fullscreen();
        else
            win.make_fullscreen();
    }

    fullscreenWinOnEmptyWs(metaWindow = null, nextWs = false) {
        let win;
        if (!metaWindow)
            win = this._getFocusedWindow(true);
        else
            win = metaWindow;

        if (!win)
            return;
        if (win.fullscreen) {
            win.unmake_fullscreen();
            if (win._originalWS) {
                win.change_workspace(win._originalWS);
                Main.wm.actionMoveWorkspace(win._originalWS);
                win._originalWS = null;
            }
        } else {
            let ws = win.get_workspace();
            win.make_fullscreen();
            if (ws.n_windows > 1) {
                win._originalWS = ws;
                let lastWs = global.workspaceManager.n_workspaces - 1;
                lastWs = global.workspaceManager.get_workspace_by_index(lastWs);
                // Main.wm.actionMoveWorkspace(lastWs);
                win.change_workspace(lastWs);
                global.workspace_manager.reorder_workspace(lastWs, ws.index() + 1);
            }
            win.activate(global.get_current_time());
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

    toggleStickWindow(metaWindow) {
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

/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * Actions
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2023
 * @license    GPL-3.0
 */

'use strict';

const { GObject, St, Meta, Shell } = imports.gi;

const Main                   = imports.ui.main;
const ExtensionUtils         = imports.misc.extensionUtils;
const Me                     = ExtensionUtils.getCurrentExtension();

const Settings               = Me.imports.settings;
const WinTmb                 = Me.imports.winTmb;
const WorkspaceSwitcherPopup = imports.ui.workspaceSwitcherPopup;

const shellVersion = Settings.shellVersion;


function getCurrentMonitorGeometry() {
    return global.display.get_monitor_geometry(global.display.get_current_monitor());
}

function _getWindowApp(metaWindow) {
    let tracker = Shell.WindowTracker.get_default();
    return tracker.get_window_app(metaWindow);
}

var Actions = class {
    constructor() {
        this._gOptions = new Settings.Options();
        this.WIN_SKIP_MINIMIZED = this._gOptions.get('winSkipMinimized');
        this.WS_SHOW_POPUP = this._gOptions.get('wsShowSwitcherPopup');
    }

    clean() {
        this._gOptions = null;
        this._shellSettings = null;
    }

    removeThumbnails() {
        if (global.stage.windowThumbnails) {
            global.stage.windowThumbnails.forEach(
                t => {
                    if (t)
                        t.destroy();
                }
            );
            global.stage.windowThumbnails = undefined;
        }
    }

    removeLastThumbnail() {
        if (!global.stage.windowThumbnails)
            return;

        const length = global.stage.windowThumbnails.length;
        if (length)
            global.stage.windowThumbnails[length - 1].destroy();
        global.stage.windowThumbnails.pop();
    }

    hideThumbnails() {
        if (global.stage.windowThumbnails) {
            global.stage.windowThumbnails.forEach(
                t => {
                    if (t)
                        t.hide();
                }
            );
        }
    }

    resumeThumbnailsIfExist() {
        if (global.stage.windowThumbnails) {
            global.stage.windowThumbnails.forEach(
                t => {
                    if (t)
                        t.show();
                }
            );
        }
    }

    _getShellSettings() {
        if (!this._shellSettings)
            this._shellSettings = ExtensionUtils.getSettings('org.gnome.shell');

        return this._shellSettings;
    }

    _getMonitorByIndex(monitorIndex) {
        let monitors = Main.layoutManager.monitors;
        for (let monitor of monitors) {
            if (monitor.index === monitorIndex)
                return monitor;
        }
        return -1;
    }

    _isWsOrientationHorizontal() {
        if (global.workspace_manager.layout_rows === -1)
            return false;
        return true;
    }

    _translateDirectionToHorizontal(direction) {
        if (this._isWsOrientationHorizontal()) {
            if (direction === Meta.MotionDirection.UP)
                direction = Meta.MotionDirection.LEFT;
            else
                direction = Meta.MotionDirection.RIGHT;
        }
        return direction;
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
            win.move_to_monitor(targetMonitorIndex);
            /* let actor = win.get_compositor_private();
            let targetMonitor  = this._getMonitorByIndex(targetMonitorIndex);

            let x = targetMonitor.x + Math.max(Math.floor(targetMonitor.width - actor.width) / 2, 0);
            let y = targetMonitor.y + Math.max(Math.floor(targetMonitor.height - actor.height) / 2, 0);
            win.move_frame(true, x, y);*/
        }
    }

    toggleAppGrid() {
        if (Main.overview.dash.showAppsButton.checked) {
            Main.overview.hide();
        } else if (shellVersion < 40) {
            // Pressing the apps btn before overview activation avoids icons animation in GS 3.36/3.38
            // but in GS40 with Dash to Dock and its App button set to "no animation", this whole sequence is problematic

            // in 3.36 pressing the button is usually enough to activate overview, but not always
            Main.overview.dash.showAppsButton.checked = true;
            Main.overview.show();
        } else if (Main.overview._shown) {
            Main.overview.dash.showAppsButton.checked = true;
        } else {
            Main.overview.show(2); // 2 for App Grid
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
                for (let i = 0; i < global.workspaceManager.n_workspaces; i++) {
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
            win._originalWS = ws;
            win.make_fullscreen();
            let nWindows = ws.list_windows().filter(
                w =>
                    // w.get_window_type() === Meta.WindowType.NORMAL &&
                    !w.is_on_all_workspaces()
            ).length;
            if (nWindows > 1) {
                let newWsIndex = ws.index() + 1;
                Main.wm.insertWorkspace(newWsIndex);
                let newWs = global.workspace_manager.get_workspace_by_index(newWsIndex);
                win.change_workspace(newWs);
                win.activate(global.get_current_time());
            }
        }
    }

    toggleMaximizeOnCurrentMonitor(metaWindow, monitorIndex) {
        let win = metaWindow;
        if (win.get_workspace().index() === global.workspace_manager.get_active_workspace().index() &&
            monitorIndex === win.get_monitor()) {
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

    switchWorkspace(direction /* noIndicator = false */) {
        direction = this._translateDirectionToHorizontal(direction);
        const targetWs = global.workspaceManager.get_active_workspace().get_neighbor(direction);
        Main.wm.actionMoveWorkspace(targetWs);
    }

    showWsSwitcherPopup(direction, wsIndex) {
        if (!this.WS_SHOW_POPUP)
            return;
        if (!wsIndex)
            wsIndex = global.workspace_manager.get_active_workspace_index();


        if (!Main.overview.visible) {
            const vertical = global.workspaceManager.layout_rows === -1;
            if (Main.wm._workspaceSwitcherPopup === null) {
                Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
                Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
                    Main.wm._workspaceSwitcherPopup = null;
                });
            }

            let motion;
            if (direction === Meta.MotionDirection.DOWN)
                motion = vertical ? Meta.MotionDirection.DOWN : Meta.MotionDirection.RIGHT;
            else
                motion = vertical ? Meta.MotionDirection.UP   : Meta.MotionDirection.LEFT;



            if (shellVersion >= 42)
                Main.wm._workspaceSwitcherPopup.display(wsIndex);
            else
                Main.wm._workspaceSwitcherPopup.display(motion, wsIndex);
        }
    }

    // directions -1/+1
    reorderWorkspace(direction = 0) {
        let activeWs = global.workspace_manager.get_active_workspace();
        let activeWsIdx = activeWs.index();
        let targetIdx = activeWsIdx + direction;
        if (targetIdx > -1 && targetIdx < global.workspace_manager.get_n_workspaces())
            global.workspace_manager.reorder_workspace(activeWs, targetIdx);
    }

    makeThumbnailWindow(metaWindow) {
        if (!global.stage.windowThumbnails)
            global.stage.windowThumbnails = [];
        let metaWin;
        if (metaWindow)
            metaWin = metaWindow;

        if (!metaWin)
            return;

        let monitorHeight = getCurrentMonitorGeometry().height;
        let scale = this._gOptions.get('winThumbnailScale');
        global.stage.windowThumbnails.push(new WinTmb.WindowThumbnail(metaWin, global.stage, {
            'height': Math.floor(scale / 100 * monitorHeight),
            'thumbnailsOnScreen': global.stage.windowThumbnails.length,
        }));
    }

    openPrefsWindow() {
        // if prefs window already exist, move it to the current WS and activate it
        const { metaWin, isCHCE } = this._getOpenPrefsWindow();
        if (metaWin) {
            if (!isCHCE) {
                metaWin.delete(global.get_current_time());
            } else {
                this.moveWindowToCurrentWs(metaWin);
                metaWin.activate(global.get_current_time());
                return;
            }
        }
        try {
            Main.extensionManager.openExtensionPrefs(Me.metadata.uuid, '', {});
        } catch (e) {
            log(e);
        }
    }

    _getOpenPrefsWindow() {
        const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        for (let win of windows) {
            if (win.get_title().includes(Me.metadata.name) && _getWindowApp(win).get_name() === 'Extensions')
                return { metaWin: win, isCHCE: true };
            else if (win.wm_class.includes('org.gnome.Shell.Extensions'))
                return { metaWin: win, isCHCE: false };
        }
        return { metaWin: null, isCHCE: null };
    }
};

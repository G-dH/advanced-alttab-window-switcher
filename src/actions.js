/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * Actions
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2023
 * @license    GPL-3.0
 */

'use strict';

import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as WorkspaceSwitcherPopup from 'resource:///org/gnome/shell/ui/workspaceSwitcherPopup.js';

import * as WinTmb from './winTmb.js';
import * as Util from './util.js';


export const Actions = class {
    constructor(options) {
        this._gOptions = options;
        this.WIN_SKIP_MINIMIZED = this._gOptions.get('winSkipMinimized');
        this.WS_SHOW_POPUP = this._gOptions.get('wsShowSwitcherPopup');
    }

    removeThumbnails() {
        if (this._windowThumbnails) {
            this._windowThumbnails.forEach(
                t => {
                    if (t)
                        t.destroy();
                }
            );
            this._windowThumbnails = undefined;
        }
    }

    removeLastThumbnail() {
        if (!this._windowThumbnails)
            return;

        const length = this._windowThumbnails.length;
        if (length)
            this._windowThumbnails[length - 1].destroy();
        this._windowThumbnails.pop();
    }

    hideThumbnails() {
        if (this._windowThumbnails) {
            this._windowThumbnails.forEach(
                t => {
                    if (t)
                        t.hide();
                }
            );
        }
    }

    resumeThumbnailsIfExist() {
        if (this._windowThumbnails) {
            this._windowThumbnails.forEach(
                t => {
                    if (t)
                        t.show();
                }
            );
        }
    }

    _getShellSettings() {
        if (!this._shellSettings)
            this._shellSettings = this.getSettings('org.gnome.shell');

        return this._shellSettings;
    }

    // ///////////////////////////////////////////////////////////////////////////

    closeAppWindows(selected, itemList) {
        let winList = [];
        if (selected.cachedWindows) {
            winList = selected.cachedWindows;
        } else {
            let app = Util.getWindowApp(selected).get_id();
            itemList.forEach(i => {
                if (Util.getWindowApp(i.window).get_id() === app)
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
            let targetMonitor  = Util.getMonitorByIndex(targetMonitorIndex);

            let x = targetMonitor.x + Math.max(Math.floor(targetMonitor.width - actor.width) / 2, 0);
            let y = targetMonitor.y + Math.max(Math.floor(targetMonitor.height - actor.height) / 2, 0);
            win.move_frame(true, x, y);*/
        }
    }

    toggleAppGrid() {
        if (Main.overview.dash.showAppsButton.checked)
            Main.overview.hide();
        else if (Main.overview._shown)
            Main.overview.dash.showAppsButton.checked = true;
        else
            Main.overview.show(2); // 2 for App Grid
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
        direction = Util.translateDirectionToHorizontal(direction);
        const targetWs = global.workspaceManager.get_active_workspace().get_neighbor(direction);
        Main.wm.actionMoveWorkspace(targetWs);
    }

    showWsSwitcherPopup(direction, wsIndex) {
        if (!this.WS_SHOW_POPUP)
            return;
        if (!wsIndex)
            wsIndex = global.workspace_manager.get_active_workspace_index();

        if (!Main.overview.visible) {
            if (Main.wm._workspaceSwitcherPopup === null) {
                Main.wm._workspaceSwitcherPopup = new WorkspaceSwitcherPopup.WorkspaceSwitcherPopup();
                Main.wm._workspaceSwitcherPopup.connect('destroy', () => {
                    Main.wm._workspaceSwitcherPopup = null;
                });
            }

            Main.wm._workspaceSwitcherPopup.display(wsIndex);
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
        if (!this._windowThumbnails)
            this._windowThumbnails = [];
        let metaWin;
        if (metaWindow)
            metaWin = metaWindow;

        if (!metaWin)
            return;

        let monitorHeight = Util.getCurrentMonitorGeometry().height;
        let scale = this._gOptions.get('winThumbnailScale');
        this._windowThumbnails.push(new WinTmb.WindowThumbnail(metaWin, this._windowThumbnails, {
            'height': Math.floor(scale / 100 * monitorHeight),
            'thumbnailsOnScreen': this._windowThumbnails.length,
        }));
    }

    openPrefsWindow(metadata) {
        // if prefs window already exist, move it to the current WS and activate it
        const windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        let tracker = Shell.WindowTracker.get_default();
        let metaWin, isMe = null;

        for (let win of windows) {
            const app = tracker.get_window_app(win);
            if (win.get_title() && win.get_title().includes(metadata.name) && app.get_name() === 'Extensions') {
            // this is our existing window
                metaWin = win;
                isMe = true;
                break;
            } else if (win.wm_class && win.wm_class.includes('org.gnome.Shell.Extensions')) {
            // this is prefs window of another extension
                metaWin = win;
                isMe = false;
            }
        }

        if (metaWin && !isMe) {
        // other prefs window blocks opening another prefs window, so close it
            metaWin.delete(global.get_current_time());
        } else if (metaWin && isMe) {
        // if prefs window already exist, move it to the current WS and activate it
            metaWin.change_workspace(global.workspace_manager.get_active_workspace());
            metaWin.activate(global.get_current_time());
        }

        if (!metaWin || (metaWin && !isMe)) {
        // delay to avoid errors if previous prefs window has been colsed
            GLib.idle_add(GLib.PRIORITY_LOW, () => {
                try {
                    Main.extensionManager.openExtensionPrefs(metadata.uuid, '', {});
                } catch (e) {
                    console.error(e);
                }
            });
        }
    }
};

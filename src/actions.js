/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * Actions
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2025
 * @license    GPL-3.0
 */

'use strict';

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as WorkspaceSwitcherPopup from 'resource:///org/gnome/shell/ui/workspaceSwitcherPopup.js';

import * as Util from './util.js';

// gettext
let _;

export const Actions = class {
    constructor(me, wsp, shortcutModifiers) {
        _ = me._;
        this.Me = me;
        this._opt = me.opt;
        this._wsp = wsp;
        this._shortcutModifiers = shortcutModifiers;
    }

    _shiftPressed(state) {
        return Util.shiftPressed(state, this._shortcutModifiers);
    }

    _ctrlPressed(state) {
        return Util.ctrlPressed(state, this._shortcutModifiers);
    }

    clean() {
        this._opt = null;
        this._shellSettings = null;
        _ = null;
    }

    _getSelectedTarget() {
        return this._wsp._getSelectedTarget();
    }

    _getSelectedWindow() {
        const selected = this._getSelectedTarget();
        let metaWin;

        if (!metaWin && selected?.cachedWindows)
            metaWin = selected.cachedWindows[0];
        else if (selected.get_title)
            metaWin = selected;

        return metaWin ?? null;
    }

    // ///////////////////////////////////////////////////////////////////////////
    // Actions

    switchToFirstWS() {
        Main.wm.actionMoveWorkspace(global.workspace_manager.get_workspace_by_index(0));
        if (!this._wsp._wsTmb)
            this.showWsSwitcherPopup();
    }

    switchToLastWS() {
        Main.wm.actionMoveWorkspace(global.workspace_manager.get_workspace_by_index(global.workspace_manager.n_workspaces - 1));
        if (!this._wsp._wsTmb)
            this.showWsSwitcherPopup();
    }

    closeWinQuitApp() {
        const selected = this._getSelectedTarget();
        if (!selected)
            return;

        if (selected.get_title && this._ctrlPressed())
            Util.getWindowApp(selected).request_quit();
        else if (selected.get_title)
            selected.delete(global.get_current_time());
        else if (selected.cachedWindows?.length && this._ctrlPressed())
            selected.request_quit();
        else if (selected.cachedWindows?.length)
            this.closeAppWindows(selected);
    }

    closeAppWindows(selected) {
        selected = selected ?? this._getSelectedTarget();
        if (!selected)
            return;

        const items = this._wsp._items;
        let winList;
        if (selected.cachedWindows) {
            winList = selected.cachedWindows;
        } else {
            let app = Util.getWindowApp(selected).get_id();
            winList = items.filter(i => Util.getWindowApp(i.window).get_id() === app).map(i => i.window);
        }
        let time = global.get_current_time();
        for (let win of winList) {
            // increase time by 1 ms for each window to avoid errors from GS
            win.delete(time++);
        }
    }

    killApp(selected) {
        selected = selected ?? this._getSelectedTarget();
        if (!selected)
            return;

        if (selected.cachedWindows?.length)
            selected.cachedWindows[0].kill();
        else
            selected.kill();
    }

    moveWinToNewAdjacentWs(direction, metaWin, recursion) {
        metaWin = metaWin ?? this._getSelectedWindow();
        if (!metaWin)
            return;

        let wsIndex = metaWin.get_workspace().index();
        wsIndex += direction === Clutter.ScrollDirection.UP ? 0 : 1;
        Main.wm.insertWorkspace(wsIndex);
        this.moveWinToAdjacentWs(direction, metaWin, recursion);
    }

    moveWinToAdjacentWs(direction, metaWin, recursion) {
        metaWin = metaWin ?? this._getSelectedWindow();
        if (!metaWin)
            return;

        // avoid recreation of the switcher during the move
        this._wsp._doNotUpdateOnNewWindow = true;
        let wsOrig = metaWin.get_workspace();
        let wsIndex = wsOrig.index();
        wsIndex += direction === Clutter.ScrollDirection.UP ? -1 : 1;
        wsIndex = Math.min(wsIndex, global.workspace_manager.get_n_workspaces() - 1);

        // create new workspace if window should be moved in front of the first workspace
        if (wsIndex < 0 & !recursion) {
            recursion = true;
            this.moveWinToNewAdjacentWs(direction, metaWin, recursion);
            this._wsp._doNotUpdateOnNewWindow = false;
            return;
        } else if (wsIndex < 0) {
            return;
        }

        direction = Util.translateScrollToMotion(direction);

        let ws = global.workspace_manager.get_workspace_by_index(wsIndex);
        if (this._wsp._showingApps) {
            ws.activate(global.get_current_time());
            this.moveToCurrentWS();
        } else {
            wsOrig.activate(global.get_current_time());
            Main.wm.actionMoveWindow(metaWin, ws);
        }
        this._wsp._updateSwitcher();

        if (!this._wsTmb)
            this.showWsSwitcherPopup(wsIndex);
        this._doNotUpdateOnNewWindow = false;
        this._wsp._showWindow();
    }

    moveToCurrentWS() {
        let selected = this._getSelectedTarget();

        let winList;
        if (selected.cachedWindows)
            winList = selected.cachedWindows;
        else if (selected.get_title)
            winList = [selected];

        if (!winList)
            return;

        winList.forEach(win => {
            this._moveWindowToCurrentWs(win, this._wsp._keyboardTriggered ? this._wsp._monitorIndex : -1);
        });

        this._wsp._showWindow();
        this._wsp._delayedUpdate(100);
    }

    _moveWindowToCurrentWs(metaWindow, monitorIndex = -1) {
        let ws = global.workspace_manager.get_active_workspace();
        let win = metaWindow;
        win.change_workspace(ws);
        let targetMonitorIndex = monitorIndex > -1 ? monitorIndex : global.display.get_current_monitor();
        let currentMonitorIndex = win.get_monitor();
        if (currentMonitorIndex !== targetMonitorIndex)
            win.move_to_monitor(targetMonitorIndex);
    }

    toggleOverview() {
        if (Main.overview._shown) {
            Main.overview.hide();
        } else {
            Main.overview.disconnectObject(this._wsp);
            this._wsp.fadeAndDestroy();
            Main.overview.show(); // 2 for App Grid
        }
    }

    toggleAppGrid() {
        if (Main.overview.dash.showAppsButton.checked) {
            Main.overview.hide();
        } else if (Main.overview._shown) {
            Main.overview.dash.showAppsButton.checked = true;
        } else {
            Main.overview.disconnectObject(this._wsp);
            this._wsp.fadeAndDestroy();
            Main.overview.show(2); // 2 for App Grid
        }
    }

    toggleFullscreenOnNewWS(metaWin) {
        metaWin = metaWin ?? this._getSelectedWindow();
        if (!metaWin)
            return;

        // if property fullscreen === true, win was already maximized on new ws
        if (metaWin.fullscreen) {
            metaWin.unmake_fullscreen();
            if (metaWin._originalWS) {
                let ws = false;
                for (let i = 0; i < global.workspaceManager.n_workspaces; i++) {
                    let w = global.workspaceManager.get_workspace_by_index(i);
                    if (w === metaWin._originalWS) {
                        ws = true;
                        break;
                    }
                }
                if (ws) {
                    metaWin.change_workspace(metaWin._originalWS);
                    Main.wm.actionMoveWorkspace(metaWin._originalWS);
                }
                metaWin._originalWS = null;
            }
        } else {
            let ws = metaWin.get_workspace();
            metaWin._originalWS = ws;
            metaWin.make_fullscreen();
            let nWindows = ws.list_windows().filter(
                win =>
                    // w.get_window_type() === Meta.WindowType.NORMAL &&
                    !win.is_on_all_workspaces()
            ).length;
            if (nWindows > 1) {
                let newWsIndex = ws.index() + 1;
                Main.wm.insertWorkspace(newWsIndex);
                let newWs = global.workspace_manager.get_workspace_by_index(newWsIndex);
                metaWin.change_workspace(newWs);
                metaWin.activate(global.get_current_time());
            }
        }
    }

    toggleMaximizeOnCurrentMonitor(metaWin) {
        metaWin = metaWin ?? this._getSelectedWindow();
        if (!metaWin)
            return;

        const monitorIndex = this._wsp._monitorIndex; // this._wsp._keyboardTriggered ? this._wsp._monitorIndex : -1

        if (metaWin.get_workspace().index() === global.workspace_manager.get_active_workspace().index() &&
            monitorIndex === metaWin.get_monitor()) {
            if ((metaWin.get_maximized && metaWin.get_maximized() === Meta.MaximizeFlags.BOTH) ||
                (metaWin.is_maximized && metaWin.is_maximized()) // Since GNOME 49
            ) {
                if (metaWin.get_maximized)
                    metaWin.unmaximize(Meta.MaximizeFlags.BOTH);
                else // Since GNOME 49
                    metaWin.unmaximize();
            } else if (metaWin.get_maximized) {
                metaWin.maximize(Meta.MaximizeFlags.BOTH);
            } else { // Since GNOME 49
                metaWin.maximize();
            }
        } else {
            // If the window is already maximized, it must be unmaximized first
            // otherwise, it will restore on the original monitor instead of the current one
            if (metaWin.get_maximized)
                metaWin.unmaximize(Meta.MaximizeFlags.BOTH);
            else // Since GNOME 49
                metaWin.unmaximize();
            this._moveWindowToCurrentWs(metaWin, monitorIndex);
            if (metaWin.get_maximized)
                metaWin.maximize(Meta.MaximizeFlags.BOTH);
            else // Since GNOME 49
                metaWin.maximize();
        }

        this._wsp._showWindow();
        this._wsp._updateSwitcher();
    }

    toggleMinimize(metaWin) {
        metaWin = metaWin ?? this._getSelectedWindow();
        if (!metaWin)
            return;

        if (!metaWin.minimized) {
            // this._setMetaWinIconGeometry(metaWin, this._wsp._items[this._wsp._selectedIndex]);
            metaWin.minimize();
        } else {
            this._moveWindowToCurrentWs(metaWin, this._wsp._monitorIndex);
            metaWin.unminimize();
            metaWin.activate(global.get_current_time());
        }
        this._wsp._delayedUpdate(250);
    }

    _setMetaWinIconGeometry(metaWin, selected) {
        const geometry = metaWin.get_icon_geometry()[1];
        [geometry.x, geometry.y] = selected.get_transformed_position();

        metaWin.set_icon_geometry(geometry);
    }

    toggleAboveWindow(metaWindow) {
        let win = metaWindow;
        if (!win)
            return;
        if (win.is_above())
            win.unmake_above();
        else if (!(win.get_maximized && win.get_maximized() === Meta.MaximizeFlags.BOTH) ||
                 (win.is_maximized && win.is_maximized()) // Since GNOME 49
        )
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

    switchWorkspace(direction) {
        direction = Util.translateDirectionToHorizontal(direction);
        const targetWs = global.workspaceManager.get_active_workspace().get_neighbor(direction);
        Main.wm.actionMoveWorkspace(targetWs);
    }

    showWsSwitcherPopup(wsIndex) {
        if (!this._opt?.SHOW_WS_SWITCHER_POPUP)
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

        if (!this._wsp._wsTmb)
            this.showWsSwitcherPopup();
    }

    createWindowThumbnail(metaWin) {
        metaWin = metaWin ?? this._getSelectedWindow();
        if (!metaWin)
            return;

        if (global.windowThumbnails)
            global.windowThumbnails.createThumbnail(metaWin);
        else
            Main.notify(_('Create Window Thumbnail'), _('This action requires the Window Thumbnails extension installed on your system'));
    }

    removeLastWindowThumbnail() {
        if (global.windowThumbnails)
            global.windowThumbnails.removeLast();
    }

    removeAllWindowThumbnails() {
        if (global.windowThumbnails)
            global.windowThumbnails.removeAll();
    }

    openPrefsWindow() {
        // if prefs window already exist, move it to the current WS and activate it
        const metadata = this.Me.metadata;
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
        this._wsp.fadeAndDestroy();
    }
};

/* This is a part of Custom Hot Corners - Extended, the Gnome Shell extension
 * Copyright 2021 GdH <georgdh@gmail.com>
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

const GObject        = imports.gi.GObject;
const GLib           = imports.gi.GLib;
const Clutter        = imports.gi.Clutter;
const St             = imports.gi.St;
const Meta           = imports.gi.Meta;
const Main           = imports.ui.main;
const Util           = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;
const SystemActions  = imports.misc.systemActions;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;
const WinTmb         = Me.imports.winTmb;

let GNOME40;

const ws_indicator_mode = { 'DISABLE':       0,
                            'DEFAULT':       1,
                            'INDEX':         2
                        }

var get_current_monitor_geometry = function () {
    return global.display.get_monitor_geometry(global.display.get_current_monitor());
}


var Actions = class {
    constructor() {
        this._mscOptions = new Settings.MscOptions();
        this._signalsCollector      = [];

        this._minimizedWindows      = [];

        this.WS_IGNORE_LAST         = this._mscOptions.wsSwitchIgnoreLast;
        this.WS_WRAPAROUND          = this._mscOptions.wsSwitchWrap;
        this.WS_INDICATOR_MODE      = this._mscOptions.wsSwitchIndicatorMode;

        this.WIN_SKIP_MINIMIZED     = this._mscOptions.winSkipMinimized;

        //this.windowThumbnails       = [];
        //this.tmbConnected           = false;

        GNOME40 = Settings.GNOME40;

    }

    clean(full = true) {
        // don't reset effects and destroy thumbnails if extension is enabled (GS calls ext. disable() before locking the screen f.e.)
        if (full) {
            this._resetSettings();
            for (let sig of this._signalsCollector) {
                sig[0].disconnect(sig[1]);
            }
        }
        //global.workspace_manager.disconnect(this._signalsCollector.pop());
        this._removeThumbnails(full);
    }

    resume() {
        this._resumeThumbnailsIfExist();
    }

    _resetSettings() {
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

    _getFocusedWindow(sameWorkspace = false) {
        let win = global.display.get_focus_window();
        if (    !win ||
                (sameWorkspace && (global.workspace_manager.get_active_workspace() !== win.get_workspace()) )
            ) {
            return null;
        }
        return win;
        /*let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        for (let win of windows) {
            if (win.has_focus()) {
                return win;
            }
        }
        log (`[${Me.metadata.name}] Warning: no focused window found`);
        return null;*/
    }

    _getFocusedActor() {
        let actor = null;
        for (let act of global.get_window_actors()) {
            let meta_window = act.get_meta_window();
            if(meta_window.has_focus())
                actor = act;
        }
        if (!actor) log (`[${Me.metadata.name}] Warning: no focused window found`);
        return actor;
    }

    _getActorByMetaWin(metaWindow) {
        for (let act of global.get_window_actors()) {
            if (act.get_meta_window() === metaWindow)
                return act;
        }
        return null;
    }

    /////////////////////////////////////////////////////////////////////////////

    moveToWorkspace(index) {
        if (index < 0)  return;
        let maxIndex = global.workspaceManager.n_workspaces - 1;
        if (maxIndex < index) {
            index = maxIndex;
        }
        let ws = global.workspaceManager.get_workspace_by_index(index);
        Main.wm.actionMoveWorkspace(ws);
        // another option
        //ws.activate(global.get_current_time());
    }
    closeWindow() {
        let win = this._getFocusedWindow(true);
        if (!win) return;
        win.delete(global.get_current_time());
    }
    killApplication() {
        let win = this._getFocusedWindow(true);
        if (!win) return;
        win.kill();
    }
    toggleMaximizeWindow() {
        let win = this._getFocusedWindow(true);
        if (!win) return;
        if (win.maximized_horizontally && win.maximized_vertically)
            win.unmaximize(Meta.MaximizeFlags.BOTH);
        else win.maximize(Meta.MaximizeFlags.BOTH);
    }
    minimizeWindow() {
        let win = this._getFocusedWindow(true);
        if (!win) return;
        win.minimize();
        //global.display.get_tab_list(0, null)[0].minimize();
    }
    unminimizeAll(workspace=true) {
        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        let activeWorkspace = global.workspaceManager.get_active_workspace();
        for (let win of windows) {
            if (workspace && (activeWorkspace !== win.get_workspace()) ) {
                continue;
            }
            win.unminimize();
        }
    }
    toggleFullscreenWindow() {
        let win = this._getFocusedWindow(true);
        if (!win) return;
        if (win.fullscreen) win.unmake_fullscreen();
        else win.make_fullscreen();
    }
    fullscreenWinOnEmptyWs(metaWindow = null, nextWs = false) {
        let win;
        if (!metaWindow)
            win = this._getFocusedWindow(true);
        else
            win = metaWindow;

        if (!win) return;
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
                let lastWs = global.workspaceManager.n_workspaces-1;
                lastWs = global.workspaceManager.get_workspace_by_index(lastWs);
                //Main.wm.actionMoveWorkspace(lastWs);
                win.change_workspace(lastWs);
                global.workspace_manager.reorder_workspace(lastWs, ws.index()+1);
            }
            win.activate(global.get_current_time());
        }
    }
    toggleAboveWindow(metaWindow) {
        let win = metaWindow || this._getFocusedWindow(true);
        if (!win) return;
        if (win.is_above()) {
            win.unmake_above();
        }
        else {
            win.make_above();
        }
    }
    toggleStickWindow(metaWindow) {
        let win = metaWindow || this._getFocusedWindow(true);
        if (!win) return;
        if (win.is_on_all_workspaces()){
            win.unstick();
        }
        else{
            win.stick();
        }
    }
    switchWorkspace(direction, noIndicator = false) {
            let n_workspaces = global.workspaceManager.n_workspaces;
            let lastWsIndex =  n_workspaces - (this.WS_IGNORE_LAST ? 2 : 1);
            let motion;
    
            let activeWs  = global.workspaceManager.get_active_workspace();
            let activeIdx = activeWs.index();
            let targetIdx = this.WS_WRAPAROUND ? 
                            (activeIdx + (direction ? 1 : lastWsIndex )) % (lastWsIndex + 1) :
                            activeIdx + (direction ? 1 : -1);
            if (targetIdx < 0 || targetIdx > lastWsIndex) {
                targetIdx = activeIdx;
            }
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

                // Do not show wokspaceSwithcer in overview
                if (!Main.overview.visible) {
                    let motion = direction ? (vertical? Meta.MotionDirection.DOWN : Meta.MotionDirection.RIGHT)
                                           : (vertical? Meta.MotionDirection.UP   : Meta.MotionDirection.LEFT);
                    Main.wm._workspaceSwitcherPopup.display(motion, ws.index());
                }
            }

            Main.wm.actionMoveWorkspace(ws);

            // show workspace index overlay if wanted
            if (this.WS_INDICATOR_MODE === ws_indicator_mode.INDEX && showIndicator)
                this.showWorkspaceIndex();
    }
    showWorkspaceIndex(position = [], timeout = 600, names = {}) {

        let wsIndex = global.workspace_manager.get_active_workspace().index();
        let text = names[wsIndex];
        if (!text) text = `${wsIndex + 1}`;

        if (!this._wsOverlay) {

            //let monitorIndex = global.display.get_current_monitor();
            //let geometry = global.display.get_monitor_geometry(monitorIndex);
            let geometry = get_current_monitor_geometry();


            this._wsOverlay = new St.Label ({
                        name: 'ws-index',
                        text: text,
                        x: position.length ? position[0] : geometry.x,
                        y: position.length ? position[1] : geometry.y + (geometry.height / 2),
                        width: geometry.width,
                        style_class: 'workspace-overlay',
                        reactive: true
            });
            Main.layoutManager.addChrome(this._wsOverlay);
        } else if (this._wsOverlay) {
            this._wsOverlay.set_text(text);
            if (this._wsOverlay._timeoutId) {
                GLib.source_remove(this._wsOverlay._timeoutId);
                this._wsOverlay._timeoutId = 0;
            }
        }

        if (timeout) {

            this._wsOverlay._timeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                timeout,
                () => {
                    if (this._wsOverlay !== null) {
                        Main.layoutManager.removeChrome(this._wsOverlay);
                        this._wsOverlay.destroy();
                        this._wsOverlay = null;
                    }
                    return GLib.SOURCE_REMOVE;
            });
        }

        return this._wsOverlay;
    }

    makeThumbnailWindow(metaWindow = null) {
        if (!global.stage.windowThumbnails) global.stage.windowThumbnails = [];
        let metaWin;
        if (metaWindow) {
            metaWin = metaWindow;
        }
        if (!metaWin) return;

        let monitorHeight = get_current_monitor_geometry().height;
        let scale = this._mscOptions.winThumbnailScale;
        global.stage.windowThumbnails.push( new WinTmb.WindowThumbnail(metaWin, this, {  'actionTimeout': this._mscOptions.actionEventDelay,
                                                                                'height' : Math.floor(scale / 100 * monitorHeight),
                                                                                'thumbnailsOnScreen' : global.stage.windowThumbnails.length
                                                                             }
                                                                        )
        );
    }

};


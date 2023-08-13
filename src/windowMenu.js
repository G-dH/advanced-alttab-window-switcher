/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * WindowMenu
 * modified original windowMenu modul
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2023
 * @license    GPL-3.0
 */

// const { Meta, St, Clutter } = imports.gi;
import Meta from 'gi://Meta';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

// const BoxPointer = imports.ui.boxpointer;
// const Main = imports.ui.main;
// const PopupMenu = imports.ui.popupMenu;
// const Screenshot = imports.ui.screenshot;
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Screenshot from 'resource:///org/gnome/shell/ui/screenshot.js';

import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
// const Config = imports.misc.config;
// const shellVersion = parseFloat(Config.PACKAGE_VERSION);

// gettext
// const Me = imports.misc.extensionUtils.getCurrentExtension();
// const _ = Me.imports.src.settings._;


export const WindowMenu = class extends PopupMenu.PopupMenu {
    constructor(window, sourceActor, aatws) {
        super(sourceActor, 0.5, St.Side.LEFT);

        this._aatws = aatws;
        this.actor.add_style_class_name('window-menu');

        Main.layoutManager.uiGroup.add_actor(this.actor);
        this.actor.hide();

        this._buildMenu(window);
    }

    _buildMenu(window) {
        let type = window.get_window_type();

        let item;

        // Translators: entry in the window right click menu.
        item = this.addAction(_('Take Screenshot'), async () => {
            try {
                const actor = window.get_compositor_private();
                const content = actor.paint_to_content(null);
                const texture = content.get_texture();

                await Screenshot.captureScreenshot(texture, null, 1, null);
            } catch (e) {
                logError(e, 'Error capturing screenshot');
            }
        });


        item = this.addAction(_('Hide'), () => {
            window.minimize();
        });
        if (!window.can_minimize())
            item.setSensitive(false);

        if (window.get_maximized()) {
            item = this.addAction(_('Restore'), () => {
                window.unmaximize(Meta.MaximizeFlags.BOTH);
            });
        } else {
            item = this.addAction(_('Maximize'), () => {
                window.maximize(Meta.MaximizeFlags.BOTH);
            });
        }
        if (!window.can_maximize())
            item.setSensitive(false);

        item = this.addAction(_('Always on Top'), () => {
            if (window.is_above())
                window.unmake_above();
            else
                window.make_above();

            this._aatws._updateSwitcher();
        });
        if (window.is_above())
            item.setOrnament(PopupMenu.Ornament.CHECK);
        if (window.get_maximized() === Meta.MaximizeFlags.BOTH ||
            type === Meta.WindowType.DOCK ||
            type === Meta.WindowType.DESKTOP ||
            type === Meta.WindowType.SPLASHSCREEN)
            item.setSensitive(false);

        if (Main.sessionMode.hasWorkspaces &&
            (!Meta.prefs_get_workspaces_only_on_primary() ||
             window.is_on_primary_monitor())) {
            let isSticky = window.is_on_all_workspaces();

            item = this.addAction(_('Always on Visible Workspace'), () => {
                if (isSticky)
                    window.unstick();
                else
                    window.stick();

                this._aatws._updateSwitcher();
            });
            if (isSticky)
                item.setOrnament(PopupMenu.Ornament.CHECK);
            if (window.is_always_on_all_workspaces())
                item.setSensitive(false);

            if (!isSticky) {
                const vertical = global.workspaceManager.layout_rows === -1;
                if (!vertical) {
                    this.addAction(_('Move to Workspace Left'), () => {
                        let dir = Clutter.ScrollDirection.UP;
                        this._aatws._moveWinToAdjacentWs(dir);
                    });
                }
                if (!vertical) {
                    this.addAction(_('Move to Workspace Right'), () => {
                        let dir = Clutter.ScrollDirection.DOWN;
                        this._aatws._moveWinToAdjacentWs(dir);
                    });
                }
                if (vertical) {
                    this.addAction(_('Move to Workspace Up'), () => {
                        let dir = Clutter.ScrollDirection.UP;
                        this._aatws._moveWinToAdjacentWs(dir);
                    });
                }
                if (vertical) {
                    this.addAction(_('Move to Workspace Down'), () => {
                        let dir = Clutter.ScrollDirection.DOWN;
                        this._aatws._moveWinToAdjacentWs(dir);
                    });
                }
            }
        }

        let display = global.display;
        let nMonitors = display.get_n_monitors();
        let monitorIndex = window.get_monitor();
        if (nMonitors > 1 && monitorIndex >= 0) {
            this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

            let dir = Meta.DisplayDirection.UP;
            let upMonitorIndex =
                display.get_monitor_neighbor_index(monitorIndex, dir);
            if (upMonitorIndex !== -1) {
                this.addAction(_('Move to Monitor Up'), () => {
                    window.move_to_monitor(upMonitorIndex);
                });
            }

            dir = Meta.DisplayDirection.DOWN;
            let downMonitorIndex =
                display.get_monitor_neighbor_index(monitorIndex, dir);
            if (downMonitorIndex !== -1) {
                this.addAction(_('Move to Monitor Down'), () => {
                    window.move_to_monitor(downMonitorIndex);
                });
            }

            dir = Meta.DisplayDirection.LEFT;
            let leftMonitorIndex =
                display.get_monitor_neighbor_index(monitorIndex, dir);
            if (leftMonitorIndex !== -1) {
                this.addAction(_('Move to Monitor Left'), () => {
                    window.move_to_monitor(leftMonitorIndex);
                });
            }

            dir = Meta.DisplayDirection.RIGHT;
            let rightMonitorIndex =
                display.get_monitor_neighbor_index(monitorIndex, dir);
            if (rightMonitorIndex !== -1) {
                this.addAction(_('Move to Monitor Right'), () => {
                    window.move_to_monitor(rightMonitorIndex);
                });
            }
        }

        this.addAction(_('Move to Current Workspace'), () => {
            // window.change_workspace(global.workspace_manager.get_active_workspace());
            this._aatws._getActions().moveWindowToCurrentWs(window, this._aatws.KEYBOARD_TRIGGERED ? this._aatws._monitorIndex : -1);
        });

        item = this.addAction(_('Fullscreen on Empty Workspace'), () => {
            // window.change_workspace(global.workspace_manager.get_active_workspace());
            this._aatws._getActions().fullscreenWinOnEmptyWs(window);
            this._aatws._updateSwitcher();
        });
        if (window._originalWS)
            item.setOrnament(PopupMenu.Ornament.CHECK);

        this.addAction(_('Create Window Thumbnail (PIP)'), () => {
            // window.change_workspace(global.workspace_manager.get_active_workspace());
            this._aatws._getActions().makeThumbnailWindow(window);
        });

        this.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        item = this.addAction(_('Close'), event => {
            window.delete(event.get_time());
        });
        if (!window.can_close())
            item.setSensitive(false);
    }
};

export const WindowMenuManager = class {
    constructor(aatws) {
        this._aatws = aatws;
        this._manager = new PopupMenu.PopupMenuManager(Main.layoutManager.dummyCursor);
    }

    showWindowMenuForWindow(window, type, sourceActor) {
        if (!Main.sessionMode.hasWmMenus)
            return;

        if (type !== Meta.WindowMenuType.WM)
            throw new Error('Unsupported window menu type');

        let menu = new WindowMenu(window, sourceActor, this._aatws);

        this._manager.addMenu(menu);

        menu.connect('activate', () => {
            window.check_alive(global.get_current_time());
        });
        let destroyId = window.connect('unmanaged', () => {
            menu.close();
        });

        menu.open(BoxPointer.PopupAnimation.FADE);
        menu.actor.navigate_focus(null, St.DirectionType.TAB_FORWARD, false);
        menu.connect('open-state-changed', (menu_, isOpen) => {
            if (isOpen)
                return;

            menu.destroy();
            window.disconnect(destroyId);
        });

        this.menu = menu;
    }
};

'use strict';

const {GObject, GLib, St, Shell, Gdk} = imports.gi;
const Clutter                = imports.gi.Clutter;
const Meta                   = imports.gi.Meta;
const Main                   = imports.ui.main;
const AltTab                 = imports.ui.altTab;
const AppFavorites           = imports.ui.appFavorites;

const ExtensionUtils         = imports.misc.extensionUtils;
const Me                     = ExtensionUtils.getCurrentExtension();
const Settings               = Me.imports.settings;
const ActionLib              = Me.imports.actions;

const Config                 = imports.misc.config;
var   shellVersion           = Config.PACKAGE_VERSION;
var   GNOME40 = shellVersion.startsWith("40")
                    ? GNOME40 = true
                    : GNOME40 = false;

const options = new Settings.MscOptions();

const FilterModes = {
    'ALL'       : 1,
    'WORKSPACE' : 2,
    'MONITOR'   : 3,
}

const FilterModeLabels = [ '',
    _('ALL'),
    _('WS '),
    _('MON'),
]

const Positions = {
    'TOP'           : 1,
    'CENTER'        : 2,
    'BOTTOM'        : 3,
}

const SortModes = {
    'DEFAULT'           : 1,
    'CURRENT_MON_FIRST' : 2,
    'APPS'              : 3,
    'WORKSPACES'        : 4,
}

const SortModeLabels = [ '',
    _('Default'),
    _('Current mon first'),
    _('Applications'),
    _('Workspaces'),
]

const SelectionModes = {
    'NONE'  : -1,
    'ACTIVE':  0,
    'RECENT':  1,
}

let WS_INDEXES;
let HOT_KEYS;
let showHotKeys;

let APP_ICON_SIZE = 128;
let WINDOW_PREVIEW_SIZE = 256;

function _shiftPressed(){
    return global.get_pointer()[2] & Clutter.ModifierType.SHIFT_MASK;
}

var   WindowSwitcherPopup = GObject.registerClass(
class WindowSwitcherPopup extends AltTab.WindowSwitcherPopup {

    _init() {
        super._init();
        this._actions              = new ActionLib.Actions();
        this._initialSelectionMode = SelectionModes.RECENT;     // window selector modes: -1 select none, 0 select active, 1 select recent
        this.KEYBOARD_TRIGGERED    = true;  // whether was popup triggered by a keyboard. when true, POSITION_POINTER will be ignored
        this._keyBind              = '';
        this._modifierMask         = 77;    // Shift|Ctrl|Alt|Super, when custom shortcut is used, release of all of these keys hides the popup
        this.POSITION_POINTER      = options.winSwitcherPopupPointer; // place popup at pointer position
        this.WIN_FILTER_MODE       = options.winSwitcherPopupWinFilter;
        if ((Main.layoutManager.monitors.length < 2) && this.WIN_FILTER_MODE === FilterModes.MONITOR)
            this.WIN_FILTER_MODE   = FilterModes.WORKSPACE;
        this.SORT_MODE             = options.winSwitcherPopupWinOrder;
        this._defaultOrder         = this.SORT_MODE; // remember default sorting
        this.POPUP_POSITION        = options.winSwitcherPopupPosition;
        this.NO_MODS_TIMEOUT       = options.winSwitcherPopupPointerTimeout;
        this._initialDelayTimeout  = options.winSwitcherPopupTimeout;
             WS_INDEXES            = options.winSwitcherPopupWsIndexes;
             HOT_KEYS              = options.winSwitcherPopupHotKeys;
             APP_ICON_SIZE         = options.winSwitcherPopupIconSize;
             WINDOW_PREVIEW_SIZE   = options.winSwitcherPopupSize;
        this.SKIP_MINIMIZED        = options.winSkipMinimized;
        this._showWinImmediately   = options.winSwitcherPopupShowImmediately;
        this._monitorIndex         = global.display.get_current_monitor();
        this._showWorkspaceIndex   = options.wsSwitchIndicator;

        this._selectApp            = null;
        this._searchEntry          = null;
        if (options.winSwitcherPopupStartSearch) {
            this._searchEntry = '';
        }
        this._selectedIndex        = -1;    // deselect

        this._newWindowConnector   = global.display.connect_after('window-created', ()=>{this.show()});
        this.connect('destroy', this._onDestroyThis.bind(this));
    }

    _onDestroyThis() {
        // _initialDelayTimeoutId was already removed in super class
        //global.workspace_manager.disconnect(this._wsChangedId);
        if (this._actions._wsOverlay) {
            Main.layoutManager.removeChrome(this._actions._wsOverlay);
            this._actions._wsOverlay.destroy();
            this._actions._wsOverlay = null;
        }
        if (this._showWinImmediatelyTimeoutId) {
            GLib.source_remove(this._showWinImmediatelyTimeoutId);
        }
        global.display.disconnect(this._newWindowConnector);
        this._actions = null;
    }

    vfunc_allocate(box, flags) {
        let monitor = this._getMonitorByIndex(this._monitorIndex);
        GNOME40 ?   this.set_allocation(box)
                :   this.set_allocation(box, flags);
        let childBox = new Clutter.ActorBox();
        // Allocate the switcherList
        // We select a size based on an icon size that does not overflow the screen
        let [, childNaturalHeight] = this._switcherList.get_preferred_height(monitor.width);
        let [, childNaturalWidth] = this._switcherList.get_preferred_width(childNaturalHeight);
        if (this.POSITION_POINTER && !this.KEYBOARD_TRIGGERED) {
            childBox.x1 = Math.min(this._pointer.x, monitor.x + monitor.width - childNaturalWidth);
            if (childBox.x1 < monitor.x) childBox.x1 = monitor.x;
            childBox.y1 = Math.min(this._pointer.y, monitor.height - childNaturalHeight);
        } else {
            childBox.x1 = Math.max(monitor.x, monitor.x + Math.floor((monitor.width - childNaturalWidth) / 2));
            let offset = Math.floor((monitor.height - childNaturalHeight)/2);
            if (this.POPUP_POSITION === Positions.TOP) offset = 0;
            if (this.POPUP_POSITION === Positions.BOTTOM) offset = monitor.height - childNaturalHeight;
            childBox.y1 = monitor.y + offset;
        }
        childBox.x2 = Math.min(monitor.x + monitor.width, childBox.x1 + childNaturalWidth);
        childBox.y2 = childBox.y1 + childNaturalHeight;
        GNOME40 ?   this._switcherList.allocate(childBox)
                :   this._switcherList.allocate(childBox, flags);
    }

    _initialSelection(backward, binding) {
        if (this._items.length == 1) {
            this._select(0);
        } else if (backward) {
            if (this._initialSelectionMode === SelectionModes.RECENT)
                this._select(this._items.length - 1);
            else if (this._initialSelectionMode === SelectionModes.ACTIVE)
                this._select(0);
        } else {
            if (this._initialSelectionMode === SelectionModes.RECENT)
                this._select(1);
            else if (this._initialSelectionMode === SelectionModes.ACTIVE)
                this._select(0);
        }
    }

    show(backward, binding, mask) {
        showHotKeys = this.KEYBOARD_TRIGGERED;
        if (this._pointer == undefined) {
            this._pointer = [];
            [this._pointer.x, this._pointer.y, ] = global.get_pointer();
            this._haveModal = true;
            this.iconMode = this._settings.get_enum('app-icon-mode');
        }
        let windows = this._getWindowList();
        if (windows.length === 0) {
            let origMod = this.WIN_FILTER_MODE;
            for (let mod = origMod; mod > 0; mod--) {
                this.WIN_FILTER_MODE = mod;
                windows = this._getWindowList();
                if (windows.length > 0) {
                    this._initialSelectionMode = SelectionModes.NONE;
                    this._selectedIndex = -1;
                    break;
                }
            }
            this.WIN_FILTER_MODE = origMod;
        }
        if (windows.length > 0) {
            if (this._switcherList) this._switcherList.destroy();
            this._switcherList = new WindowSwitcher(windows, this.iconMode);
            this._items = this._switcherList.icons;

            this._writeFlagsToIconLabels(this._switcherList.icons);

            this.showOrig(backward, binding, mask);
            return true;
        }

        // no window, nothing to show, revert all before class destroyed
        this._onDestroyThis();
        return false;
    }

    showOrig(backward, binding, mask) {
        if (this._items.length == 0) {
            return false;
        }
        if (!Main.pushModal(this)) {
            if (!Main.pushModal(this, { options: Meta.ModalOptions.POINTER_ALREADY_GRABBED }))
                return false;
        }
        this._alreadyShowed = true;

        this._haveModal = true;

        this.add_actor(this._switcherList);
        this._switcherList.connect('item-activated', this._itemActivated.bind(this));
        this._switcherList.connect('item-entered', this._itemEntered.bind(this));
        this._switcherList.connect('item-removed', this._itemRemoved.bind(this));

        this.visible = true;
        //this._switcherList.opacity = 255;
        this.opacity = 0;
        this.get_allocation_box();
        this._initialSelection(backward, binding);

        // There's a race condition; if the user released Alt before
        // we got the grab, then we won't be notified. (See
        // https://bugzilla.gnome.org/show_bug.cgi?id=596695 for
        // details.) So we check now. (Have to do this after updating
        // selection.)
        if (mask !== undefined) this._modifierMask = mask;
        if (this._modifierMask) {
            let mods = global.get_pointer()[2];
            if (!(mods & this._modifierMask)) {
                this._finish(global.get_current_time());
                return true;
            }
        } else {
            this._resetNoModsTimeout();
        }

        this._setSwitcherInfo();

        // We delay showing the popup so that fast Alt+Tab users aren't
        // disturbed by the popup briefly flashing.
        // but not when we're just overriding already shown content
        if (this._firstRun === undefined) {
            this._initialDelayTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this.KEYBOARD_TRIGGERED? this._initialDelayTimeout : 0,
                () => {
                    this._showImmediately();
                    this._initialDelayTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                });
            GLib.Source.set_name_by_id(this._initialDelayTimeoutId, '[gnome-shell] Main.osdWindow.cancel');
        } else this.opacity = 255;
        this._firstRun = false;
        if (this._initialSelectionMode === SelectionModes.RECENT || this._initialSelectionMode === SelectionModes.NONE)
            this._initialSelectionMode = SelectionModes.ACTIVE;
        this._resetNoModsTimeout();
        Main.osdWindowManager.hideAll();
        return true;
    }

    _setSwitcherInfo() {
        this._switcherList._infoLabel.set_text(

                    (this._searchEntry !== null ? _('Search:') + ' ' + this._searchEntry : '') + '  '
                    + _('Filter: ') + FilterModeLabels[this.WIN_FILTER_MODE] 
                    + (this._selectApp? '/' + _('APP') : '') + ',  '
                    + _('Order: ') + SortModeLabels[this.SORT_MODE]
        );
        if (this._searchEntry !== null) {
            this._showWsIndex().set_text(this._searchEntry);
        }
    }

    // just to move the indicator popup in order to not colide with the switcher
    _showWsIndex() {
        if (!this._showWorkspaceIndex)
            return;
        let monitorIndex = global.display.get_current_monitor();
        let geometry = global.display.get_monitor_geometry(monitorIndex);
        //let y = geometry.y;// + (this.POPUP_POSITION === Positions.CENTER ? geometry.height / 3 + this._switcherList.height : geometry.height / 2);
        let wsLabel = this._actions.showWorkspaceIndex([], 60000);
        if (this.POPUP_POSITION === Positions.BOTTOM) {
            wsLabel.y = Math.floor((geometry.height - this._switcherList.height - wsLabel.height));
        } else {
            wsLabel.y = Math.floor((geometry.height + this._switcherList.height) / 2);
        }
        return wsLabel;
    }

    _writeFlagsToIconLabels(items) {
        for (let item of items) {
            let win = item.window;
            let above = win.is_above();
            let sticky = win.is_on_all_workspaces();
            let size = item._icon.get_size()[0];
            //if (above) item._icon.set_size(Math.floor(1.5 * size), Math.floor(1.5 * size));
        }
    }

    _resetNoModsTimeout() {
        //print('_resetNoModsTimeout');
        if (this._noModsTimeoutId != 0)
            GLib.source_remove(this._noModsTimeoutId);
        this._noModsTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this.NO_MODS_TIMEOUT,
            () => {
                if (!this.KEYBOARD_TRIGGERED && this._isPointerOut() && this._searchEntry === null) {
                    if (this._showWinImmediately) {
                        if (this._lastShowed)
                            this._selectedIndex = this._lastShowed;
                        this._finish();
                    }
                    else
                        this.fadeAndDestroy();
                    this._noModsTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                } else {
                    this._noModsTimeoutId = 0;
                    this._resetNoModsTimeout();
                }
            }
        );
    }

    vfunc_key_press_event(keyEvent) {
        // print('vfunc_key_press_event');
        let keysym = keyEvent.keyval;
        // the action is an integer which is bind to the registered shortcut
        // but custom shortcuts are not stable
        let action = global.display.get_keybinding_action(
            keyEvent.hardware_keycode, keyEvent.modifier_state);
        this._disableHover();
        if (this._keyPressHandler(keysym, action) != Clutter.EVENT_PROPAGATE) {
            this._showImmediately();
            return Clutter.EVENT_STOP;
        }

        // Note: pressing one of the below keys will destroy the popup only if
        // that key is not used by the active popup's keyboard shortcut
        if (keysym === Clutter.KEY_Escape || keysym === Clutter.KEY_Tab)
            this.fadeAndDestroy();

        // Allow to explicitly select the current item; this is particularly
        // useful for no-modifier popups
        if (keysym === Clutter.KEY_space ||
            keysym === Clutter.KEY_Return ||
            keysym === Clutter.KEY_KP_Enter ||
            keysym === Clutter.KEY_ISO_Enter)
            this._finish(keyEvent.time);

        return Clutter.EVENT_STOP;
    }

    vfunc_key_release_event(keyEvent) {
        //print('vfunc_key_release_event');
        if (this._modifierMask) {
            let mods = global.get_pointer()[2];
            let state = mods & this._modifierMask;

            if (state === 0)

                if (this._selectedIndex !== -1) {
                    this.blockSwitchWsFunction = true;
                    this._finish(keyEvent.time);
                }
                else this.fadeAndDestroy();
        } else {
            this._resetNoModsTimeout();
        }

        return Clutter.EVENT_STOP;
    }

    _keyPressHandler(keysym, action) {
        let keysymName = Gdk.keyval_name(keysym);
        if (keysymName.match(/F[0-9][0-2]?/)) {
            let index = parseInt(keysymName.substring(1)) - 1;
            if (index < this._items.length) {
                this._selectedIndex = index;
                if (!_shiftPressed())
                    this._finish();
                else this._select(index); //this._switcherList.highlight(index);
            }
        }
        else if (this._searchEntry !== null && !_shiftPressed()) {
            if ( keysym === Clutter.KEY_BackSpace) {
                this._searchEntry = this._searchEntry.slice(0, -1);
                this.show();
                return Clutter.EVENT_STOP;
            }
            else if (this._searchEntry !== null && ((keysymName.length === 1 && (/[a-zA-Z0-9]/).test(keysymName)) || keysym === Clutter.KEY_space)) {
                if (keysymName === 'space') keysymName = ' ';
                this._searchEntry += keysymName;
                this.show();
                return Clutter.EVENT_STOP;
            }
        }
        if (action == Meta.KeyBindingAction.SWITCH_WINDOWS
                || ((   keysym === Clutter[`KEY_${this._keyBind.toUpperCase()}`]
                     || keysym === Clutter[`KEY_${this._keyBind.toLowerCase()}`]
                    ) && !_shiftPressed()
                   )
            ) {
                this._select(this._next());
        }

        else if (keysym == Clutter.KEY_e || keysym == Clutter.KEY_E || keysym == Clutter.KEY_Insert) {
            if (this._searchEntry !== null) {
                this._searchEntry = null;
            } else {
                this._searchEntry = '';
                this._modifierMask = 0;
            }
            this.show();
        }
        
        else if (action == Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD
                 || ((   keysym === Clutter[`KEY_${this._keyBind.toUpperCase()}`]
                      || keysym === Clutter[`KEY_${this._keyBind.toLowerCase()}`]
                    // if system shortcut not used, Shift key state for backwad switching has to be checked
                     ) && _shiftPressed()
                    )
                )
                this._select(this._previous());

        // implement VIM text navigation keys hjkl
        else if (keysym == Clutter.KEY_Left || keysym == Clutter.KEY_h || keysym == Clutter.KEY_H) {
                this._select(this._previous());
                //this._showSelectedWindow(this._selectedIndex);
            }

        else if (keysym == Clutter.KEY_Right || keysym == Clutter.KEY_l || keysym == Clutter.KEY_L) {
                this._select(this._next());
                //this._showSelectedWindow(this._selectedIndex);
            }

        else if (keysym == Clutter.KEY_Up || keysym == Clutter.KEY_Page_Up || keysym == Clutter.KEY_k || keysym == Clutter.KEY_K) {
                this._switchWorkspace(Clutter.ScrollDirection.UP);
        }

        else if (keysym == Clutter.KEY_Down || keysym == Clutter.KEY_Page_Down || keysym == Clutter.KEY_j || keysym == Clutter.KEY_J) {
                this._switchWorkspace(Clutter.ScrollDirection.DOWN);
        }

        else if (keysym === Clutter.KEY_Home)
            if (_shiftPressed())
                Main.wm.actionMoveWorkspace(global.workspace_manager.get_workspace_by_index(0));
            else
                this._select(0);

        else if (keysym === Clutter.KEY_End)
            if (_shiftPressed())
                Main.wm.actionMoveWorkspace(global.workspace_manager.get_workspace_by_index(global.workspace_manager.n_workspaces-1));
            else this._select(this._items.length - 1);

        else if (keysym === Clutter.KEY_q || keysym === Clutter.KEY_Q)
                this._switchFilterMode();

        else if (keysym === Clutter.KEY_space || keysym === Clutter.KEY_KP_0 || keysym === Clutter.KEY_KP_Insert) {
                this._showSelectedWindow(this._selectedIndex);
        }

        else if (keysym === Clutter.KEY_w || keysym === Clutter.KEY_W)
                this._closeWindow(this._selectedIndex);

        // make thumbnail of selected window
        else if (keysym === Clutter.KEY_t || keysym === Clutter.KEY_T)
                this._actions.makeThumbnailWindow(this._items[this._selectedIndex].window);

        // move selected window to current workspace
        else if (keysym === Clutter.KEY_x || keysym === Clutter.KEY_X) {
            this._moveSelectedWindowToCurrentWs();
        }

        else if (keysym === Clutter.KEY_m || keysym === Clutter.KEY_M) {
            if (this._selectedIndex < 0) return;
            let win = this._items[this._selectedIndex].window;
            let id = win.get_id();
            let min = win.minimized;
            if (min) {
                win.unminimize();
            } else {
                win.minimize();
            }
            this.show();
            this._select(this._getItemIndexByID(id));
        }

        else if (keysym === Clutter.KEY_plus || keysym === Clutter.KEY_1) {
            if (this._selectedIndex < 0) return;
            let id = this._items[this._selectedIndex].window.get_id();
            if (!this._selectApp) {
                if (this._items[this._selectedIndex]) {
                    this._selectApp = this._getWindowApp(this._items[this._selectedIndex].window);
                }
            }
            else this._selectApp = null;
            this.show();
            this._select(this._getItemIndexByID(id));
        }

        else if (keysym === Clutter.KEY_semicolon || keysym === 96 || keysym === 65112) { // 96 is tilde, I didn't find Clutter constant
                let index = this._selectedIndex > -1 ? this._selectedIndex : 0;
                if (this._selectApp) {
                    // when app filter is active this key will switch to next app group
                    this._switchNextApp = true;
                } else 
                    this.SORT_MODE = SortModes.APPS;
                this.show();
                if (!this._selectApp)
                    this._selectNextApp(index);
        }
        else if (keysym === Clutter.KEY_n || keysym === Clutter.KEY_N) {
            if (this._selectedIndex > -1) {
                let win = this._items[this._selectedIndex].window;
                Shell.WindowTracker.get_default().get_window_app(win).open_new_window(global.get_current_time());
                //this.show();
            }
        }
        // move selected window to current workspace and maximize
        else if (keysym === Clutter.KEY_v    || keysym === Clutter.KEY_V) {
                this._moveSelectedWindowToCurrentWs();
                this._items[this._selectedIndex].window.maximize(Meta.MaximizeFlags.BOTH);
                //this._items[this._selectedIndex].window.activate(global.get_current_time());
                //this.fadeAndDestroy();
        }
        else if (keysym === Clutter.KEY_f    || keysym === Clutter.KEY_F) {
                if (this._selectedIndex > -1) {
                    let win = this._items[this._selectedIndex].window;
                    let id = win.get_id();
                    this._actions.fullscreenWinOnEmptyWs(win);
                    this.show();
                    this._select(this._getItemIndexByID(id));
                }
        }
        // close all windows of the same class displayed in selector
        else if (keysym === Clutter.KEY_c || keysym === Clutter.KEY_C) {
                if (this.selectedIndex < 0) return;
                this._closeWinsOfSameApp();
        }
        // Force close (kill -9) the window process
        else if (keysym === Clutter.KEY_Delete) {
                if (!_shiftPressed() || this._selectedIndex < 0) return;
                this._items[this._selectedIndex].window.kill();
        }
        // make selected window Always on Top
        else if (keysym === Clutter.KEY_a || keysym === Clutter.KEY_A) {
                if (this._selectedIndex < 0) return;
                this._actions.toggleAboveWindow(this._items[this._selectedIndex].window);
                let win = this._items[this._selectedIndex].window;
                let id = win.get_id();
                Main.wm.actionMoveWorkspace(win.get_workspace());
                this.show();
                this._select(this._getItemIndexByID(id));
        }
        // make selected window Allways on Visible Workspace
        else if (keysym === Clutter.KEY_s || keysym === Clutter.KEY_S) {
                if (this._selectedIndex < 0) return;
                this._actions.toggleStickWindow(this._items[this._selectedIndex].window);
                let id = this._items[this._selectedIndex].window.get_id();
                this.show();
                this._select(this._getItemIndexByID(id));
        }
        else if (keysym === Clutter.KEY_g || keysym === Clutter.KEY_G) {
            let id = this._items[this._selectedIndex].window.get_id();
            if (this.SORT_MODE === SortModes.WORKSPACES)
                 this.SORT_MODE = this._defaultOrder;
            else this.SORT_MODE = SortModes.WORKSPACES;
            this.show();
            this._select(this._getItemIndexByID(id));
        }
        else if (keysym === Clutter.KEY_o || keysym === Clutter.KEY_O) {
            this.fadeAndDestroy();
            // Pressing the apps btn before overview activation avoids icons animation in GS 3.36/3.38
            Main.overview.dash.showAppsButton.checked = true;
            // in 3.36 pressing the button is usualy enough to activate overview, but not always
            Main.overview.show();
            // pressing apps btn before overview has no effect in GS 40, so once again
            Main.overview.dash.showAppsButton.checked = true;
        }
        else if (keysym === Clutter.KEY_p || keysym === Clutter.KEY_P) {
            Main.extensionManager.openExtensionPrefs(Me.metadata.uuid, '', {});
        }
        else
            return Clutter.EVENT_PROPAGATE;
        return Clutter.EVENT_STOP;
    }

    _switchWorkspace(direction) {
        let id = this._getSelectedID();
        this._actions.switchWorkspace(direction, true);
        this.show();
        if (this._selectedIndex > -1) {
            this._doNotShowWin = true;
            this._select(this._getItemIndexByID(id));
            this._doNotShowWin = false;
        }
        this._showWsIndex();
    }

    _getSelectedID() {
        let win = this._items[this._selectedIndex > -1 ? this._selectedIndex : 0].window;
        let id = win.get_id();
        return id;
    }

    _getWindowApp(metaWindow) {
        let tracker = Shell.WindowTracker.get_default();
        return tracker.get_window_app(metaWindow).get_id();
    }

    _selectNextApp(selectedIndex) {
        let targetIndex, step;
        if (_shiftPressed()) {
            targetIndex = 0;
            step = -1;
        } else {
            targetIndex = this._items.length - 1;
            step = 1
        }
        let secondRun = false;
        let winClass = this._items[selectedIndex].window.wm_class;
        for (let i = selectedIndex; i !== targetIndex + step; i += step) {
            if (this._items[i].window.wm_class !== winClass) {
                this._select(i);
                return;
            }
            // if no other app found try again from start
            if (i === targetIndex && !secondRun) {
                step === 1 ? i = -1 : i = this._items.length;
                secondRun = true;
            }
        }
    }

    _showSelectedWindow(_selectedIndex) {
        if (this._doNotShowWin) return;
        let win = this._items[_selectedIndex].window;
        let id = win.get_id();
        let a = win.above;
        win.make_above();
        a ? win.make_above() : win.unmake_above();
        Main.wm.actionMoveWorkspace(win.get_workspace());
        this._showWsIndex();
        // avoid colision of creating new switcher while destroying popup during the initial show delay, when immediate show win is enabled
        if (!this._initialDelayTimeoutId)
            this.show();
        this._doNotShowWin = true;
        this._select(this._getItemIndexByID(id));
        this._doNotShowWin = false;
    }

    _getItemIndexByID(id) {
        let index = 0;
        for (let i = 0; i < this._items.length; i++) {
            if (this._items[i].window.get_id() === id) {
                index = i;
                break;
            }
        }
        return index;
    }

    _switchFilterMode() {
        // if active ws has all windows on one monitor, ignore the monitor filter mode to avoid 'nothing happen' when switching between modes
        let m = ((Main.layoutManager.monitors.length > 1) && !this._allWSWindowsSameMonitor()) ? 3 : 2;
        this.WIN_FILTER_MODE = this.WIN_FILTER_MODE - 1;
        if (this.WIN_FILTER_MODE < FilterModes.ALL) this.WIN_FILTER_MODE = m;
        this.show();
    }

    _allWSWindowsSameMonitor() {
        let currentMonitor = global.display.get_current_monitor();
        let currentWS = global.workspace_manager.get_active_workspace();
        let windows = AltTab.getWindows(currentWS);
        if (windows.length === 0) return null;
        let ri = windows[0].get_monitor();
        for (let w of windows) {
            if (w.get_monitor() !== ri)
                return false;
        }
        return true;
    }

    vfunc_button_press_event(event) {
        let button = event.button;
        if (button === Clutter.BUTTON_PRIMARY) {
            /* We clicked outside popup*/
            if (this._isPointerOut()) {
                this.fadeAndDestroy();
                return Clutter.EVENT_PROPAGATE;
            } else {
                /* We clicked inside popup*/
                this._finish(event.time);
            }
        }
        if (button === Clutter.BUTTON_SECONDARY) {
            if (!this._isPointerOut()) {
                //this._moveSelectedWindowToCurrentWs();
                this._showSelectedWindow(this._selectedIndex);

            } else {
                this._moveSelectedWindowToCurrentWs();
                //this._actions.makeThumbnailWindow(this._items[this._selectedIndex].window);
            }
        }
        if (button === Clutter.BUTTON_MIDDLE) {
            if (this._isPointerOut()) {
                this._items[this._selectedIndex].window.kill();
            } else {
                this._closeWindow(this._selectedIndex);
            }
        }
        this._resetNoModsTimeout();
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_scroll_event(scrollEvent) {
        let direction = scrollEvent.direction;

        this._resetNoModsTimeout();

        if (this._isPointerOut()) {

            let activeWs = global.workspace_manager.get_active_workspace();
            let ws;
            // Gnome 40 has horizontal ws layout
            let vertical = global.workspaceManager.layout_rows === -1;
            switch (direction) {
                case Clutter.ScrollDirection.UP:
                case Clutter.ScrollDirection.LEFT:
                    this._switchWorkspace(Clutter.ScrollDirection.UP);
                    /*ws = activeWs.get_neighbor(vertical ? Meta.MotionDirection.UP : Meta.MotionDirection.LEFT);
                    this._actions.moveToWorkspace(ws.index());*/
                    //this._actions.switchWorkspace(Clutter.ScrollDirection.UP);
                    break;
                case Clutter.ScrollDirection.DOWN:
                case Clutter.ScrollDirection.RIGHT:
                    this._switchWorkspace(Clutter.ScrollDirection.DOWN);
                    /*ws = activeWs.get_neighbor(vertical ? Meta.MotionDirection.DOWN : Meta.MotionDirection.RIGHT);
                    this._actions.moveToWorkspace(ws.index());*/
                    //this._actions.switchWorkspace(Clutter.ScrollDirection.DOWN);
                    break;
                default:
                    return Clutter.EVENT_PROPAGATE;
            }

            //Main.wm.actionMoveWorkspace(ws);
            return Clutter.EVENT_STOP;

        } else {

            this._disableHover();
            this._scrollHandler(scrollEvent.direction);
            return Clutter.EVENT_PROPAGATE;
        }

    }

    _isPointerOut() {
        //print('_isPointerOut');
        let [x, y, mods] = global.get_pointer();
        let switcher = this._switcherList;
        let margin = 15;
        if (x < (switcher.x - margin) || x > (switcher.x + switcher.width + margin))
            return true;
        if (y < (switcher.y - margin)|| y > (switcher.y + switcher.height + margin))
            return true;
        return false;
    }


    _closeWinsOfSameApp() {
        let app = this._getWindowApp(this._items[this._selectedIndex].window);
        for (let item of this._items) {
            if (this._getWindowApp(item.window) === app)
                item.window.delete(global.get_current_time());
        }
    }

    _select(index) {
        if (this._initialSelectionMode === SelectionModes.NONE) {
            //this._selectedIndex = -1;
            this._initialSelectionMode = SelectionModes.ACTIVE;
        } else {
            this._selectedIndex = index;
            this._switcherList.highlight(index);
        }
        if (this._showWinImmediately) {
            if (this._showWinImmediatelyTimeoutId) {
                GLib.source_remove(this._showWinImmediatelyTimeoutId);
                this._showWinImmediatelyTimeoutId = 0;
            }
            //this._lastShowed = this._selectedIndex;
            if (!this._doNotShowWin) {
                this._showWinImmediatelyTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    100,
                    () => {
                        //this._selctNow(index);
                        //if (!this.KEYBOARD_TRIGGERED && !this._isPointerOut()) {
                            this._showSelectedWindow(this._selectedIndex);
                            this._lastShowed = this._selectedIndex;
                        //}
                        this._showWinImmediatelyTimeoutId = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            }
            return;
        }
        this._resetNoModsTimeout();
    }

    _getWindowList(allWindows = false) {
        // _init of the original class calls this function before winFilterMode var is set
        if (this.WIN_FILTER_MODE === undefined) return [];
        let workspace = null;
        let monitor = -1;
        let ws = global.workspace_manager.get_active_workspace();
        if (this.WIN_FILTER_MODE > FilterModes.ALL && !allWindows) {
            workspace = ws;
        }

        let winList = AltTab.getWindows(workspace);

        monitor = this._monitorIndex;
        // list windows on current monitor only

        if (!allWindows && this.WIN_FILTER_MODE === FilterModes.MONITOR && monitor > -1) {
            winList = winList.filter((w) => w.get_monitor() === monitor);
        }

        if (this.WIN_FILTER_MODE === FilterModes.ALL && this.SORT_MODE === SortModes.WORKSPACES) {
            winList.sort((a,b) => b.get_workspace().index() < a.get_workspace().index());
        }

        if (this.WIN_FILTER_MODE === FilterModes.ALL && this.SORT_MODE === SortModes.CURRENT_MON_FIRST) {
            // windows from the active workspace and monnitor first
            winList.sort((a, b) => ( (b.get_workspace().index() === ws.index() && b.get_monitor() === this._monitorIndex) 
                                  && (a.get_workspace().index() !== ws.index() || a.get_monitor() !== this._monitorIndex) ) );
        }

        if (this.SKIP_MINIMIZED)
            winList = winList.filter((w)=> !w.minimized);

        if (this._selectApp) {
            if (this._switchNextApp) {
                this._selectApp = this._getNextApp(winList);
                this._switchNextApp = false;
            }
            let tracker = Shell.WindowTracker.get_default();
            winList = winList.filter((w) => tracker.get_window_app(w).get_id() === this._selectApp);
        }

        if (this.SORT_MODE === SortModes.APPS) {
            let apps = this._getAppList(winList);
            winList.sort((a,b) => apps.indexOf(this._getWindowApp(b)) < apps.indexOf(this._getWindowApp(a)));
        }

        if (this._searchEntry) {
            const filterParetn = (wList, pattern)=> {return wList.filter((w) => {
                    // search in window title and app name
                    return this._match(w.title + Shell.WindowTracker.get_default().get_window_app(w).get_name(), pattern);
                });
            };
            let winListP = filterParetn(winList, this._searchEntry);
            // if no window match the pattern, remove the unmatched letter
            if (winListP.length === 0) {
                this._searchEntry = this._searchEntry.slice(0, -1);
                winListP = filterParetn(winList, this._searchEntry);
            }

            winList = winListP;
        }

        return winList;
    }

    _getNextApp(list) {
        let apps = this._getAppList(list);
        if (apps.length === 0) return;
        let currentIndex = apps.indexOf(this._selectApp);
        if (currentIndex < 0) return;
        let targetIndex;
        if (_shiftPressed()) {
            targetIndex = currentIndex + 1;
            if (targetIndex > (apps.length - 1)) targetIndex = 0;
        } else {
            targetIndex = currentIndex - 1;
            if (targetIndex < 0) targetIndex = apps.length - 1;
        }
        return apps[targetIndex];
    }

    _getAppList(list) {
        let apps = [];
        for (let win of list) {
            let app = this._getWindowApp(win);
            if (apps.indexOf(app) < 0)
                apps.push(app);
        }
        return apps;
    }

    _getMonitorByIndex(monitorIndex) {
        //print('_getMonitorByIndex');
        let monitors = Main.layoutManager.monitors;
        for (let monitor of monitors) {
            if (monitor.index === monitorIndex)
                return monitor;
        }
        return -1;
    }

    _moveSelectedWindowToCurrentWs() {
        let windowIcon = this._items[this._selectedIndex];
        if (!windowIcon)
            return;

        let ws = global.workspace_manager.get_active_workspace();
        let win = windowIcon.window;
        win.change_workspace(ws);
        let targetMonitorIndex = global.display.get_current_monitor();
        let currentMonitorIndex = win.get_monitor();
        if ( currentMonitorIndex !== targetMonitorIndex) {
            // move window to target monitor
            let actor = this._actions._getActorByMetaWin(win);
            let currentMonitor = this._getMonitorByIndex(currentMonitorIndex);
            let targetMonitor  = this._getMonitorByIndex(targetMonitorIndex);
           
            let x = targetMonitor.x + Math.max(Math.floor(targetMonitor.width - actor.width) / 2, 0);
            let y = targetMonitor.y + Math.max(Math.floor(targetMonitor.height - actor.height) / 2, 0);
            win.move_frame(true, x, y);
        }
        this._showSelectedWindow(this._selectedIndex);
            // in overview... no, don't activate the window immediately and keep the popup active in normal view too
            //if (!Main.overview.visible)
                //this._finish(global.get_current_time());
    }

    _match(string, pattern) {
        // remove diacritics and accents from letters
        let s = string.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        let p = pattern.toLowerCase();

        // allows to use 2 exact paterns separated by space in arbitrary order
        let ps = p.split(' ');
        if (ps.length > 1) {
            if (s.match(ps[0]+'.*'+ps[1]))
                return true;
            else
                return s.match(ps[1]+'.*'+ps[0])
        }
        else return s.match(p);
    }
});

var WindowIcon = GObject.registerClass(
class WindowIcon extends St.BoxLayout {
    _init(window, mode, iconIndex) {
        super._init({ style_class: 'alt-tab-app',
                      vertical: true });

        this.window = window;

        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });

        this.add_child(this._icon);
        this.label = new St.Label({ text: window.get_title() });

        let tracker = Shell.WindowTracker.get_default();
        this.app = tracker.get_window_app(window);

        let mutterWindow = this.window.get_compositor_private();

        this._icon.destroy_all_children();

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

        let switched = false;
        let size, cloneSize;

        cloneSize = WINDOW_PREVIEW_SIZE;
        size = WINDOW_PREVIEW_SIZE;
        if (APP_ICON_SIZE > WINDOW_PREVIEW_SIZE) {
            size = APP_ICON_SIZE;
            switched = true;
            cloneSize = Math.floor((mutterWindow.width / mutterWindow.height) * WINDOW_PREVIEW_SIZE);
        }

        let clone = AltTab._createWindowClone(mutterWindow, cloneSize * scaleFactor);
        let icon;
        if (this.app) {
            icon = this._createAppIcon( this.app,
                                        APP_ICON_SIZE);
        }
        let base, front;
        if (switched) {
            base  = icon;
            front = clone;
        } else {
            base  = clone;
            front = icon;
        }

        if (this.window.minimized)
            front.opacity = 80;

        this._alignFront(front);

        this._icon.add_actor(base);
        this._icon.add_actor(front);

        if (WS_INDEXES)
            this._icon.add_actor(this._createWsIcon(window.get_workspace().index()+1));

        if (showHotKeys && HOT_KEYS && iconIndex < 13)
            this._icon.add_actor(this._createHotKeyNumIcon((iconIndex)));

        if (this.window.is_on_all_workspaces())
            this._icon.add_actor(this._createStickyIcon());

        this._icon.set_size(size * scaleFactor, size * scaleFactor);
    }

    _alignFront(icon) {
        icon.x_align = icon.y_align = Clutter.ActorAlign.END;
        if (this.window.is_above()) icon.y_align = Clutter.ActorAlign.START;
    }

    _createAppIcon(app, size) {
        let appIcon = app ?
            app.create_icon_texture(size)
            : new St.Icon({ icon_name: 'icon-missing', icon_size: size });
        appIcon.x_expand = appIcon.y_expand = true;

        return appIcon;
    }

    _createWsIcon(index) {
        let currentWS = global.workspace_manager.get_active_workspace().index();
        let icon = new St.Widget({ x_expand: true,
                                   y_expand: true,
                                   x_align:  Clutter.ActorAlign.CENTER,
                                   y_align:  Clutter.ActorAlign.END });

        let box = new St.BoxLayout({ style_class: (currentWS+1 === index) ? 'workspace-index-highlight' : 'workspace-index',
                                     vertical: true });
        icon.add_actor(box);

        let label = new St.Label({ text: index.toString() });
        box.add(label);

        return icon;
    }

    // icon indicating diret activation key 
    _createHotKeyNumIcon(index) {
        let icon = new St.Widget({ x_expand: true,
                                   y_expand: true,
                                   x_align:  Clutter.ActorAlign.START,
                                   y_align:  Clutter.ActorAlign.START });

        let box = new St.BoxLayout({ style_class: 'hot-key-number',
                                     vertical: true });
        icon.add_actor(box);

        let label = new St.Label({ text: 'F' + (index+1).toString() });
        box.add(label);

        return icon;
    }

    _createStickyIcon() {
        let icon = new St.Widget({ x_expand: true,
                                  y_expand: true,
                                  x_align:  Clutter.ActorAlign.START,
                                  y_align:  Clutter.ActorAlign.END });
        let box = new St.BoxLayout({ style_class: 'workspace-index',
                                     vertical: true });
        let iconF = new St.Icon({ icon_name: 'view-pin-symbolic',
                                 icon_size: 16,
                                 x_expand: true,
                                 y_expand: true,
                                 x_align:  Clutter.ActorAlign.CENTER,
                                 y_align:  Clutter.ActorAlign.CENTER});
        box.add(iconF);
        icon.add_actor(box);
        return icon;
    }
});

var WindowSwitcher = GObject.registerClass(
class WindowSwitcher extends AltTab.SwitcherPopup.SwitcherList {
    _init(windows, mode) {
        super._init(true);
        this._infoLabel = new St.Label({ x_align: Clutter.ActorAlign.START,
                                         y_align: Clutter.ActorAlign.CENTER,
                                         style_class: 'info-label' });
        this._infoLabel.set_text("Filter: Order:");
        this.add_actor(this._infoLabel);
        this._label = new St.Label({ x_align: Clutter.ActorAlign.CENTER,
                                     y_align: Clutter.ActorAlign.CENTER });
        this.add_actor(this._label);

        this.windows = windows;
        this.icons = [];

        for (let i = 0; i < windows.length; i++) {
            let win = windows[i];
            let icon = new WindowIcon(win, mode, i);

            this.addItem(icon, icon.label);
            this.icons.push(icon);

            icon._unmanagedSignalId = icon.window.connect('unmanaged', window => {
                this._removeWindow(window);
            });
        }

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        this.icons.forEach(icon => {
            icon.window.disconnect(icon._unmanagedSignalId);
        });
    }

    vfunc_get_preferred_height(forWidth) {
        let [minHeight, natHeight] = super.vfunc_get_preferred_height(forWidth);

        let spacing = this.get_theme_node().get_padding(St.Side.BOTTOM);
        let [labelMin, labelNat] = this._label.get_preferred_height(-1);

        minHeight += 2*labelMin + spacing;
        natHeight += 2*labelNat + spacing;

        return [minHeight, natHeight];
    }

    vfunc_allocate(box, flags) {
        let themeNode = this.get_theme_node();
        let contentBox = themeNode.get_content_box(box);
        const labelHeight = this._label.height;
        const labelHeightF = this._infoLabel.height;
        const totalLabelHeight =
            labelHeightF + labelHeight + themeNode.get_padding(St.Side.BOTTOM);

        box.y2 -= totalLabelHeight;
        GNOME40 ? super.vfunc_allocate(box)
                : super.vfunc_allocate(box, flags);

        // Hooking up the parent vfunc will call this.set_allocation() with
        // the height without the label height, so call it again with the
        // correct size here.
        box.y2 += totalLabelHeight;
        GNOME40 ? this.set_allocation(box)
                : this.set_allocation(box, flags);

        const childBox = new Clutter.ActorBox();
        childBox.x1 = contentBox.x1;
        childBox.x2 = contentBox.x2;
        childBox.y2 = contentBox.y2 - labelHeightF + 2;
        childBox.y1 = childBox.y2 - labelHeight - labelHeightF + 2;
        GNOME40 ? this._label.allocate(childBox)
                : this._label.allocate(childBox, flags);
        const childBoxF = new Clutter.ActorBox();
        childBoxF.x1 = contentBox.x1;
        childBoxF.x2 = contentBox.x2;
        childBoxF.y2 = contentBox.y2 + 7;
        childBoxF.y1 = childBox.y2 - labelHeightF + 7;
        GNOME40 ? this._infoLabel.allocate(childBoxF)
                : this._infoLabel.allocate(childBoxF, flags);
    }


    highlight(index, justOutline) {
        super.highlight(index, justOutline);

        this._label.set_text(index == -1 ? '' : this.icons[index].label.text);
    }

    _removeWindow(window) {
        let index = this.icons.findIndex(icon => {
            return icon.window == window;
        });
        if (index === -1)
            return;

        this.icons.splice(index, 1);
        this.removeItem(index);
    }
});
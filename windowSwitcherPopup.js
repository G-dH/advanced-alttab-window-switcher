/* Copyright 2021 GdH <https://github.com/G-dH>
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

const {GObject, GLib, St, Shell, Gdk} = imports.gi;
const Clutter                = imports.gi.Clutter;
const Meta                   = imports.gi.Meta;
const Main                   = imports.ui.main;
const AltTab                 = imports.ui.altTab;
const SwitcherPopup          = imports.ui.switcherPopup;

const AppDisplay             = imports.ui.appDisplay;
const Dash                   = imports.ui.dash;

const ExtensionUtils         = imports.misc.extensionUtils;
const Me                     = ExtensionUtils.getCurrentExtension();
const Settings               = Me.imports.settings;
const ActionLib              = Me.imports.actions;

const Config                 = imports.misc.config;
var   shellVersion           = Config.PACKAGE_VERSION;
var   GNOME40 = shellVersion.startsWith("4")
                    ? GNOME40 = true
                    : GNOME40 = false;

const options = new Settings.MscOptions();

const SwitcherModes = {
    WINDOWS : 0,
    APPS    : 1
}

const FilterModes = {
    ALL       : 1,
    WORKSPACE : 2,
    MONITOR   : 3,
}

const FilterModeLabels = [ '',
    _('ALL'),
    _('WS '),
    _('MON'),
]

const Positions = {
    TOP           : 1,
    CENTER        : 2,
    BOTTOM        : 3,
}

const SortingModes = {
    MRU                   : 1,
    STABLE_SEQUENCE       : 2,
    STABLE_CURRENT_FIRST  : 3,
}

const SortingModesLabels = [ '',
    _('MRU'),
    _('STABLE'),
    _('STABLE - current 1.'),
]

const GroupModes = {
    NONE              : 1,
    CURRENT_MON_FIRST : 2,
    APPS              : 3,
    WORKSPACES        : 4,
}

const GroupModeLabels = [ '',
    _('NONE'),
    _('MON FIRST'),
    _('APPS'),
    _('WS'),
]

const SelectionModes = {
    NONE  : -1,
    FIRST :  0,
    SECOND:  1,
    ACTIVE:  2,
}

const ScrollOutFn = {
    HIDE      :  0,
    SWITCH_WS :  1,
    NOTHING   :  2,
}

let WS_INDEXES;
let HOT_KEYS;
let SHIFT_AZ_HOTKEYS;
let showHotKeys;

let APP_ICON_SIZE = 64;
let WINDOW_PREVIEW_SIZE = 128;
let APP_MODE_ICON_SIZE = 96;
let SINGLE_APP_PREVIEW_SIZE = 0;
let INFO = true;

let _cancelTimeout = false;

function _shiftPressed() {
    return global.get_pointer()[2] & Clutter.ModifierType.SHIFT_MASK;
}

function _ctrlPressed() {
    return global.get_pointer()[2] & Clutter.ModifierType.CONTROL_MASK;
}

function _superPressed() {
    return global.get_pointer()[2] & Clutter.ModifierType.SUPER_MASK;
}

function _getWindowApp(metaWindow) {
    let tracker = Shell.WindowTracker.get_default();
    return tracker.get_window_app(metaWindow);
}

function _getRunningAppsIds() {
    let running = [];
    Shell.AppSystem.get_default().get_running().forEach(a => running.push(a.get_id()));
    /*let  running = {};
    const wins = AltTab.getWindows(null);
    wins.forEach( w => running[_getWindowApp(w).get_id()] = true);
    running = Object.keys(running);*/

    return running;
}

function _convertAppInfoToShellApp(appInfo) {
    return Shell.AppSystem.get_default().lookup_app(appInfo.get_id());
}

function mod(a, b) {
    return (a + b) % b;
}

var   WindowSwitcherPopup = GObject.registerClass(
class WindowSwitcherPopup extends SwitcherPopup.SwitcherPopup {

    _init() {
        super._init();
        this._actions              = new ActionLib.Actions();
        this.KEYBOARD_TRIGGERED    = true;  // whether was popup triggered by a keyboard. when true, POSITION_POINTER will be ignored
        this._keyBind              = '';
        this._modifierMask         = 77;    // Shift|Ctrl|Alt|Super, when custom shortcut is used, release of all of these keys hides the popup
        this.POSITION_POINTER      = options.winSwitcherPopupPointer; // place popup at pointer position
        this.WIN_FILTER_MODE       = options.winSwitcherPopupWinFilter;
        this.APP_FILTER_MODE       = options.winSwitcherPopupAppFilter;
        if ((Main.layoutManager.monitors.length < 2) && this.WIN_FILTER_MODE === FilterModes.MONITOR)
            this.WIN_FILTER_MODE   = FilterModes.WORKSPACE;
        this.GROUP_MODE            = options.winSwitcherPopupWinOrder;
        this.SORTING_MODE          = options.winSwitcherPopupWinSorting;
        this._initialSelectionMode = this.SORTING_MODE === SortingModes.STABLE_SEQUENCE ? SelectionModes.ACTIVE : SelectionModes.SECOND;     // window selector modes: -1 select none, 0 select active, 1 select recent
        this._defaultGrouping      = this.GROUP_MODE; // remember default sorting
        this.POPUP_POSITION        = options.winSwitcherPopupPosition;
        this.NO_MODS_TIMEOUT       = options.winSwitcherPopupPointerTimeout;
        this._initialDelayTimeout  = options.winSwitcherPopupTimeout;
             WS_INDEXES            = options.winSwitcherPopupWsIndexes;
             HOT_KEYS              = options.winSwitcherPopupHotKeys;
             APP_ICON_SIZE         = options.winSwitcherPopupIconSize;
             WINDOW_PREVIEW_SIZE   = options.winSwitcherPopupSize;
             APP_MODE_ICON_SIZE    = options.winSwitcherPopupAppIconSize;
        this._singleAppPreviewSize = options.singleAppPreviewSize;
             SHIFT_AZ_HOTKEYS      = options.winSwitcherPopupShiftHotkeys;
             INFO                  = options.winSwitcherPopupInfo;
        this.SKIP_MINIMIZED        = options.winSkipMinimized;
        this.SORT_FAVORITES_BY_MRU = options.winSwitcherPopupFavMru;
        this.WRAPAROUND            = options.winSwitcherPopupWrap;
        this.SEARCH_APPS           = options.winSwitcherPopupSearchApps;
        this.INCLUDE_FAVORITES     = options.winSwitcherPopupFavoriteApps;
        this._showWinImmediately   = options.winSwitcherPopupShowImmediately;
        this._searchCanSwitchFilter= options.winSwitcherPopupSearchAll;
        this._monitorIndex         = global.display.get_current_monitor();
        this._showWorkspaceIndex   = options.wsSwitchIndicator;
        //this.SHOW_APPS             = options.winSwitcherPopupStartApps;
        this.SHOW_APPS             = false;
        this._switcherMode         = SwitcherModes.WINDOWS;
        this.SCROLL_OUT_FN         = options.switcherPopupScrollOut;
        this.ACTIVATE_ON_HIDE      = options.switcherPopupActivateOnHide;

        this._singleApp            = null;
        this._searchEntry          = null;
        if (options.winSwitcherPopupStartSearch) {
            this._searchEntry = '';
        }
        this._selectedIndex        = -1;    // deselect
        this._tempFilterMode       = null;
        this._firstRun             = true;
        this._favoritesMRU         = true;
        _cancelTimeout             = false;

        this._newWindowConnector   = global.display.connect_after('window-created', (w, win) => {
                                                        if (this._doNotUpdateOnNewWindow) return;
                                    // there are situations when window list updates later than this callback is executed
                                                        GLib.timeout_add(
                                                        GLib.PRIORITY_DEFAULT,
                                                        100,
                                                        () => {
                                                            this._updateSwitcher();
                                                            if (this._showingApps)
                                                                this._select(this._getItemIndexByID(_getWindowApp(win).get_id()));
                                                            else
                                                                this._select(this._getItemIndexByID(win.get_id()));
                                                        });
                                                    }
        );
        this.connect('destroy', this._onDestroyThis.bind(this));
    }

    _onDestroyThis() {
        // _initialDelayTimeoutId was already removed in super class
        if (this._actions) {
            if (this._actions._wsOverlay) {
                Main.layoutManager.removeChrome(this._actions._wsOverlay);
                this._actions._wsOverlay.destroy();
                this._actions._wsOverlay = null;
            }
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
        if (this._items.length == 1 && this._switcherList) {
            this._select(0);
        } else if (backward) {
            if (this._initialSelectionMode === SelectionModes.SECOND)
                this._select(this._items.length - 1);
            else if (this._initialSelectionMode === SelectionModes.ACTIVE) {
                this._select(this._getFocusedItemIndex());
                //this._select(this._previous());
            }

        } else {
            if (this._initialSelectionMode === SelectionModes.FIRST) {
                this._select(0);
            }
            else if (this._initialSelectionMode === SelectionModes.SECOND)
                if (this._items.length > 1)
                    this._select(1);
                else this._select(0);
            else if (this._initialSelectionMode === SelectionModes.ACTIVE) {
                this._select(this._getFocusedItemIndex());
                //this._select(this._next());
            }
        }
    }

    show(backward, binding, mask) {
        if (!Main.pushModal(this)) {
            if (!Main.pushModal(this, { options: Meta.ModalOptions.POINTER_ALREADY_GRABBED }))
                return false;
        }

        if (binding == 'switch-group') {
            this._switchGroupInit = true;
            this._doNotFinishBeforeUpdate = true;
        }

        showHotKeys = this.KEYBOARD_TRIGGERED;
        if (this._pointer == undefined) {
            this._pointer = [];
            [this._pointer.x, this._pointer.y, ] = global.get_pointer();
            this._haveModal = true;
            //this.iconMode = this._settings.get_enum('app-icon-mode');
        }

        if (this._tempFilterMode)
            this._tempFilterMode = null;

        this._showingApps = false;

        let windows;
        if (this.SHOW_APPS) {
            windows = this._getAppList(this._searchEntry);
            if (windows.length > 0) this._showingApps = true;
        } else
            windows = this._getWindowList();

        let filterSwitchAllowed = (this._searchEntry === null || this._searchEntry === '')
                               || (this._searchCanSwitchFilter && this._searchEntry !== null && this._searchEntry !== '');

        if (windows.length === 0 && filterSwitchAllowed) {
            for (let mod = this.WIN_FILTER_MODE; mod > 0; mod--) {
                this._tempFilterMode = mod;
                windows = this._getWindowList();
                if (windows.length > 0 && (this._searchEntry === null || this._searchEntry === '')) {
                    this._initialSelectionMode = SelectionModes.NONE;
                    this._selectedIndex = -1;
                    break;
                }
            }
            if (windows.length === 0 && this._tempFilterMode && this._searchEntry !== null && this._searchEntry !== '' && this.SEARCH_APPS === false) {
                this._searchEntry = this._searchEntry.slice(0, -1);
                this._tempFilterMode = null;
                windows = this._getWindowList();
            }
        }
        if (windows.length === 0 && this.SEARCH_APPS === true && this._searchEntry !== null && this._searchEntry !== '') {
            this._showingApps = true;
            windows = this._getAppList(this._searchEntry);

            this._initialSelectionMode = SelectionModes.FIRST;

            if (windows.length === 0) {
                this._searchEntry = this._searchEntry.slice(0, -1);
                this._tempFilterMode = null;

                windows = this._getWindowList();
            }

        }

        if (windows.length > 0) {
            if (this._switcherList) this._switcherList.destroy();
            this._switcherList = new WindowSwitcher(windows);
            this._items = this._switcherList.icons;

            this.showOrig(backward, binding, mask);

        } else return false;

        return true;
    }

    showOrig(backward, binding, mask) {
        if (this._items.length == 0) {
            return false;
        }
        this._alreadyShowed = true;

        this._haveModal = true;

        this.add_actor(this._switcherList);
        this._switcherList.connect('item-activated', this._itemActivated.bind(this));
        this._switcherList.connect('item-entered', this._itemEntered.bind(this));
        this._switcherList.connect('item-removed', this._itemRemoved.bind(this));

        this.visible = true;
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
                if (this._doNotFinishBeforeUpdate) {
                    this._finishNow = true;
                }
                else if (!this._firstRun){
                    this._finish(global.get_current_time());
                    return true;
                }
            }
        } else {
            this._resetNoModsTimeout();
        }

        if (this._switchGroupInit) {
        // user is switching windows of focused app
            this._switchGroupInit = false;
            this._selectedIndex = 0;
            this._singleApp = this._items[0].app.get_id();
            this._delayGroupSwitcher = true;
            this._toggleSingleAppMode(true);
            if (this._items.length > 1)
                this._select(1);
            this._doNotFinishBeforeUpdate = false;
            if (this._finishNow) {
                this._finishNow = false;
                this._finish();
            }
            return;
        }

        this._setSwitcherInfo();

        // We delay showing the popup so that fast Alt+Tab users aren't
        // disturbed by the popup briefly flashing.
        // but not when we're just overriding already shown content
        if (this._firstRun || this._delayGroupSwitcher) {
            if (this._delayGroupSwitcher)
                this._delayGroupSwitcher = false;
            this._initialDelayTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this.KEYBOARD_TRIGGERED? this._initialDelayTimeout : 0,
                () => {
                    if (!this._doNotShowImmediately)
                        this._showImmediately();
                    this._initialDelayTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                });
            GLib.Source.set_name_by_id(this._initialDelayTimeoutId, '[gnome-shell] Main.osdWindow.cancel');
        } else {
            this.opacity = 255;
        }
        this._firstRun = false;
        if (this._initialSelectionMode === SelectionModes.RECENT || this._initialSelectionMode === SelectionModes.NONE)
            this._initialSelectionMode = SelectionModes.ACTIVE;
        this._resetNoModsTimeout();
        Main.osdWindowManager.hideAll();
        return true;
    }

    _updateSwitcher(winToApp = false) {
        let id;
        if (winToApp)
            id = _getWindowApp(this._items[0].window).get_id();
        else
            id = this._getSelected().get_id();
        this.show();
        this._select(this._getItemIndexByID(id));
    }

    fadeAndDestroy() {
        this._doNotShowImmediately = true;
        this._popModal();
        if (this.opacity > 0) {
            this.ease({
                opacity: 0,
                duration: 200,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                onComplete: () => this.destroy(),
            });
        } else {
            this.destroy();
        }
    }

    _finish() {
        if (this._doNotFinishBeforeUpdate) {
            this._finishNow = true;
            return;
        }
        if (this._showWinImmediatelyTimeoutId) {
            GLib.source_remove(this._showWinImmediatelyTimeoutId);
            this._showWinImmediatelyTimeoutId = 0;
        }
        this._doNotShowWin = true;
        this._doNotUpdateOnNewWindow = true;
        if (this._showingApps) {
            if (_ctrlPressed())
                this._getSelected().open_new_window(global.get_current_time());
            else {
                if (this._getSelected().cachedWindows[0]) {
                    Main.activateWindow(this._getSelected().cachedWindows[0]);
                }
                else {
                    if (this._getSelected().get_n_windows() === 0) {
                        this._getSelected().activate();
                    }
                    else {
                        this._getSelected().open_new_window(global.get_current_time());
                    }
                }
            }
        } else {
            Main.activateWindow(this._getSelected());
        }
        super._finish();
    }

    _setSwitcherInfo() {
        this._switcherList._infoLabel.set_text(
                    (this._searchEntry !== null ? _('Search:') + ' ' + this._searchEntry : '') + '  '
                    + _('Filter: ') + FilterModeLabels[this._tempFilterMode === null? this.WIN_FILTER_MODE : this._tempFilterMode] 
                    + (this._singleApp? '/' + _('APP') : '') + ',  '
                    + _('Group: ') + GroupModeLabels[this.GROUP_MODE]+ ', '
                    + _('Sort: ') + SortingModesLabels[this.SORTING_MODE]
        );
        if (!(this._searchEntry == null || this._searchEntry == '')) {
            this._showWsIndex(true).set_text(this._searchEntry);
        }
    }

    // place the indicator overlay out of the switcher
    _showWsIndex(showSearchEntry = false) {
        if (!this._showWorkspaceIndex && !showSearchEntry)
            return;

        //let monitorIndex = global.display.get_current_monitor();
        //const monitorIndex = this._monitorIndex;
        let geometry = global.display.get_monitor_geometry(this._monitorIndex);
        let wsLabel = this._actions.showWorkspaceIndex([], 60000, this._monitorIndex);

        if (this.POPUP_POSITION === Positions.BOTTOM) {
            wsLabel.y = Math.floor((geometry.height - this._switcherList.height - wsLabel.height - 10));

        } else {
            wsLabel.y = Math.floor((geometry.height + this._switcherList.height) / 2);
        }
        return wsLabel;
    }

    _resetNoModsTimeout() {
        if (this._noModsTimeoutId != 0)
            GLib.source_remove(this._noModsTimeoutId);
        this._noModsTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this.NO_MODS_TIMEOUT,
            () => {
                if (!this.KEYBOARD_TRIGGERED && this._isPointerOut() && !_cancelTimeout) {
                    if (this._showWinImmediately) {
                        if (this._lastShowed)
                            this._selectedIndex = this._lastShowed;
                        if (this._showingApps) {
                            if (this._getSelected().cachedWindows.length)
                                this._finish();
                            else
                                this.fadeAndDestroy();
                        } else
                            this._finish();

                    } else if (this._doNotFinishBeforeUpdate) {
                            this._finishNow = true;
                    } else {
                            if (this.ACTIVATE_ON_HIDE)
                                this._finish();
                            else
                                this.fadeAndDestroy();
                    }

                    this._noModsTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                } else {
                    this._noModsTimeoutId = 0;
                    this._resetNoModsTimeout();
                }
            }
        );
    }

    _getFocusedItemIndex() {
        const metaWin = global.display.get_tab_list(Meta.TabList.NORMAL, null)[0];
        if (!metaWin) return 0;

        let id;
        let pt;

        if (this._items[0].is_window) {
            id = metaWin.get_id();
            pt = 'window';
        }
        else {
            id = _getWindowApp(metaWin).get_id();
            pt = 'app';
        }
        for (let i = 0; i < this._items.length; i++) {
            if (this._items[i][pt].get_id() === id)
                return i;
        }

        return 0;
    }

    _getSelectedID() {
        let item = this._items[this._selectedIndex > -1 ? this._selectedIndex : 0];

        if (item.window)
            return item.window.get_id();
        else
            return item.app.get_id();
    }

    _select(index) {
        if (!this._switcherList) return;

        if (this._initialSelectionMode === SelectionModes.NONE) {
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

            if (!this._doNotShowWin) {
                this._showWinImmediatelyTimeoutId = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    100,
                    () => {
                        if (this.KEYBOARD_TRIGGERED || (!this.KEYBOARD_TRIGGERED && !this._isPointerOut())) {
                            this._showWindow(this._selectedIndex);
                            this._lastShowed = this._selectedIndex;
                        }

                        this._showWinImmediatelyTimeoutId = 0;

                        return GLib.SOURCE_REMOVE;
                    }
                );
            }

            return;
        }

        this._resetNoModsTimeout();
    }

    _next() {
        let step = 1;
        if (!this.WRAPAROUND && this._selectedIndex === (this._items.length - 1))
            step = 0;

        return mod(this._selectedIndex + step, this._items.length);
    }

    _previous() {
        let step = 1;
        if (!this.WRAPAROUND && this._selectedIndex === 0)
            step = 0;

        return mod(this._selectedIndex - step, this._items.length);
    }

    _selectNextApp(selectedIndex) {
        let lastIndex, step;
        if (_shiftPressed()) {
            lastIndex = 0;
            step = -1;
        } else {
            lastIndex = this._items.length - 1;
            step = 1
        }

        let secondRun = false;
        let winApp = _getWindowApp(this._items[selectedIndex].window).get_id();
        let nextApp = null;
        for (let i = selectedIndex; i !== lastIndex + step; i += step) {

            if (_getWindowApp(this._items[i].window).get_id() !== winApp) {
                if (!_shiftPressed()) {
                    this._select(i);
                    return;

                } else {
                    // find the first window of the group
                    if (!nextApp)
                        nextApp = _getWindowApp(this._items[i].window).get_id();

                    if (_getWindowApp(this._items[i].window).get_id() != nextApp || i == lastIndex) {
                        this._select(i + (i == 0 ? 0 : 1));
                        return;
                    }
                }
            }
            // if no other app found try again from start
            if (i === lastIndex && !secondRun) {
                step === 1 ? i = -1 : i = this._items.length;
                secondRun = true;
            }
        }
    }

    _getNextApp(list) {
        //let apps = _getAppList(list);
        let apps = _getRunningAppsIds();
        if (apps.length === 0) return;
        let currentIndex = apps.indexOf(this._singleApp);
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

    _getSelected() {
        let obj = null;
        if (this._selectedIndex > -1) {
            let it = this._items[this._selectedIndex];
            if (it.is_window)
                obj = this._items[this._selectedIndex].window;
            else
                obj = this._items[this._selectedIndex].app;
        }

        return obj;
    }

    _getItemIndexByID(id) {
        let index = 0;
        for (let i = 0; i < this._items.length; i++) {

            let pt  = this._items[i].is_window ? 'window' : 'app';
            let cid = this._items[i][pt].get_id();

            if (cid === id) {
                index = i;
                break;
            }
        }

        return index;
    }

    _isPointerOut() {
        let [x, y, mods] = global.get_pointer();
        let switcher = this._switcherList;
        let margin = 15;

        if (x < (switcher.x - margin) || x > (switcher.x + switcher.width + margin))
            return true;
        if (y < (switcher.y - margin)|| y > (switcher.y + switcher.height + margin))
            return true;

        return false;
    }

    _getMonitorByIndex(monitorIndex) {
        let monitors = Main.layoutManager.monitors;
        for (let monitor of monitors) {
            if (monitor.index === monitorIndex)
                return monitor;
        }
        return -1;
    }

    _delayedUpdate(delay) {
        GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            delay,
            () => {
                    this._updateSwitcher();
                }
        );
    }

    _match(string, pattern) {
        // remove diacritics and accents from letters
        let s = string.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        let p = pattern.toLowerCase();
        let ps = p.split(/ +/);

        // allows to use multiple exact paterns separated by space in arbitrary order
        for (let w of ps) {
            if (!s.match(w))
                return false;
        }

        return true;
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

    _switchMonitor(direction) {
        let display = global.display;
        let nMonitors = display.get_n_monitors();

        if (nMonitors > 1 && this._monitorIndex >= 0) {
            let monIdx = display.get_monitor_neighbor_index(this._monitorIndex, direction);

            if (monIdx > -1) {
                this._monitorIndex = monIdx;
                this._actions.destroyWsOverlay();
                this._updateSwitcher();
            }
        }

    }

    _toggleSingleAppMode(switchOn = false) {
        if (this._selectedIndex < 0) return;

        if (!this._singleApp || switchOn) {
            if (this._showingApps) {
                if (!this._getSelected().cachedWindows.length)
                    return;
                this._singleApp = this._getSelected().get_id();
                this.SHOW_APPS = false;

            } else
                this._singleApp = _getWindowApp(this._getSelected()).get_id();

        } else {
            this._singleApp = null;
            if (this._switcherMode === SwitcherModes.APPS) {
                this.SHOW_APPS = true;
                this._updateSwitcher(true);
                return;
            }
        }

        this._updateSwitcher();
    }

    _toggleSearchMode() {
        if (this._searchEntry !== null) {
            this._searchEntry = null;
            this._showWsIndex(true).set_text('');
            _cancelTimeout = false;

        } else {
            this._searchEntry = '';
            this._modifierMask = 0;
            _cancelTimeout = true;
            this._actions.destroyWsOverlay();
        }

        this.show();
    }

    _showWindow(_selectedIndex) {
        if (this._doNotShowWin)
            return;

        let win = this._getSelected();
        let appId = 0;

        if (win.get_windows) {
            appId = win.get_id();
            if (!win.cachedWindows.length) return;
            win = win.cachedWindows[0];
        }

        let id = win.get_id();
        if (appId) id = appId;

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

    _toggleSwitcherMode() {
        if (this._switcherMode === SwitcherModes.APPS) {

            this._switcherMode = SwitcherModes.WINDOWS;
            this.SHOW_APPS = false;
            this._singleApp = null;

            let id = 0;
            if (this._showingApps) {
                if (this._getSelected().cachedWindows.length) {
                    id = this._getSelected().cachedWindows[0].get_id();
                }
            } else {
                id = _getWindowApp(this._items[0].window).get_id();
            }

            this.show();
            this._select(this._getItemIndexByID(id));
        
        } else /*if (this._switcherMode === SwitcherModes.WINDOWS)*/ {
            this._switcherMode = SwitcherModes.APPS;
            this.SHOW_APPS = true;
            this._singleApp = null;
            /*if (_searchEntry != null)
                this._searchEntry = '';*/

            let id;
            if (this._showingApps) {
                if (this._getSelected().cachedWindows)
                    id = this._getSelected().cachedWindows[0].get_id();
            } else {
                id = _getWindowApp(this._items[this._selectedIndex].window).get_id();
            }
            this._initialSelectionMode = SelectionModes.FIRST;
            this.show();
            this._select(this._getItemIndexByID(id));
        }
    }

    /*_showApps() {
        this._switcherMode = SwitcherModes.APPS;
        this.SHOW_APPS = !this.SHOW_APPS;
        this._initialSelectionMode = SelectionModes.FIRST;
        this.show();
    }*/

    _moveFavotites(direction) {
        if (!this._showingApps && INCLUDE_FAVORITES)
            return;

        let app = this._getSelected().get_id();
        let favorites = global.settings.get_strv('favorite-apps');
        let fromIndex = favorites.indexOf(app);
        let maxIndex = favorites.length - 1;

        if (fromIndex == -1)
            return;

        else {
            // disable MRU sorting of favorites to see the result of the icon movement
            if (this._favoritesMRU) {
                this._favoritesMRU = false;
                this._updateSwitcher();

            } else {
                let toIndex = fromIndex + direction;
                if (toIndex < 0)
                    toIndex = maxIndex;
                else if (toIndex > maxIndex)
                    toIndex = 0;
    
                let element = favorites[fromIndex];
                favorites.splice(fromIndex, 1);
                favorites.splice(toIndex, 0, element);

                global.settings.set_strv('favorite-apps', favorites);
                this._updateSwitcher();
            }

        }

    }

    vfunc_key_press_event(keyEvent) {
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
        if (!(keyEvent.keyval == 65513 || keyEvent.keyval == 65515)) return;
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

        if (keysymName.match(/F[1-9][0-2]?/) || (keysymName.match(/KP_[1-9]/) && this._searchEntry === null)) {

            let index;
            if (keysymName.startsWith('KP_'))
                index = parseInt(keysymName.substring(3)) - 1;
            else
                index = parseInt(keysymName.substring(1)) - 1;
            if (index < this._items.length) {
                this._selectedIndex = index;
                if (!_shiftPressed())
                    this._finish();
                else this._select(index); //this._switcherList.highlight(index);
            }
        }

        else if (this._searchEntry !== null && (!_shiftPressed() || keysymName.replace('KP_', '').match(/[0-9]/))) {

            keysymName = keysymName.replace('KP_', '');

            // don't close the popup during typing, when not triggered by a keyboard
            // which holds the popup opened by a pressed modifier key
            _cancelTimeout = true;

            if ( keysym === Clutter.KEY_BackSpace) {
                this._searchEntry = this._searchEntry.slice(0, -1);
                this.show();
                return Clutter.EVENT_STOP;
            }

            else if (this._searchEntry !== null && !_ctrlPressed()
                        && ((keysymName.length === 1 && (/[a-zA-Z0-9]/).test(keysymName)) || keysym === Clutter.KEY_space)
                    ) {

                if (keysymName === 'space') keysymName = ' ';
                this._searchEntry += keysymName;
                this.show();
                return Clutter.EVENT_STOP;
            }
        }

        if  (   action == Meta.KeyBindingAction.SWITCH_WINDOWS
             || action == Meta.KeyBindingAction.SWITCH_APPLICATIONS
             || action == Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD
             || action == Meta.KeyBindingAction.SWITCH_APPLICATIONS_BACKWARD
             || ( this._keyBind
                  && (   keysym == Clutter[`KEY_${this._keyBind.toUpperCase()}`]
                      || keysym == Clutter[`KEY_${this._keyBind.toLowerCase()}`]
                     )
                )
            ) {

                if (this._singleApp) 
                    this._toggleSingleAppMode();

                else {
                    if (_shiftPressed())
                        this._select(this._previous());
                
                    else
                        this._select(this._next());
                }
        }

        else if (keysym == Clutter.KEY_Tab && _ctrlPressed()) {

            let mod = Main.layoutManager.monitors.length;

            if (_shiftPressed())
                this._monitorIndex = (this._monitorIndex + mod) % (mod);

            else
                this._monitorIndex = (this._monitorIndex + 1) % (mod);

            this._actions.destroyWsOverlay();
            this._updateSwitcher();
        }

        else if (keysym == Clutter.KEY_e || keysym == Clutter.KEY_E || keysym == Clutter.KEY_Insert) {
            this._toggleSearchMode();
        }

        // Clear search entry or Force close (kill -9) the window process
        else if (keysym === Clutter.KEY_Delete) {
            if (this._selectedIndex < 0) return;

            if (!_shiftPressed() && this._searchEntry !== null) {
                this._searchEntry = '';
                this.show();
            } else if (_shiftPressed())
                if (this._showingApps) {
                    if (this._getSelected().cachedWindows.length > 0)
                        this._getSelected().cachedWindows[0].kill();
                        this._delayedUpdate(100);
                } else {
                    this._getSelected().kill();
                }
        }

        // implement VIM text navigation keys hjkl
        else if (keysym == Clutter.KEY_Left || keysym == Clutter.KEY_h || keysym == Clutter.KEY_H) {
            if (_shiftPressed() && _ctrlPressed())
                this._moveFavotites(-1);
            else if (!_shiftPressed()) {
                this._select(this._previous());
            } else {
                this._switchMonitor(Meta.DisplayDirection.LEFT);
            }
        }

        else if (keysym == Clutter.KEY_Right || keysym == Clutter.KEY_l || keysym == Clutter.KEY_L) {
            if (_shiftPressed() && _ctrlPressed())
                this._moveFavotites(+1);
            if (!_shiftPressed()) {
                this._select(this._next());
            } else {
                this._switchMonitor(Meta.DisplayDirection.RIGHT);
            }
        }

        else if (keysym == Clutter.KEY_Up || keysym == Clutter.KEY_Page_Up || keysym == Clutter.KEY_k || keysym == Clutter.KEY_K) {
            if (!_shiftPressed()) {
                this._switchWorkspace(Clutter.ScrollDirection.UP);
            } else {
                this._switchMonitor(Meta.DisplayDirection.UP);
            }
        }

        else if (keysym == Clutter.KEY_Down || keysym == Clutter.KEY_Page_Down || keysym == Clutter.KEY_j || keysym == Clutter.KEY_J) {
            if (!_shiftPressed()) {
                this._switchWorkspace(Clutter.ScrollDirection.DOWN);
            } else {
                this._switchMonitor(Meta.DisplayDirection.DOWN);
            }
        }

        else if ((keysym === Clutter.KEY_y || keysym === Clutter.KEY_Y || keysym === Clutter.KEY_z || keysym === Clutter.KEY_Z) && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {
            this._monitorIndex = (this._monitorIndex + 1) % (Main.layoutManager.monitors.length);
            this._updateSwitcher();
        }

        else if (keysym === Clutter.KEY_Home)
            if (_shiftPressed()) {
                Main.wm.actionMoveWorkspace(global.workspace_manager.get_workspace_by_index(0));
                this.show();
                this._showWsIndex();
            }
            else
                this._select(0);

        else if (keysym === Clutter.KEY_End)
            if (_shiftPressed()) {
                Main.wm.actionMoveWorkspace(global.workspace_manager.get_workspace_by_index(global.workspace_manager.n_workspaces-1));
                this.show();
                this._showWsIndex();
            }
            else this._select(this._items.length - 1);

        else if (keysym === Clutter.KEY_q || keysym === Clutter.KEY_Q)
                this._switchFilterMode();

        else if (keysym === Clutter.KEY_plus || keysym === Clutter.KEY_1 || keysym === Clutter.KEY_exclam) {
            if (this._selectedIndex < 0) return;
            this._toggleSingleAppMode();
        }

        //else if (keysym === Clutter.KEY_semicolon || keysym === 96 || keysym === 126 || keysym === 65112) { // 96 is grave, 126 ascii tilde, 65112 dead_abovering. I didn't find Clutter constants.
        else if (action == Meta.KeyBindingAction.SWITCH_GROUP || action == Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD
                || keysym === Clutter.KEY_semicolon || keysym === 96 || keysym === 126 || keysym === 65112) {

            if (_ctrlPressed()) {
                this._toggleSwitcherMode();

            } else { // Ctrl not pressed

                if (this._switcherMode === SwitcherModes.APPS) {
                    if (this._showingApps) {

                        if (this._getSelected().cachedWindows.length) {
                            this._toggleSingleAppMode();
                        }

                    } else if (this._singleApp) {

                        if (_shiftPressed())
                            this._select(this._previous());

                        else
                            this._select(this._next());

                    } else 
                        this._toggleSwitcherMode();

                } else if (this._switcherMode === SwitcherModes.WINDOWS) {
                    let index = this._selectedIndex > -1 ? this._selectedIndex : 0;

                        if (this._singleApp) {
                            // when app filter is active this key will switch to next app group
                            this._switchNextApp = true;
                            this._initialSelectionMode = SelectionModes.FIRST;
                            this.show();
                        } else {
                            if (this.GROUP_MODE !== GroupModes.APPS) {
                                this.GROUP_MODE = GroupModes.APPS;
                                this.show();
                            }
                        }
                        if (!this._singleApp)
                            this._selectNextApp(index);
                }
            }
        }

        // toggle sort by workspaces
        else if ((keysym === Clutter.KEY_g || keysym === Clutter.KEY_G) && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {
            if (this._showingApps) return;
            if (this.GROUP_MODE === GroupModes.WORKSPACES)
                 this.GROUP_MODE = this._defaultGrouping;
            else this.GROUP_MODE = GroupModes.WORKSPACES;
            this._updateSwitcher();
        }

        // show window
        else if (keysym === Clutter.KEY_space || keysym === Clutter.KEY_KP_0 || keysym === Clutter.KEY_KP_Insert) {
            if (this._showingApps) return;
            this._showWindow(this._selectedIndex);
        }

        // close window/app
        else if (keysym === Clutter.KEY_w || keysym === Clutter.KEY_W) {
            if (this._showingApps && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {
                this._getSelected().request_quit();
                this._delayedUpdate(200);
            }
            else {
                if (_ctrlPressed()) {
                    _getWindowApp(this._getSelected()).request_quit();
                } else if (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)
                    this._actions.closeWindow(this._getSelected());
            }
        }

        // close all windows of the same class displayed in selector
        else if ((keysym === Clutter.KEY_c || keysym === Clutter.KEY_C) && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {
            if (this._showingApps) return;
            if (this._selectedIndex < 0) return;
            this._actions.closeWinsOfSameApp(this._getSelected(), this._items);
        }

        // quit application
        else if ((keysym === Clutter.KEY_d || keysym === Clutter.KEY_D) && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {
            if (this._selectedIndex < 0) return;

            if (this._showingApps) {
                this._getSelected().request_quit();
                this._delayedUpdate(100);

            } else
                _getWindowApp(this._getSelected()).request_quit();
        }

        // make selected window Always on Top
        else if ((keysym === Clutter.KEY_a || keysym === Clutter.KEY_A) && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {
            if (this._showingApps) return;

            if (this._selectedIndex < 0) return;
            this._actions.toggleAboveWindow(this._getSelected());
            let win = this._getSelected();
            Main.wm.actionMoveWorkspace(win.get_workspace());
            this._updateSwitcher();
        }

        // make selected window Allways on Visible Workspace
        else if ((keysym === Clutter.KEY_s || keysym === Clutter.KEY_S) && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {
            if (this._showingApps) return;

            if (this._selectedIndex < 0) return;
            this._actions.toggleStickWindow(this._getSelected());
            this._updateSwitcher();
        }

        // toggle maximize
        else if ((keysym === Clutter.KEY_m || keysym === Clutter.KEY_M) && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {
            if (this._showingApps) return;
            if (this._selectedIndex < 0) return;

            let win = this._getSelected();
            this._actions.toggleMaximizeWindow(win);
            this._updateSwitcher();
        }

        // move selected window to current workspace
        else if ((keysym === Clutter.KEY_x || keysym === Clutter.KEY_X)
                     && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {

            if (this._showingApps) return;

            let win = this._getSelected();
            if (!win) return;

            this._actions.moveWindowToCurrentWs(win, this.KEYBOARD_TRIGGERED ? this._monitorIndex : -1);
            this._showWindow(this._selectedIndex);
            this._updateSwitcher();
        }

        // move selected window to current workspace and maximize
        else if ((keysym === Clutter.KEY_v || keysym === Clutter.KEY_V)
                     && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {

            if (this._showingApps) return;

            if (this._getSelected()) {
                let win = this._getSelected();
                this._actions.moveWindowToCurrentWs(win);
                win.maximize(Meta.MaximizeFlags.BOTH);
                this._showWindow();
                this._updateSwitcher();
            }
        }

        else if ((keysym === Clutter.KEY_f || keysym === Clutter.KEY_F)
                    && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {

            if (this._showingApps) return;
            if (this._selectedIndex < 0) return;

            let win = this._getSelected();
            this._actions.fullscreenWinOnEmptyWs(win);
            this._updateSwitcher();
        }

        else if (((keysym === Clutter.KEY_n || keysym === Clutter.KEY_N)
                    && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true))
                    || (keysym === Clutter.KEY_Return && _ctrlPressed())) {

            if (this._selectedIndex < 0) return;

            let obj = this._getSelected();
            if (this._showingApps)
                obj.open_new_window(global.get_current_time());
            else
                Shell.WindowTracker.get_default().get_window_app(obj).open_new_window(global.get_current_time());
        }

        else if ((keysym === Clutter.KEY_o || keysym === Clutter.KEY_O)
                     && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {

            this._toggleSwitcherMode();
        }

        // make thumbnail of selected window
        else if ((keysym === Clutter.KEY_t || keysym === Clutter.KEY_T) && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {
            if (this._showingApps) return;

            this._actions.makeThumbnailWindow(this._getSelected());
        }

        else if ((keysym === Clutter.KEY_p || keysym === Clutter.KEY_P) && (SHIFT_AZ_HOTKEYS? _shiftPressed() : true)) {

            Main.extensionManager.openExtensionPrefs(Me.metadata.uuid, '', {});
        }

        else {

            return Clutter.EVENT_PROPAGATE;
        }

        return Clutter.EVENT_STOP;
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
                this._showWindow(this._selectedIndex);

            } else {
                let win = this._getSelected();
                if (win) {
                    this._actions.moveWindowToCurrentWs(win);
                    this._updateSwitcher();
                }
            }
        }
        if (button === Clutter.BUTTON_MIDDLE) {
            if (this._isPointerOut()) {
                this._getSelected().kill();
            } else {
                this._actions.closeWindow(this._getSelected());
            }
        }
        this._resetNoModsTimeout();
        return Clutter.EVENT_PROPAGATE;
    }

    vfunc_scroll_event(scrollEvent) {
        let direction = scrollEvent.direction;

        this._resetNoModsTimeout();

        if (this._isPointerOut()) {
            if (this.SCROLL_OUT_FN == ScrollOutFn.SWITCH_WS) {
                switch (direction) {
                    case Clutter.ScrollDirection.UP:
                    case Clutter.ScrollDirection.LEFT:
                        this._switchWorkspace(Clutter.ScrollDirection.UP);
                        break;
                    case Clutter.ScrollDirection.DOWN:
                    case Clutter.ScrollDirection.RIGHT:
                        this._switchWorkspace(Clutter.ScrollDirection.DOWN);
                        break;
                    default:
                        return Clutter.EVENT_PROPAGATE;
                }
            } else if (this.SCROLL_OUT_FN == ScrollOutFn.HIDE)
                this.fadeAndDestroy();

            return Clutter.EVENT_STOP;

        } else {

            this._disableHover();
            this._scrollHandler(scrollEvent.direction);
            return Clutter.EVENT_PROPAGATE;
        }

    }

    _getWindowList(allWindows = false) {
        let filterMode;
        if (this._tempFilterMode)
            filterMode = this._tempFilterMode;
        else
            filterMode = this.WIN_FILTER_MODE;

        let workspace = null;
        let ws = global.workspace_manager.get_active_workspace();
        if (filterMode > FilterModes.ALL && !allWindows) {
            workspace = ws;
        }

        let winList = AltTab.getWindows(workspace);
        const currentWin = winList[0];

        if (this.SORTING_MODE === SortingModes.STABLE_SEQUENCE || this.SORTING_MODE === SortingModes.STABLE_CURRENT_FIRST) {
            winList.sort((a, b) => a.get_stable_sequence() - b.get_stable_sequence());
        } 

        if (this.SORTING_MODE === SortingModes.STABLE_CURRENT_FIRST) {
            const currentSq = currentWin.get_stable_sequence();
            winList.sort((a, b, cs = currentSq) => ((b.get_stable_sequence() > cs) && (a.get_stable_sequence() <= cs))?
                    0 : 1
            );
        }

        let monitor = this._monitorIndex;
        // list windows on current monitor only

        if (!allWindows && filterMode === FilterModes.MONITOR && monitor > -1) {
            winList = winList.filter((w) => w.get_monitor() === monitor);
        }

        if (filterMode === FilterModes.ALL && this.GROUP_MODE === GroupModes.WORKSPACES) {
            winList.sort((a, b) => b.get_workspace().index() < a.get_workspace().index());
        }

        if (filterMode === FilterModes.ALL && this.GROUP_MODE === GroupModes.CURRENT_MON_FIRST) {
            // windows from the active workspace and monnitor first
            winList.sort((a, b) => ( (b.get_workspace().index() === ws.index() && b.get_monitor() === monitor) 
                                  && (a.get_workspace().index() !== ws.index() || a.get_monitor() !== monitor) ) );
        }

        if (this.SKIP_MINIMIZED)
            winList = winList.filter((w)=> !w.minimized);

        if (this._singleApp) {
            SINGLE_APP_PREVIEW_SIZE = this._singleAppPreviewSize;
            if (this._switchNextApp) {
                this._singleApp = this._getNextApp(winList);
                this._switchNextApp = false;
            }
            let tracker = Shell.WindowTracker.get_default();
            winList = winList.filter((w) => tracker.get_window_app(w).get_id() === this._singleApp);
        } else SINGLE_APP_PREVIEW_SIZE = 0;

        if (this.GROUP_MODE === GroupModes.APPS) {
            //let apps = _getAppList(winList);
            let apps = _getRunningAppsIds();
            winList.sort((a, b) => apps.indexOf(_getWindowApp(b).get_id()) < apps.indexOf(_getWindowApp(a).get_id()));
        }

        if (this._searchEntry) {
            const filterPatern = (wList, pattern)=> {return wList.filter((w) => {
                    // search in window title and app name
                    const appInfo = Shell.WindowTracker.get_default().get_window_app(w).appInfo;
                    let appInfoText = appInfo ?
                                          (appInfo.get_name()         ? appInfo.get_name()         : '')
                                        + (appInfo.get_generic_name() ? appInfo.get_generic_name() : '')
                                        + (appInfo.get_executable()   ? appInfo.get_executable()   : '')
                                    : '';
                    return this._match(
                        w.title
                        + appInfoText,
                        pattern);
                });
            };
            let winListP = filterPatern(winList, this._searchEntry);
            // if no window match the pattern, remove the unmatched character
            if (winListP.length === 0 && !this._tempFilterMode) {
                //this._searchEntry = this._searchEntry.slice(0, -1);
                winListP = filterPatern(winList, this._searchEntry);
            }
            winList = winListP;
        }

        return winList;
    }

    _getAppList(pattern = '') {
        let filterMode;
        if (this._tempFilterMode)
            filterMode = this._tempFilterMode;
        else
            filterMode = this.WIN_FILTER_MODE;

        if (!pattern)
            pattern = '';

        let appList = [];

        const running = Shell.AppSystem.get_default().get_running();
        const runningIds = _getRunningAppsIds();

        let favorites = [];
        let favoritesFull = []; 

        if (this.SHOW_APPS && pattern == '') {
            if (this.INCLUDE_FAVORITES) {
                favoritesFull = global.settings.get_strv('favorite-apps');
                favorites = [...favoritesFull];
            }

            runningIds.forEach( (a) => {
                const i = favorites.indexOf(a);
                if (i > -1) favorites.splice(i,1) });
            let list = [...favorites];

            list.forEach( a => {
                const app = Shell.AppSystem.get_default().lookup_app(a);
                if (app) appList.push(app);
            });

            appList = [...running, ...appList];
            // when triggered by a mouse, keep favorites order instead of MRU
            if (!this.KEYBOARD_TRIGGERED || !this._favoritesMRU) {
                this._favoritesMRU = false;
                appList.sort((a, b) => {    a = favoritesFull.indexOf(a.get_id());
                                            b = favoritesFull.indexOf(b.get_id());
                                            return ( b > -1 && (b < a || a === -1));
                        }
                );

                this._initialSelectionMode = SelectionModes.ACTIVE;
            }

        } else {
            this._initialSelectionMode = SelectionModes.FIRST;
            let appInfoList = Shell.AppSystem.get_default().get_installed().filter(appInfo => {
                try {
                    appInfo.get_id(); // catch invalid file encodings
                } catch (e) {
                    return false;
                }

                return appInfo.should_show() && this._match(
                                              (appInfo.get_name()         ? appInfo.get_name()         : '')
                                            + (appInfo.get_generic_name() ? appInfo.get_generic_name() : '')
                                            + (appInfo.get_executable()   ? appInfo.get_executable()   : ''),
                                            pattern);
            });

            //let appList = [];
            for (let i = 0; i < appInfoList.length; i++) {
                let app = _convertAppInfoToShellApp(appInfoList[i]);
                appList.push(app);
            }
        
            const usage = Shell.AppUsage.get_default();
            // exclude running apps from the search result
            //appList = appList.filter(a => running.indexOf(a.get_id()) === -1);
            // sort apps by usage list
            appList.sort((a, b) => usage.compare(a.get_id(), b.get_id()));
            // limit the app list size
            appList.splice(12);
        }

        if (filterMode === FilterModes.MONITOR || filterMode === FilterModes.WORKSPACE) {
            let currentWS = global.workspace_manager.get_active_workspace().index();
            appList = appList.filter((a) => {
                let wins = a.get_windows();
                a.cachedWindows = [];
                wins.forEach(w => { if (w.get_workspace().index() === currentWS 
                                        && (w.get_monitor() === this._monitorIndex 
                                            || filterMode !== FilterModes.MONITOR))
                                        a.cachedWindows.push(w);
                                    }
                );
                return a.cachedWindows.length > 0 || favoritesFull.indexOf(a.get_id()) > -1;
            })
        } else {
            appList.forEach(a => a.cachedWindows = a.get_windows());
        }
        return appList;
    }
});

var WindowIcon = GObject.registerClass(
class WindowIcon extends St.BoxLayout {

    _init(item, iconIndex) {
        super._init({ style_class: 'alt-tab-app',
                      vertical: true });
        this._icon = new St.Widget({ layout_manager: new Clutter.BinLayout() });

        this.add_child(this._icon);
        this._icon.destroy_all_children();

        if (item.get_title)
            this._createWindowIcon(item, iconIndex);
        else
            this._createAppLauncherIcon(item, iconIndex);

        if (showHotKeys && HOT_KEYS && iconIndex < 12)
            this._icon.add_actor(this._createHotKeyNumIcon((iconIndex)));

    }

    _createWindowIcon(window, iconIndex) {
        this.is_window = true;

        this.window = window;

        this.ilabel = new St.Label({ text: window.get_title() });

        let tracker = Shell.WindowTracker.get_default();
        this.app = tracker.get_window_app(window);

        let mutterWindow = this.window.get_compositor_private();

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

        let switched = false;
        let size, cloneSize;

        size = SINGLE_APP_PREVIEW_SIZE ? SINGLE_APP_PREVIEW_SIZE : WINDOW_PREVIEW_SIZE;
        cloneSize = size;

        if (!SINGLE_APP_PREVIEW_SIZE && APP_ICON_SIZE > WINDOW_PREVIEW_SIZE) {
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

        if (this.window.is_on_all_workspaces())
            this._icon.add_actor(this._createStickyIcon());

        this._icon.set_size(size * scaleFactor, size * scaleFactor);
    }

    _createAppLauncherIcon(app, iconIndex) {
        this.is_window = false;
        this.app = app;
        this.ilabel = new St.Label({ text: this.app.get_name() });

        let icon = app.create_icon_texture(APP_MODE_ICON_SIZE);
        this._icon.add_actor(icon);

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        let winCount = app.cachedWindows.length;
    
        /*if (winCount > 0) {
    
            let mutterWindow = app.get_windows()[0].get_compositor_private();
            let cloneSize = Math.floor((mutterWindow.width / mutterWindow.height) * WINDOW_PREVIEW_SIZE / 3);
            let clone = AltTab._createWindowClone(mutterWindow, cloneSize * scaleFactor);
            this._icon.add_actor(clone);
            this._alignFront(clone, false);
        }*/
        
        winCount > 0 && this._icon.add_actor(this._createRunningIndicator(winCount));


    }

    _alignFront(icon, isWindow = true) {
        icon.x_align = icon.y_align = Clutter.ActorAlign.END;
        if (isWindow && this.window.is_above())
                        icon.y_align = Clutter.ActorAlign.START;
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
                                   x_align:  Clutter.ActorAlign.START,
                                   y_align:  Clutter.ActorAlign.END });

        let box = new St.BoxLayout({ style_class: (currentWS+1 === index) ? 'workspace-index-highlight' : 'workspace-index',
                                     vertical: true });
        icon.add_actor(box);

        let label = new St.Label({ text: index.toString() });
        box.add(label);

        return icon;
    }

    // icon indicating direct activation key 
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
                                  x_align:  Clutter.ActorAlign.CENTER,
                                  y_align:  Clutter.ActorAlign.START });
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

var AppIcon = GObject.registerClass(
class AppIcon extends Dash.DashIcon {
    _init(app, params = {}) {
        super._init(app, params);
        this.ilabel = new St.Label({ text: app.get_name() });
        this.style_class = '';
        this._iconContainer.remove_child(this._dot);

        const c = app.cachedWindows.length;
        if (c)
            this._iconContainer.add_child(this._createRunningIndicator(c));
    }

    _createIcon(iconSize) {
        return this.app.create_icon_texture(APP_MODE_ICON_SIZE);
    }

    _createRunningIndicator(num) {
        let currentWS = global.workspace_manager.get_active_workspace().index();
        let icon = new St.Widget({ x_expand: true,
                                   y_expand: true,
                                   x_align:  Clutter.ActorAlign.CENTER,
                                   y_align:  Clutter.ActorAlign.END });

        let box = new St.BoxLayout({ style_class: 'workspace-index',
                                     vertical: true });
        icon.add_actor(box);

        let label = new St.Label({ text: num.toString() });
        box.add(label);

        return icon;
    }

});

var WindowSwitcher = GObject.registerClass(
class WindowSwitcher extends AltTab.SwitcherPopup.SwitcherList {
    _init(windows) {
        super._init(true);
        this._infoLabel = new St.Label({ x_align: Clutter.ActorAlign.START,
                                         y_align: Clutter.ActorAlign.CENTER,
                                         style_class: 'info-label' });
        this._infoLabel.set_text("Filter: Order:"); // this text will be replaced immediately
        if (INFO)
            this.add_actor(this._infoLabel);
        this._label = new St.Label({ x_align: Clutter.ActorAlign.CENTER,
                                     y_align: Clutter.ActorAlign.CENTER });
        this.add_actor(this._label);

        this.windows = windows;
        this.icons = [];

        for (let i = 0; i < windows.length; i++) {
            let win = windows[i];
            let icon;
            if (win.get_title)
                icon = new WindowIcon(win, i);
            else {
                icon = new AppIcon(win);
                icon.connect('menu-state-changed',
                        (o, opened) => {
                            _cancelTimeout = opened;
                        });

            }

            this.addItem(icon, icon.ilabel);
            this.icons.push(icon);

            // the icon could be an app, not just a window
            if (icon.is_window) {
                icon._unmanagedSignalId = icon.window.connect('unmanaged', window => {
                    this._removeWindow(window);
                });
            }
        }

        this.connect('destroy', this._onDestroy.bind(this));
    }

    _onDestroy() {
        this.icons.forEach(icon => {
            if (icon.window)
                icon.window.disconnect(icon._unmanagedSignalId);
        });
    }

    vfunc_get_preferred_height(forWidth) {
        let [minHeight, natHeight] = super.vfunc_get_preferred_height(forWidth);

        let spacing = this.get_theme_node().get_padding(St.Side.BOTTOM);
        let [labelMin, labelNat] = this._label.get_preferred_height(-1);

        let multiplier = INFO ? 2 : 1;
        minHeight += multiplier * labelMin + spacing;
        natHeight += multiplier * labelNat + spacing;

        return [minHeight, natHeight];
    }

    vfunc_allocate(box, flags) {
        let themeNode = this.get_theme_node();
        let contentBox = themeNode.get_content_box(box);
        const labelHeight = this._label.height;
        const labelHeightF = INFO ? this._infoLabel.height : 0;
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
        childBox.y2 = contentBox.y2 - labelHeightF;
        childBox.y1 = childBox.y2 - labelHeight - labelHeightF;
        GNOME40 ? this._label.allocate(childBox)
                : this._label.allocate(childBox, flags);
        const childBoxF = new Clutter.ActorBox();
        childBoxF.x1 = contentBox.x1;
        childBoxF.x2 = contentBox.x2;
        childBoxF.y2 = contentBox.y2 + 2;
        childBoxF.y1 = childBox.y2 - labelHeightF + 2;
        if (INFO)
            GNOME40 ? this._infoLabel.allocate(childBoxF)
                    : this._infoLabel.allocate(childBoxF, flags);
    }


    highlight(index, justOutline) {
        super.highlight(index, justOutline);

        this._label.set_text(index == -1 ? '' : this.icons[index].ilabel.text);
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

var   AppSwitcherPopup = GObject.registerClass(
class AppSwitcherPopup extends WindowSwitcherPopup {

    _init() {
        super._init();
        this._switcherMode   = SwitcherModes.APPS;
        this.SHOW_APPS       = true;
        this.WIN_FILTER_MODE = this.APP_FILTER_MODE;
    }
});
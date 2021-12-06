'use strict';

const {GObject, GLib, St, Shell, Gdk} = imports.gi;
const Clutter         = imports.gi.Clutter;
const Meta            = imports.gi.Meta;
const Main            = imports.ui.main;
const AltTab          = imports.ui.altTab;
const SwitcherPopup   = imports.ui.switcherPopup;
const Dash            = imports.ui.dash;

const ExtensionUtils  = imports.misc.extensionUtils;
const Me              = ExtensionUtils.getCurrentExtension();
const Settings        = Me.imports.settings;
const ActionLib       = Me.imports.actions;

const shellVersion    = imports.misc.config.PACKAGE_VERSION;
const GNOME40         = parseFloat(shellVersion) >= 40;

// options inits in extension.enable()
var options;

const SwitcherMode = {
    WINDOWS: 0,
    APPS:    1,
};

const FilterMode = {
    ALL:       1,
    WORKSPACE: 2,
    MONITOR:   3,
};

const FilterModeLabel = ['',
    _('ALL'),
    _('WS '),
    _('MON')];

const Position = {
    TOP:    1,
    CENTER: 2,
    BOTTOM: 3,
};

const SortingMode = {
    MRU:                  1,
    STABLE_SEQUENCE:      2,
    STABLE_CURRENT_FIRST: 3,
};

const SortingModeLabel = ['',
    _('MRU'),
    _('STABLE'),
    _('STABLE - current 1.')];

const GroupMode = {
    NONE:              1,
    CURRENT_MON_FIRST: 2,
    APPS:              3,
    WORKSPACES:        4,
};

const GroupModeLabel = ['',
    _('NONE'),
    _('MON FIRST'),
    _('APPS'),
    _('WS')];

const SelectionMode = {
    NONE:  -1,
    FIRST:  0,
    SECOND: 1,
    ACTIVE: 2,
};

const Action = Settings.Actions;

let _cancelTimeout = false;

function _shiftPressed() {
    return global.get_pointer()[2] & Clutter.ModifierType.SHIFT_MASK;
}

function _ctrlPressed(state = 0) {
    let result;
    if (!state)
        state = global.get_pointer()[2];
    return state & Clutter.ModifierType.CONTROL_MASK;
}

function _superPressed() {
    return global.get_pointer()[2] & Clutter.ModifierType.SUPER_MASK;
}

function _getWindowApp(metaWindow) {
    let tracker = Shell.WindowTracker.get_default();
    return tracker.get_window_app(metaWindow);
}

function _getRunningAppsIds(stableSequence = false) {
    let running = [];
    if (stableSequence) {
        let winList = AltTab.getWindows(null);
        // We need to get stable order, the functions above return MRU order
        winList.sort((a, b) => a.get_stable_sequence() - b.get_stable_sequence());
        winList.forEach(w => {
            let app = _getWindowApp(w);
            let id = app.get_id();
            if (running.indexOf(id) < 0)
                running.push(id);
        });
    } else {
        Shell.AppSystem.get_default().get_running().forEach(a => running.push(a.get_id()));
    }
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
        this._actions              = null;
        // Global options
        // filter out all modifiers except Shift|Ctrl|Alt|Super and get those used in the shortcut that triggered this popup
        this._modifierMask         = global.get_pointer()[2] & 77; // 77 covers Shift|Ctrl|Alt|Super
        this._keyBind              = '';

        this.KEYBOARD_TRIGGERED    = true;  // whether was popup triggered by a keyboard. when true, POSITION_POINTER will be ignored. This var can be set from the caller
        this.POSITION_POINTER      = options.switcherPopupPointer; // place popup at pointer position
        this.REVERSE_AUTO          = options.switcherPopupReverseAuto;  // reverse list in order to the first item be closer to the mouse pointer. only if !KEYBOARD_TRIGGERED
        this.POPUP_POSITION        = options.switcherPopupPosition;
        this.NO_MODS_TIMEOUT       = options.switcherPopupPointerTimeout;
        this.INITIAL_DELAY         = options.switcherPopupTimeout;
        this.WRAPAROUND            = options.switcherPopupWrap;
        this.ACTIVATE_ON_HIDE      = options.switcherPopupActivateOnHide || options.switcherPopupShowImmediately;
        this.HOT_KEYS              = options.switcherPopupHotKeys;
        this.SHIFT_AZ_HOTKEYS      = options.switcherPopupShiftHotkeys;
        this.STATUS                = options.switcherPopupStatus;
        this.SHOW_WIN_IMEDIATELY   = options.switcherPopupShowImmediately;
        this.SHOW_WS_INDEX         = options.wsSwitchIndicator;
        this.SEARCH_ALL            = options.winSwitcherPopupSearchAll;
        this.OVERLAY_TITLE         = options.switcherPopupOverlayTitle;
        this.SEARCH_DEFAULT        = options.switcherPopupStartSearch;
        if (this.SEARCH_DEFAULT)
            this._searchEntry = '';
        else
            this._searchEntry = null;
        this._monitorIndex         = options.switcherPopupMonitor === 1 // 1: current, 2: primary
                                        ? global.display.get_current_monitor()
                                        : global.display.get_primary_monitor();
        this.HOVER_SELECT          = options.switcherPopupHoverSelect;
        this.SHOW_APPS             = false;

        // Window switcher
        this.WIN_FILTER_MODE       = options.winSwitcherPopupFilter;
        this.GROUP_MODE            = options.winSwitcherPopupOrder;
        this._defaultGrouping      = this.GROUP_MODE; // remember default sorting
        this.WIN_SORTING_MODE      = options.winSwitcherPopupSorting;
        this.SKIP_MINIMIZED        = options.winSkipMinimized;
        this.SEARCH_APPS           = options.winSwitcherPopupSearchApps;
        this._initialSelectionMode = this.WIN_SORTING_MODE === SortingMode.STABLE_SEQUENCE ? SelectionMode.ACTIVE : SelectionMode.SECOND;
        this.SINGLE_APP_PREVIEW_SIZE = options.singleAppPreviewSize;
        this.WINDOW_TITLES         = options.winSwitcherPopupTitles;
        this.WINDOW_PREVIEW_SIZE   = options.winSwitcherPopupPreviewSize;
        this.APP_ICON_SIZE         = options.winSwitcherPopupIconSize;
        this.WS_INDEXES            = options.winSwitcherPopupWsIndexes;

        // App switcher
        this.APP_FILTER_MODE       = options.appSwitcherPopupFilter;
        this.APP_SORTING_MODE      = options.appSwitcherPopupSorting;
        this.SORT_FAVORITES_BY_MRU = options.appSwitcherPopupFavMru;
        this.INCLUDE_FAVORITES     = options.appSwitcherPopupFavoriteApps;
        this.APP_MODE_ICON_SIZE    = options.appSwitcherPopupIconSize;

        this._switcherMode         = SwitcherMode.WINDOWS;

        // Runtime variables
        this._singleApp            = null;

        this._selectedIndex        = -1;    // deselect
        this._tempFilterMode       = null;
        this._firstRun             = true;
        this._favoritesMRU         = true;
        this._doNotReactOnScroll   = false;
        _cancelTimeout             = false;

        this.connect('destroy', this._onDestroyThis.bind(this));
    }

    _onDestroyThis() {
        this._doNotUpdateOnNewWindow = true;
        // this._initialDelayTimeoutId and this._noModsTimeoutId were already removed in super class
        let timeouts = [
            this._showWinImmediatelyTimeoutId,
            this._overlayDelayId,
            this._recentSwitchTimeoutId,
            this._newWindowConnectorTimeoutId
        ];
        timeouts.forEach(t => {
            if (t)
                GLib.source_remove(t);
        });
        if (this._newWindowConnector)
            global.display.disconnect(this._newWindowConnector);
        this._removeOverlays();
        if (this._actions)
            this._actions.clean();
            this._actions = null;
        }

    _removeOverlays() {
        if (this._overlayTitle) {
            this.destroyOverlayLabel(this._overlayTitle);
            this._overlayTitle = null;
        }
        if (this._overlaySearchLabel) {
            this.destroyOverlayLabel(this._overlaySearchLabel);
            this._overlaySearchLabel = null;
        }
        if (this._wsOverlay) {
            this.destroyOverlayLabel(this._wsOverlay);
            this._wsOverlay = null;
        }
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
        let x;
        if (this._switcherAppPos) {
            // if single app view was triggered from the app switcher, align the window switcher to selected app
            x = Math.max(this._switcherAppPos - childNaturalWidth / 2, monitor.x);
            x = Math.min(x, monitor.x + monitor.width - childNaturalWidth);
            x = Math.max(x, monitor.x);
        }
        if (this.POSITION_POINTER && !this.KEYBOARD_TRIGGERED) {
            if (x === undefined)
                x = Math.min(this._pointer.x, monitor.x + monitor.width - childNaturalWidth);
            childBox.x1 = x;
            if (childBox.x1 < monitor.x)
                childBox.x1 = monitor.x;
            childBox.y1 = Math.min(Math.max(this._pointer.y - (childNaturalHeight / 2), monitor.y), monitor.height - childNaturalHeight);
        } else {
            if (x === undefined)
                x = Math.max(monitor.x, monitor.x + Math.floor((monitor.width - childNaturalWidth) / 2));
            childBox.x1 = x;
            let offset = Math.floor((monitor.height - childNaturalHeight) / 2);
            if (this.POPUP_POSITION === Position.TOP)
                offset = 0;
            if (this.POPUP_POSITION === Position.BOTTOM)
                offset = monitor.height - childNaturalHeight;
            childBox.y1 = monitor.y + offset;
        }
        childBox.x2 = Math.min(monitor.x + monitor.width, childBox.x1 + childNaturalWidth);
        childBox.y2 = childBox.y1 + childNaturalHeight;
        GNOME40 ?   this._switcherList.allocate(childBox)
            :   this._switcherList.allocate(childBox, flags);
    }

    _initialSelection(backward, binding) {
        if (this._searchEntry !== null && this._searchEntry !== '')
            this._initialSelectionMode = SelectionMode.FIRST;
        if (this._items.length === 1 && this._switcherList) {
            this._select(0);
        } else if (backward) {
            if (this._initialSelectionMode === SelectionMode.SECOND)
                if (this._shouldReverse())
                    this._select(1);
                else
                    this._select(this._items.length - 1);
            else if (this._initialSelectionMode === SelectionMode.ACTIVE)
                this._select(this._getFocusedItemIndex());
                // this._select(this._previous());
        } else if (this._initialSelectionMode === SelectionMode.FIRST) {
            if (this._shouldReverse())
                this._select(this._items.length - 1);
            else
                this._select(0);
        } else if (this._initialSelectionMode === SelectionMode.SECOND) {
            if (this._items.length > 1) {
                if (this._shouldReverse())
                    this._select(this._items.length - 2);
                else
                    this._select(1);
            }
            else
                this._select(0);
        } else if (this._initialSelectionMode === SelectionMode.ACTIVE) {
            this._select(this._getFocusedItemIndex());
            // this._select(this._next());
        }
    }

    _connectNewWindows() {
        this._newWindowConnector = global.display.connect_after('window-created', (w, win) => {
            if (this._doNotUpdateOnNewWindow)
                return;
            // there are situations when window list updates later than this callback is executed
            this._newWindowConnectorTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                200,
                () => {
                    this._updateSwitcher();

                    if (win && this._showingApps && this._selectedIndex > -1)
                        this._select(this._getItemIndexByID(_getWindowApp(win).get_id()));
                    else if (this._selectedIndex > -1)
                        this._select(this._getItemIndexByID(win.get_id()));

                    this._newWindowConnectorTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
            });
        });
    }

    show(backward, binding, mask) {
        // remove overlay labels if exist
        this._removeOverlays();

        if (!Main.pushModal(this)) {
            if (!Main.pushModal(this, {options: Meta.ModalOptions.POINTER_ALREADY_GRABBED})) {
                let focusApp = global.display.get_focus_window().get_wm_class();
                log(`[${Me.metadata.uuid}] ${focusApp} probably grabbed the modal, exitting...`);
                return false;
            }
        }

        // if just one monitor is connected, then filter MONITOR is redundant to WORKSPACE, therefore MONITOR mode will be ignored
        if (Main.layoutManager.monitors.length < 2) {
            if (this.WIN_FILTER_MODE === FilterMode.MONITOR)
                this.WIN_FILTER_MODE = FilterMode.WORKSPACE;
            if (this.APP_FILTER_MODE === FilterMode.MONITOR)
                this.APP_FILTER_MODE = FilterMode.WORKSPACE;
        }
        if (this._firstRun) {
            if (this.SHOW_APPS)
                this.WIN_FILTER_MODE = this.APP_FILTER_MODE;
            else
                this.APP_FILTER_MODE = this.WIN_FILTER_MODE;
        }

        if (binding == 'switch-group') {
            this._switchGroupInit = true;
            let id = null;
            let metaWin = global.display.get_tab_list(Meta.WindowType.NORMAL, null)[0];
            if (metaWin)
                id = _getWindowApp(metaWin).get_id();
            if (id) {
                this._singleApp = id;
                this.SHOW_APPS = false;
            }
        }

        this.showHotKeys = this.KEYBOARD_TRIGGERED;
        if (this._pointer == undefined) {
            this._pointer = [];
            [this._pointer.x, this._pointer.y] = global.get_pointer();
            this._haveModal = true;
        }

        if (this._tempFilterMode)
            this._tempFilterMode = null;

        let switcherList = this._getSwitcherList();
        if (switcherList.length === 0) {
            // no results -> back to the last successful pattern
            this._searchEntry = this._searchEntry.slice(0, -1);
            this._tempFilterMode = null;
            switcherList = this._getSwitcherList();
        }

        if (switcherList.length > 0) {
            if (this._shouldReverse())
                switcherList.reverse();
            if (!this._showingApps && this.SHOW_WIN_IMEDIATELY && !this.KEYBOARD_TRIGGERED && this.WIN_SORTING_MODE === SortingMode.MRU) {
                this._initialSelectionMode = SelectionMode.FIRST;
            }
            if (this._switcherList)
                this._switcherList.destroy();
            let showTitles = this.WINDOW_TITLES === 1 || (this.WINDOW_TITLES === 3 && this._singleApp);
            let switcherParams = {
                'showTitles': showTitles,
                'winPrevSize': this._singleApp ? this.SINGLE_APP_PREVIEW_SIZE : this.WINDOW_PREVIEW_SIZE,
                'appIconSize': this.APP_ICON_SIZE,
                'appModeIconSize': this.APP_MODE_ICON_SIZE,
                'wsIndexes': this.WS_INDEXES,
                'hotKeys': this.HOT_KEYS && this.KEYBOARD_TRIGGERED,
                'status': this.STATUS,
                'labelTitle': !this.OVERLAY_TITLE && this.WINDOW_TITLES === 2, // 2: Disabled
                'singleApp': this._singleApp
            }
            this._switcherList = new WindowSwitcher(switcherList, switcherParams);
            if (!this.HOVER_SELECT && this.KEYBOARD_TRIGGERED) {
                this._switcherList._itemEntered = function() {}
            }

            if (this.OVERLAY_TITLE)
                this._switcherList._label.hide();

            this._items = this._switcherList.icons;
            this._connectIcons();

            this.showOrig(backward, binding, mask);
        } else {
            return false;
        }
        this._tempFilterMode = null;
        this._connectNewWindows();
        return true;
    }

    _getSwitcherList() {
        let switcherList;

        if (this.SHOW_APPS) {
            switcherList = this._getAppList(this._searchEntry);
            if (!switcherList.length && this.APP_FILTER_MODE > 1) {
                this._tempFilterMode = FilterMode.ALL;
                switcherList = this._getAppList(this._searchEntry);
            }
        } else {
            switcherList = this._getCustomWindowList();
        }

        let filterSwitchAllowed = (this._searchEntry === null || this._searchEntry === '') ||
                                    (this.SEARCH_ALL && this._searchEntry !== null && this._searchEntry !== '');

        // if no window matches the searched pattern, try to switch to a less restricted filter if possible and allowed
        // even if the switcher is in app mode, try to search windows if no app matches the search pattern
        let mode = this._switcherMode === SwitcherMode.APPS ? this.WIN_FILTER_MODE : this.WIN_FILTER_MODE - 1;
        if (switcherList.length === 0 &&
            (this.WIN_FILTER_MODE !== FilterMode.ALL || this._switcherMode === SwitcherMode.APPS) &&
            filterSwitchAllowed)
        {
            for (mode; mode > 0; mode--) {
                this._tempFilterMode = mode;
                switcherList = this._getCustomWindowList();
                if (switcherList.length > 0) {
                    // if on empty WS/monitor, don't select any item
                    if (this._searchEntry === null || this._searchEntry === '') {
                        this._initialSelectionMode = SelectionMode.NONE;
                        this._selectedIndex = -1;
                    }
                    break;
                }
            }
        }

        // if no windows/apps match the searched pattern and the searching apps is allowed, try to find some apps instead
        if (switcherList.length === 0 && this.SEARCH_APPS === true && this._searchEntry !== null && this._searchEntry !== '') {
            switcherList = this._getAppList(this._searchEntry);
            this._initialSelectionMode = SelectionMode.FIRST;
        }

        if (!switcherList.length && !AltTab.getWindows(null).length) {
            this._switcherMode = SwitcherMode.APPS;
            this.INCLUDE_FAVORITES = true;
            this.SHOW_APPS = true;
            this._initialSelectionMode = SelectionMode.FIRST;
            return this._getAppList();
        }

        return switcherList;
    }

    showOrig(backward, binding, mask) {
        if (this._items.length == 0)
            return false;

        this._alreadyShowed = true;

        this._haveModal = true;

        this.add_actor(this._switcherList);
        this._switcherList.connect('item-activated', this._itemActivated.bind(this));
        this._switcherList.connect('item-entered', this._itemEntered.bind(this));
        this._switcherList.connect('item-removed', this._itemRemoved.bind(this));

        this.visible = true;
        this.opacity = 0;
        this.get_allocation_box();

        // if switcher switches the filter mode, color the popup border to indicate current filter - red for MONITOR, orange for WS
        let themeNode = this._switcherList.get_theme_node();
        let padding = themeNode.get_padding(St.Side.BOTTOM) / 2;
        let border = themeNode.get_border_width(St.Side.BOTTOM);
        if (!this._firstRun && !this.STATUS && !(this._showingApps && (this._searchEntry !== null && this._searchEntry !== ''))) {
            let fm = this._showingApps ? this.APP_FILTER_MODE : this.WIN_FILTER_MODE;
            fm = this._tempFilterMode ? this._tempFilterMode : fm;
            if (fm === FilterMode.MONITOR) {
                // top and bottom border colors cover all sides
                this._switcherList.set_style(`border-top-color: rgb(96, 48, 48); border-bottom-color: rgb(96, 48, 48); padding-bottom: ${padding}px ${!border ? '; border-width: 1px' : ''}`);
            } else if (fm === FilterMode.WORKSPACE) {
                this._switcherList.set_style(`border-top-color: rgb(96, 80, 48); border-bottom-color: rgb(96, 80, 48); padding-bottom: ${padding}px ${!border ? '; border-width: 1px' : ''}`);
            } else if (fm === FilterMode.ALL) {
                this._switcherList.set_style(`border-top-color: rgb(53, 80, 48); border-bottom-color: rgb(53, 80, 48); padding-bottom: ${padding}px ${!border ? '; border-width: 1px' : ''}`);
            }
        } else  {
            this._switcherList.set_style(`padding-bottom: ${padding}px`);
        }

        this._initialSelection(backward, binding);

        // There's a race condition; if the user released Alt before
        // we got the grab, then we won't be notified. (See
        // https://bugzilla.gnome.org/show_bug.cgi?id=596695 for
        // details.) So we check now. (Have to do this after updating
        // selection.)
        if (mask !== undefined)
            this._modifierMask = mask;
        if (this._modifierMask) {
            let mods = global.get_pointer()[2];
            if (!(mods & this._modifierMask)) {
                if (!this._firstRun) {
                    this._finish(global.get_current_time());
                    return true;
                }
            }
        } else {
            this._resetNoModsTimeout();
        }

        this._setSwitcherStatus();
        // avoid showing overlay label before the switcher popup
        if (this._firstRun && this._overlayTitle)
            this._overlayTitle.opacity = 0;

        // We delay showing the popup so that fast Alt+Tab users aren't
        // disturbed by the popup briefly flashing.
        // but not when we're just overriding already shown content
        if (this._firstRun) {
            // timeout in which click on the swhitcher background acts as 'activate' despite configuration
            // for quick switch to recent window when triggered using mouse and top/bottom popup position
            this._recentSwitchTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                300,
                () => {
                    this._recentSwitchTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }
            );

            this._initialDelayTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                this.KEYBOARD_TRIGGERED ? this.INITIAL_DELAY : 0,
                () => {
                    if (!this._doNotShowImmediately) {
                        if (this.KEYBOARD_TRIGGERED) {
                            if (this._overlayTitle)
                                this._overlayTitle.opacity = 255;
                            this.opacity = 255;
                        } else {
                            this._shadeIn();
                        }
                        Main.osdWindowManager.hideAll();
                    }
                    this._initialDelayTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                });
            GLib.Source.set_name_by_id(this._initialDelayTimeoutId, '[gnome-shell] Main.osdWindow.cancel');
        } else {
            this.opacity = 255;
        }
        if (this._initialSelectionMode === SelectionMode.RECENT || this._initialSelectionMode === SelectionMode.NONE)
            this._initialSelectionMode = SelectionMode.ACTIVE;
        this._resetNoModsTimeout();
        Main.osdWindowManager.hideAll();

        if (this._searchEntry === '' && !this.SEARCH_DEFAULT)
            this._showOverlaySearchLabel('Type to search...');

        this._firstRun = false;
        return true;
    }

    _shadeIn() {
        let height = this._switcherList.height;
        this.opacity = 255;
        if (this._overlayTitle)
            this._overlayTitle.opacity = 0;

        this._switcherList.height = 0;
        this._switcherList.ease({
            height,
            duration: 50,
            mode: Clutter.AnimationMode.LINEAR,
            onComplete: () => {
                if (this._overlayTitle)
                    this._overlayTitle.opacity = 255
            },
        });
    }

    _shadeOut() {
        if (this._overlayTitle)
            this._overlayTitle.opacity = 0;
        this._switcherList.ease({
            height: 0,
            duration: 50,
            mode: Clutter.AnimationMode.LINEAR,
            onComplete: () => this.destroy(),
        });
    }

    fadeAndDestroy() {
        this._doNotShowImmediately = true;
        this._popModal();
        if (this._overlayTitle)
            this._removeOverlays();
        if (this.opacity > 0) {
            if (this.KEYBOARD_TRIGGERED) {
                this._switcherList.ease({
                    opacity: 0,
                    height: 0,
                    duration: 100,
                    mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                    // mode: Clutter.AnimationMode.LINEAR,
                    onComplete: () => this.destroy(),
                });
            } else {
                this._shadeOut();
            }
        } else {
            this.destroy();
        }
    }

    _finish() {
        if (this._showWinImmediatelyTimeoutId) {
            GLib.source_remove(this._showWinImmediatelyTimeoutId);
            this._showWinImmediatelyTimeoutId = 0;
        }
        this._doNotShowWin = true;
        this._doNotUpdateOnNewWindow = true;
        if (this._showingApps) {
            if (_ctrlPressed()) {
                // this can cause problems when a shortcut with Ctrl key is used to trigger the popup
                // so allow this only when it's not the case
                if (!_ctrlPressed(this._modifierMask))
                    this._getSelected().open_new_window(global.get_current_time());
            } else if (this._getSelected().cachedWindows[0]) {
                // Main.activateWindow(this._getSelected().cachedWindows[0]);
                // following not only activates the app recent window, but also rise all other windows of the app above other windows
                // but if item is activated without key/button press, only the first window is raised
                this._getSelected().activate_window(this._getSelected().cachedWindows[0], global.get_current_time());
                // also, if item is activated automaticaly, the window is not going to be activated. therefore the following line
                Main.activateWindow(this._getSelected().cachedWindows[0]);
            } else {
                if (this._getSelected().get_n_windows() === 0) {
                    // app has no windows - probably not running
                    this._getSelected().activate();
                } else {
                    // in this case app is running but no window match the current filter mode
                    this._getSelected().open_new_window(global.get_current_time());
                }
            }
        } else {
            Main.activateWindow(this._getSelected());
        }
        super._finish();
    }

    _connectIcons() {
        this._iconsConnections = [];
        this._switcherList.icons.forEach(icon => this._iconsConnections.push(icon.connect('button-press-event', this._onItemBtnPressEvent.bind(this))));
        this._switcherList.icons.forEach(icon => this._iconsConnections.push(icon.connect('scroll-event', this._onItemScrollEvent.bind(this))));
    }

    _updateSwitcher(winToApp = false) {
        let id;
        if (winToApp) {
            id = _getWindowApp(this._items[0].window);
        } else {
            id = this._getSelected();
        }
        id = id ? id.get_id() : null;
        this.show();
        this._select(this._getItemIndexByID(id));
    }

    _delayedUpdate(delay) {
        this._updateTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            delay,
            () => {
                this._updateSwitcher();
                this._updateTimeoutId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _setSwitcherStatus() {
        this._switcherList._statusLabel.set_text(
            `${_('Filter: ')}${FilterModeLabel[this._tempFilterMode === null ? this.WIN_FILTER_MODE : this._tempFilterMode]
            }${this._singleApp ? `/${_('APP')}` : ''},  ${
                _('Group: ')}${GroupModeLabel[this.GROUP_MODE]}, ${
                _('Sort: ')}${this._showingApps ? SortingModeLabel[this.APP_SORTING_MODE] : SortingModeLabel[this.WIN_SORTING_MODE]}, ${
                _('Search: ')} ${this._searchEntry === null ? 'Off' : 'On'}`
        );
        if (this._searchEntry !== null && this._searchEntry !== '') {
            this._showOverlaySearchLabel(this._searchEntry);
        } else if (this._searchEntry === '' && this._overlaySearchLabel) {
            this.destroyOverlayLabel(this._overlaySearchLabel);
            this._overlaySearchLabel = null;
        }
    }

    _resetNoModsTimeout() {
        if (this._noModsTimeoutId)
            GLib.source_remove(this._noModsTimeoutId);
        this._noModsTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            this.NO_MODS_TIMEOUT,
            () => {
                if (!this.KEYBOARD_TRIGGERED && this._isPointerOut() && !_cancelTimeout) {
                    if (this.SHOW_WIN_IMEDIATELY) {
                        if (this._lastShowed)
                            this._selectedIndex = this._lastShowed;
                        if (this._showingApps) {
                            if (this._getSelected().cachedWindows.length) {
                                this._finish();
                            } else {
                                if (this.ACTIVATE_ON_HIDE)
                                    this._finish();
                                else
                                    this.fadeAndDestroy();
                            }
                        } else {
                            this._finish();
                        }
                    } else if (this.ACTIVATE_ON_HIDE) {
                        this._finish();
                    } else {
                        this.fadeAndDestroy();
                    }
                    this._noModsTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                } else {
                    this._resetNoModsTimeout();
                }
            }
        );
    }

    _getFocusedItemIndex() {
        const metaWin = global.display.get_tab_list(Meta.TabList.NORMAL, null)[0];
        if (!metaWin)
            return 0;

        let id;
        let pt;

        if (this._items[0].is_window) {
            id = metaWin.get_id();
            pt = 'window';
        } else {
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
        if (!this._switcherList)
            return;

        if (this._initialSelectionMode === SelectionMode.NONE) {
            this._initialSelectionMode = SelectionMode.ACTIVE;
        } else {
            this._selectedIndex = index;
            this._switcherList.highlight(index);
            if (this.OVERLAY_TITLE)
                this._showOverlayTitle();
        }

        if (this.SHOW_WIN_IMEDIATELY) {
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

    _next(reversed = false) {
        if (this._reverseOrder  && !reversed)
            return this._previous(true);

        let step = 1;
        if (!this.WRAPAROUND && this._selectedIndex === (this._items.length - 1))
            step = 0;

        return mod(this._selectedIndex + step, this._items.length);
    }

    _previous(reversed = false) {
        if (this._reverseOrder && !reversed)
            return this._next(true);

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
            step = 1;
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

    _getNextApp() {
        let stableSequence = this.WIN_SORTING_MODE === SortingMode.STABLE_SEQUENCE;
        let apps = _getRunningAppsIds(stableSequence);
        if (apps.length === 0)
            return;
        let currentIndex = apps.indexOf(this._singleApp);
        if (currentIndex < 0)
            return;

        let targetIndex;
        if (_shiftPressed()) {
            targetIndex = currentIndex + 1;
            if (targetIndex > (apps.length - 1))
                targetIndex = 0;
        } else {
            targetIndex = currentIndex - 1;
            if (targetIndex < 0)
                targetIndex = apps.length - 1;
        }

        return apps[targetIndex];
    }

    _allWSWindowsSameMonitor() {
        let currentWS = global.workspace_manager.get_active_workspace();
        let windows = AltTab.getWindows(currentWS);
        if (windows.length === 0)
            return null;
        let ri = windows[0].get_monitor();
        for (let w of windows) {
            if (w.get_monitor() !== ri)
                return false;
        }
        return true;
    }

    _getSelected() {
        let selected = null;
        if (this._selectedIndex > -1) {
            let it = this._items[this._selectedIndex];
            if (it && it.is_window)
                selected = this._items[this._selectedIndex].window;
            else if (it)
                selected = this._items[this._selectedIndex].app;
        }
        return selected;
    }

    _getItemIndexByID(id) {
        for (let i = 0; i < this._items.length; i++) {
            let pt  = this._items[i].is_window ? 'window' : 'app';
            let cid = this._items[i][pt].get_id();

            if (cid === id)
                return i;
        }
        return 0;
    }

    _isPointerOut() {
        let [x, y, mods] = global.get_pointer();
        let switcher = this._switcherList;
        let margin = 15;

        if (x < (switcher.x - margin) || x > (switcher.x + switcher.width + margin))
            return true;
        if (y < (switcher.y - margin) || y > (switcher.y + switcher.height + margin))
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

    _onItemBtnPressEvent(actor, event) {
        const btn = event.get_button();
        let action;

        switch (btn) {
        case Clutter.BUTTON_PRIMARY:
            action = this._showingApps
            ? options.appSwitcherPopupPrimClickItem
            : options.winSwitcherPopupPrimClickItem;
            break;
        case Clutter.BUTTON_SECONDARY:
            action = this._showingApps
            ? options.appSwitcherPopupSecClickItem
            : options.winSwitcherPopupSecClickItem;
            break;
        case Clutter.BUTTON_MIDDLE:
            action = this._showingApps
            ? options.appSwitcherPopupMidClickItem
            : options.winSwitcherPopupMidClickItem;
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }

        this._triggerAction(action);
        return Clutter.EVENT_STOP;
    }

    _onItemScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();
        if (direction === Clutter.ScrollDirection.SMOOTH)
            return;
        if (this._showingApps) {
            this._triggerAction(options.appSwitcherPopupScrollItem, direction);

        } else { // if (this._switcherMode === SwitcherMode.WINDOWS) {
            this._triggerAction(options.winSwitcherPopupScrollItem, direction);
        }
        return Clutter.EVENT_STOP;
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
        // monitor relase of possible shortcut modifier keys only
        if (!(keyEvent.keyval == 65513 || keyEvent.keyval == 65511 ||  // Alt and Alt while Shift pressed
              keyEvent.keyval == 65515 ||                             // Super
              keyEvent.keyval == 65507 || keyEvent.keyval == 65508 || // Ctrl
              keyEvent.keyval == 65505 || keyEvent.keyval == 65506    // Shift
             )
        )
            return;

        if (this._modifierMask) {
            let mods = global.get_pointer()[2];
            let state = mods & this._modifierMask;

            if (state === 0) {
                if (this._selectedIndex !== -1) {
                    //this.blockSwitchWsFunction = true;
                    this._finish(keyEvent.time);
                } else {
                    this.fadeAndDestroy();
                }
            }
        } else {
            this._resetNoModsTimeout();
        }
        return Clutter.EVENT_STOP;
    }

    _keyPressHandler(keysym, action) {
        let keysymName = Gdk.keyval_name(keysym);
        let keyString;
        let keyUtf = Gdk.keyval_to_unicode(keysym);
        if (keyUtf === 0)
            keyString = null;
        else
            keyString = String.fromCharCode(keyUtf).toUpperCase();
        // direct item selection using F keys and numpad keys
        // if Shift pressed only select item, not activate it
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
                else
                    this._select(index);
            }
        // if Search Mode enabled and Shift not pressed, or number key was pressed (to allow enter numbers using Shift)
        //  use the input to build searched pattern
        } else if (this._searchEntry !== null && (!_shiftPressed() || keysymName.replace('KP_', '').match(/[0-9]/))) {
            keysymName = keysymName.replace('KP_', '');

            // don't close the popup during typing, when not triggered by a keyboard
            _cancelTimeout = true;

            // delete last string when Backspace was pressed
            if (keysym === Clutter.KEY_BackSpace) {
                this._searchEntry = this._searchEntry.slice(0, -1);
                this.show();
                return Clutter.EVENT_STOP;
            // add character to search pattern
            } else if (this._searchEntry !== null && !_ctrlPressed() &&
                        ((keysymName.length === 1 && (/[a-zA-Z0-9]/).test(keysymName)) || keysym === Clutter.KEY_space)
            ) {
                if (keysymName === 'space')
                    keysymName = ' ';
                if (!(keysymName === ' ' && (this._searchEntry === '' || this._searchEntry[this._searchEntry.length-1] === ' '))) {
                    this._searchEntry += keysymName;
                    this.show();
                    return Clutter.EVENT_STOP;
                }
            }
        }

        if (keysym === Clutter.KEY_Escape && this._singleApp && !this.KEYBOARD_TRIGGERED) {
            this._toggleSingleAppMode();
        } else if  (
            action == Meta.KeyBindingAction.SWITCH_WINDOWS ||
            action == Meta.KeyBindingAction.SWITCH_APPLICATIONS ||
            action == Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD ||
            action == Meta.KeyBindingAction.SWITCH_APPLICATIONS_BACKWARD ||
            (this._keyBind &&
                (keysym == Clutter[`KEY_${this._keyBind.toUpperCase()}`] ||
                 keysym == Clutter[`KEY_${this._keyBind.toLowerCase()}`]
                )
            )
        ) {
            if (this._singleApp)
                this._toggleSingleAppMode();

            else if (_shiftPressed())
                this._select(this._previous());

            else
                this._select(this._next());
        } else if (keysym == Clutter.KEY_Tab && _ctrlPressed()) {
            let mod = Main.layoutManager.monitors.length;

            if (_shiftPressed())
                this._monitorIndex = (this._monitorIndex + mod) % mod;

            else
                this._monitorIndex = (this._monitorIndex + 1) % mod;

            this._updateSwitcher();
        } else if (options.hotkeySearch.includes(keyString) || keysym == Clutter.KEY_Insert) {
            this._toggleSearchMode();
        }

        // Clear search entry or Force close (kill -9) the window process
        else if (keysym === Clutter.KEY_Delete) {
            if (!_shiftPressed() && this._searchEntry !== null) {
                this._searchEntry = '';
                this.show();
            } else if (_shiftPressed()) {
                this._killApp();
            }
        }

        else if (keysym == Clutter.KEY_Left || options.hotkeyLeft.includes(keyString)) {
            if (_shiftPressed() && _ctrlPressed())
                this._moveFavotites(-1);
            else if (!_shiftPressed())
                this._select(this._previous());
            else
                this._switchMonitor(Meta.DisplayDirection.LEFT);
        } else if (keysym == Clutter.KEY_Right || options.hotkeyRight.includes(keyString)) {
            if (_shiftPressed() && _ctrlPressed())
                this._moveFavotites(+1);
            if (!_shiftPressed())
                this._select(this._next());
            else
                this._switchMonitor(Meta.DisplayDirection.RIGHT);
        } else if (keysym == Clutter.KEY_Up || keysym == Clutter.KEY_Page_Up || options.hotkeyUp.includes(keyString)) {
            if (_ctrlPressed() && keysym == Clutter.KEY_Page_Up) {
                this._reorderWorkspace(-1);
            }
            else if (!_shiftPressed())
                this._switchWorkspace(Clutter.ScrollDirection.UP);
            else
                this._switchMonitor(Meta.DisplayDirection.UP);
        } else if (keysym == Clutter.KEY_Down || keysym == Clutter.KEY_Page_Down || options.hotkeyDown.includes(keyString)) {
            if (_ctrlPressed() && keysym == Clutter.KEY_Page_Down) {
                this._reorderWorkspace(+1);
            }
            else if (!_shiftPressed())
                this._switchWorkspace(Clutter.ScrollDirection.DOWN);
            else
                this._switchMonitor(Meta.DisplayDirection.DOWN);
        } else if (keysym === Clutter.KEY_Home) {
            if (_shiftPressed()) {
                this._switchToFirstWS();
            } else {
                this._select(0);
            }
        } else if (keysym === Clutter.KEY_End) {
            if (_shiftPressed()) {
                this._switchToLastWS();
            } else {
                this._select(this._items.length - 1);
            }
        } else if (options.hotkeySwitchFilter.includes(keyString)) {
            this._switchFilterMode();
        //} else if (keysym === Clutter.KEY_plus || keysym === Clutter.KEY_1 || keysym === Clutter.KEY_exclam) {
        } else if (options.hotkeySingleApp.includes(keyString)) {
            this._toggleSingleAppMode();
        }

        // else if (keysym === Clutter.KEY_semicolon || keysym === 96 || keysym === 126 || keysym === 65112) { // 96 is grave, 126 ascii tilde, 65112 dead_abovering. I didn't find Clutter constants.
        else if (action == Meta.KeyBindingAction.SWITCH_GROUP || action == Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD ||
                 keysym === Clutter.KEY_semicolon || keysym === 96 || keysym === 126 || keysym === 65112) {
            if (_ctrlPressed()) {
                this._toggleSwitcherMode();
            } else { // Ctrl not pressed
                if (this._switcherMode === SwitcherMode.APPS) {
                    if (this._showingApps) {
                        if (this._getSelected().cachedWindows.length)
                            this._toggleSingleAppMode();
                    } else if (this._singleApp) {
                        if (_shiftPressed())
                            this._select(this._previous());
                        else
                            this._select(this._next());
                    } else {
                        this._toggleSwitcherMode();
                    }
                } else if (this._switcherMode === SwitcherMode.WINDOWS) {
                    let index = this._selectedIndex > -1 ? this._selectedIndex : 0;

                    if (this._singleApp) {
                        if (_shiftPressed())
                            this._select(this._previous());
                        else
                            this._select(this._next());
                    } else if (this.GROUP_MODE !== GroupMode.APPS) {
                        this.GROUP_MODE = GroupMode.APPS;
                        this.show();
                    } else {
                        this._selectNextApp(index);
                    }
                }
            }
        }

        // toggle sort by workspaces
        else if ((options.hotkeyGroupWs.includes(keyString)) && (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            if (!this._showingApps)
                this._toggleWsOrder();
        }

        // show window
        else if (keysym === Clutter.KEY_space || keysym === Clutter.KEY_KP_0 || keysym === Clutter.KEY_KP_Insert) {
            this._showWindow();
        }

        // close window/app
        else if (options.hotkeyCloseQuit.includes(keyString)) {
            if (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)
                this._closeWinQuitApp();
        }

        // close all listed windows that belongs to the selected app
        else if ((options.hotkeyCloseAllApp.includes(keyString)) && (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            this._closeAppWindows();
        }

        // make selected window Always on Top
        else if ((options.hotkeyAbove.includes(keyString)) && (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            if (!this._showingApps)
                this._toggleWinAbove();
        }

        // make selected window Allways on Visible Workspace
        else if ((options.hotkeySticky.includes(keyString)) && (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            if (!this._showingApps)
                this._toggleWinSticky();
        }

        // move selected window to the current workspace
        else if ((options.hotkeyMoveWinToMonitor.includes(keyString)) &&
                 (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            this._moveToCurrentWS();
        }

        // maximize (and move if needed) selected window on the current workspace and monitor
        else if ((options.hotkeyMaximize.includes(keyString)) &&
                 (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            if (!this._showingApps)
                this._toggleMaximizeOnCurrentMonitor();
        }

        // toggle FS on new ws
        else if ((options.hotkeyFsOnNewWs.includes(keyString)) &&
                 (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            if (this._showingApps || this._selectedIndex < 0)
                return;

            this._toggleFullscreenOnNewWS();
        }

        // open New Window
        else if (((options.hotkeyNewWin.includes(keyString)) &&
                  (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) ||
                 (keysym === Clutter.KEY_Return && _ctrlPressed())) {
            this._openNewWindow();
        }

        // toggle Switcher Mode
        else if ((options.hotkeySwitcherMode.includes(keyString)) &&
                     (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            this._toggleSwitcherMode();
        }

        // make thumbnail of selected window
        else if ((options.hotkeyThumbnail.includes(keyString)) && (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            if (!this._showingApps)
                this._createWinThumbnail();
        }

        else if ((options.hotkeyPrefs.includes(keyString)) && (this.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            this._openPrefsWindow();
        }

        else {
            return Clutter.EVENT_PROPAGATE;
        }

        return Clutter.EVENT_STOP;
    }

    vfunc_button_press_event(event) {
        const btn = event.button;
        const pointerOut = this._isPointerOut();
        let action;

        switch (btn) {
        case Clutter.BUTTON_PRIMARY:
            if (this._recentSwitchTimeoutId && !pointerOut)
                action = Action.ACTIVATE;
            else
                action = pointerOut
                ? options.switcherPopupPrimClickOut
                : options.switcherPopupPrimClickIn;
            break;
        case Clutter.BUTTON_SECONDARY:
            action = pointerOut
            ? options.switcherPopupSecClickOut
            : options.switcherPopupSecClickIn;
            break;
        case Clutter.BUTTON_MIDDLE:
            action = pointerOut
            ? options.switcherPopupMidClickOut
            : options.switcherPopupMidClickIn;
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }

        this._triggerAction(action);
        return Clutter.EVENT_STOP;

    }

    vfunc_scroll_event(scrollEvent) {
        let direction = scrollEvent.direction;
        if (direction === Clutter.ScrollDirection.SMOOTH || this._doNotReactOnScroll) {
            this._doNotReactOnScroll = false;
            return;
        }

        this._resetNoModsTimeout();

        const action = this._isPointerOut()
            ? options.switcherPopupScrollOut
            : options.switcherPopupScrollIn;
        this._triggerAction(action, direction);
        return Clutter.EVENT_STOP;
    }

    _moveFavotites(direction) {
        if (!this._showingApps && this.INCLUDE_FAVORITES)
            return;

        let app = this._getSelected().get_id();
        let favorites = global.settings.get_strv('favorite-apps');
        let fromIndex = favorites.indexOf(app);
        let maxIndex = favorites.length - 1;

        if (fromIndex == -1) {} else {
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

    _showWindow() {
        if (this._doNotShowWin)
            return;
        let selected = this._getSelected();
        if (!selected)
            return;

        let appId = 0;

        if (selected.get_windows) {
            if (!selected.cachedWindows.length)
                return;
            appId = selected.get_id();
            selected = selected.cachedWindows[0];
        }

        let id = selected.get_id();
        if (appId)
            id = appId;

        if (selected.minimized)
            selected.unminimize();
        let a = selected.above;
        selected.make_above();
        a ? selected.make_above() : selected.unmake_above();
        if (global.workspace_manager.get_active_workspace() !== selected.get_workspace()) {
            Main.wm.actionMoveWorkspace(selected.get_workspace());
            this._showWsIndex();
        }
        // switcher cannot be updated because if it's wider than screen, some items wouldn't be accessible
        // this._updateSwitcher();
        // avoid colision of creating new switcher while destroying popup during the initial show delay, when immediate show win is enabled
        /*if (!this._initialDelayTimeoutId) {
            if (global.workspace_manager.get_active_workspace() !== selected.get_workspace())
                this.show();
        }
        this._doNotShowWin = true;
        this._select(this._getItemIndexByID(id));
        this._doNotShowWin = false;*/
    }

    _toggleSingleAppMode(switchOn = false) {
        let selected = this._getSelected();
        if (!selected)
            return;

            let winToApp = false;
        if (!this._singleApp || switchOn) {
            if (this._showingApps) {
                if (!selected.cachedWindows.length)
                    return;
                this._singleApp = selected.get_id();
                this.SHOW_APPS = false;
                // this._showingApps = false;
            } else {
                this._singleApp = _getWindowApp(selected).get_id();
            }
        } else {
            this._singleApp = null;
            this._switcherAppPos = null;
            if (this._switcherMode === SwitcherMode.APPS) {
                this.SHOW_APPS = true;
                winToApp = true;
            }
        }
        if (this._singleApp) {
            let item = this._items[this._selectedIndex];
            this._switcherAppPos = Math.floor(item.get_transformed_position()[0]) + item.width / 2;
        }
        this._updateSwitcher(winToApp);
    }

    _toggleSearchMode() {
        if (this._searchEntry !== null) {
            this._searchEntry = null;
            _cancelTimeout = false;
        } else {
            this._searchEntry = '';
            this._modifierMask = 0;
            _cancelTimeout = true;
            this.SEARCH_DEFAULT = false;
        }

        this.show();
    }

    _toggleSwitcherMode() {
        if (this._switcherMode === SwitcherMode.APPS) {
            this._switcherMode = SwitcherMode.WINDOWS;
            this.SHOW_APPS = false;
            this._singleApp = null;

            let id = 0;
            if (this._showingApps) {
                if (this._getSelected().cachedWindows.length)
                    id = this._getSelected().cachedWindows[0].get_id();
            } else {
                id = _getWindowApp(this._items[0].window).get_id();
            }

            this.show();
            this._select(this._getItemIndexByID(id));
        } else /* if (this._switcherMode === SwitcherMode.WINDOWS)*/ {
            this._switcherMode = SwitcherMode.APPS;
            this.SHOW_APPS = true;
            this._singleApp = null;
            /* if (_searchEntry != null)
                this._searchEntry = '';*/

            let id;
            if (this._showingApps) {
                if (this._selectedIndex > -1 && this._getSelected().cachedWindows.length)
                    id = this._getSelected().cachedWindows[0].get_id();
            } else {
                if (this._selectedIndex > -1)
                    id = _getWindowApp(this._items[this._selectedIndex].window).get_id();
            }
            this._initialSelectionMode = SelectionMode.FIRST;
            this.show();
            if (id !== undefined)
                this._select(this._getItemIndexByID(id));
        }
    }

    _switchFilterMode() {
        let filterMode = this._showingApps
            ? this.APP_FILTER_MODE
            : this.WIN_FILTER_MODE;
        // if active ws has all windows on one monitor, ignore the monitor filter mode to avoid 'nothing happen' when switching between modes
        let m = (Main.layoutManager.monitors.length > 1) && !this._allWSWindowsSameMonitor() ? 3 : 2;
        filterMode -= 1;
        if (filterMode < FilterMode.ALL)
            filterMode = m;

        this.APP_FILTER_MODE = filterMode;
        this.WIN_FILTER_MODE = filterMode;

        this.show();
    }

    _toggleWsOrder() {
        if (this.GROUP_MODE === GroupMode.WORKSPACES)
            this.GROUP_MODE = this._defaultGrouping;
        else
            this.GROUP_MODE = GroupMode.WORKSPACES;
        this._updateSwitcher();
        this._showWsIndex();
    }

    // place the indicator overlay outside the switcher
    _showWsIndex(text = null) {
        if (!this.SHOW_WS_INDEX && !text)
            return;

        const offset = (this._overlayTitle ? this._overlayTitle.height : 0)
                     + (this._overlaySearchLabel ? this._overlaySearchLabel.height : 0);

        if (this._wsOverlay) {
            this.destroyOverlayLabel(this._wsOverlay);
        }

        this._wsOverlay = this._customOverlayLabel('ws-overlay', 'workspace-index-overlay');
        this._wsOverlay.text = (global.workspace_manager.get_active_workspace().index() + 1).toString();
        Main.layoutManager.addChrome(this._wsOverlay);

        let geometry = global.display.get_monitor_geometry(this._monitorIndex);
        const labelOffset = 10;
        let l1 = this._overlayTitle ? (this._overlayTitle.height + labelOffset) : 0;
        let l2 = this._overlaySearchLabel ? (this._overlaySearchLabel.height + labelOffset) : 0;
        switch (this.POPUP_POSITION) {
        case Position.TOP:
            this._wsOverlay.y = Math.max(
                geometry.height / 2,
                Math.min(geometry.height - this._wsOverlay.height - this._switcherList.height - l1 - l2, geometry.height)
            );
            break;
        case Position.CENTER:
            this._wsOverlay.y = Math.min(
                geometry.height / 2 + (this._switcherList.height / 2),
                Math.max(geometry.height / 2 + this._wsOverlay.height / 2, geometry.height)
            );
            break;
        case Position.BOTTOM :
            this._wsOverlay.y = Math.min(
                geometry.height / 2,
                Math.max(geometry.height - this._wsOverlay.height - this._switcherList.height - l1 - l2, 0)
            );
            break;
        }
        this._wsOverlay.x = geometry.x;
        this._wsOverlay.width = geometry.width;
        //return wsLabel;
    }

    _showOverlaySearchLabel(text) {
        let margin = 10;
        if (this._overlaySearchLabel) {
            this.destroyOverlayLabel(this._overlaySearchLabel);
        }
        this._overlaySearchLabel = new St.BoxLayout({style_class: 'search-text'});

        let icon = new St.Icon({icon_name: 'edit-find-symbolic'});
        this._overlaySearchLabel.add_actor(icon);
        this._overlaySearchLabel._label = this._customOverlayLabel('search-text', '');
        this._overlaySearchLabel._label.text = ` ${text}`;

        this._overlaySearchLabel.add_actor(this._overlaySearchLabel._label);
        Main.layoutManager.addChrome(this._overlaySearchLabel);
        const offset = this._overlayTitle
            ? this._overlayTitle.height + margin
            : margin;

        this._setOverlayLabelPosition(this._overlaySearchLabel, 0, offset, this._switcherList);
    }

    _showOverlayTitle() {
        let selected = this._items[this._selectedIndex];
        let title = '';
        title = selected.is_window
            ? selected.window.get_title()
            : selected.titleLabel.text;
        if (this._overlayTitle) {
            this.destroyOverlayLabel(this._overlayTitle);
        }

        this._overlayTitle = this._customOverlayLabel('item-title', 'title-label');
        this._overlayTitle.text = title;
        Main.layoutManager.addChrome(this._overlayTitle);

        let index = this._selectedIndex;
        // get item position on the screen and calculate center position of the label
        let [xPos] = this._items[index].get_transformed_position();
        xPos = Math.floor(xPos + this._items[index].width / 2);
        this._setOverlayLabelPosition(this._overlayTitle, xPos, 0, this._switcherList);
    }

    _setOverlayLabelPosition(overlayLabel, xPos = 0, yOffset = 0, parent = null) {
        let geometry = global.display.get_monitor_geometry(this._monitorIndex);
        let margin = 5;
        overlayLabel.width = Math.min(overlayLabel.width, geometry.width);
        // win/app titles should be always placed centered to the switcher popup
        let overlayCenter = xPos ? xPos : parent.allocation.x1 + parent.width / 2;
        let x = Math.floor(Math.min(overlayCenter - (overlayLabel.width / 2), geometry.x + geometry.width - overlayLabel.width));
        if (x < geometry.x)
            x = geometry.x;
        let y = parent.allocation.y1 - overlayLabel.height - yOffset - margin;
        if (y < geometry.y)
            y = parent.allocation.y1 + parent.height + yOffset + margin;

        [overlayLabel.x, overlayLabel.y] = [x, y];
    }

    _customOverlayLabel(name, style_class) {
        let label = new St.Label({
            name: name,
            style_class: style_class,
            reactive: false,
        });
        return label;
    }

    destroyOverlayLabel(overlayLabel) {
        Main.layoutManager.removeChrome(overlayLabel);
        overlayLabel.destroy();
        if (this._overlayDelayId)
            GLib.source_remove(this._overlayDelayId);
    }

    // Actions
    //////////////////////////////////////////
    _getActions() {
        if (!this._actions)
            this._actions = new ActionLib.Actions();
        return this._actions;
    }

    _switchWorkspace(direction) {
        let id = this._getSelectedID();
        this._getActions().switchWorkspace(direction, true);
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
                this._updateSwitcher();
            }
        }
    }

    _moveToCurrentWS() {
        let selected = this._getSelected();
        if (!selected)
            return;
        let winList = selected.cachedWindows ? selected.cachedWindows : [selected];
        winList.forEach(win => {
            this._getActions().moveWindowToCurrentWs(win, this.KEYBOARD_TRIGGERED ? this._monitorIndex : -1);
        });
        this._showWindow(this._selectedIndex);
        this._updateSwitcher();
        this._showWsIndex();
    }

    _reorderWorkspace(direction = 0) {
        this._getActions().reorderWorkspace(direction);
        this._showWsIndex();
    }

    _toggleMaximizeOnCurrentMonitor() {
        let selected = this._getSelected();
        if (selected && !selected.cachedWindows) {
            this._getActions().toggleMaximizeOnCurrentMonitor(
                selected, this.KEYBOARD_TRIGGERED ? this._monitorIndex : -1);
            this._showWindow();
            this._updateSwitcher();
        }
    }

    _toggleFullscreenOnNewWS() {
        let selected = this._getSelected();
        if (selected && !selected.cachedWindows) {
            this._getActions().fullscreenWinOnEmptyWs(selected);
            this._delayedUpdate(200);
        }
    }

    _groupWindowsByApp() {
        if (this.GROUP_MODE !== GroupMode.APPS) {
            this.GROUP_MODE = GroupMode.APPS;
            this.show();
        }
    }

    _groupCurrentMonFirst() {
        if (this.GROUP_MODE !== GroupMode.CURRENT_MON_FIRST) {
            this.GROUP_MODE = GroupMode.CURRENT_MON_FIRST;
            this.show();
        }
    }

    _createWinThumbnail() {
        let selected = this._getSelected();
        if (selected && !selected.get_windows)
            this._getActions().makeThumbnailWindow(selected);
    }

    _openAppIconMenu() {
        let selected = this._getSelected();
        if (!selected)
            return;
        let nWindows = selected.cachedWindows.length;
        let popupItems = [
            [_('Quit'), this._closeWinQuitApp],
            [_('Force Quit'), this._killApp],
            [_(`Close ${nWindows} Window(s)`), this._closeAppWindows],
            [_(`Move ${nWindows} Window(s) to the current WS/Monitor`), this._moveToCurrentWS],
        ];
        let appIcon = this._items[this._selectedIndex];
        if (appIcon) {
            appIcon.popupMenu();
            //const PopupMenu = imports.ui.popupMenu;
            //appIcon._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem(_('Actions')));
            if (nWindows) {
                popupItems.forEach(i => {
                    let item = appIcon._menu._appendMenuItem(i[0]);
                    item.connect('activate', i[1].bind(this));
                });
            }
        }
    }

    _closeWinQuitApp() {
        let selected = this._getSelected();
        if (!selected)
            return;
        if (this._showingApps) {
            selected.request_quit();
        } else if (_ctrlPressed()) {
            _getWindowApp(selected).request_quit();
        } else {
            selected.delete(global.get_current_time());
        }
        // if any window remains, update the switcher content
        if (this._items.length > 1)
            this._delayedUpdate(200);
    }

    _closeAppWindows() {
        let selected = this._getSelected();
        if (!selected)
            return;
        this._getActions().closeAppWindows(selected, this._items);
        this._delayedUpdate(200);
    }

    _killApp() {
        let selected = this._getSelected();
        if (!selected)
            return;
        if (this._showingApps) {
            if (selected.cachedWindows.length > 0)
                selected.cachedWindows[0].kill();
            this._delayedUpdate(200);
        } else {
            selected.kill();
        }
    }

    _openNewWindow() {
        let selected = this._getSelected();
        if (!selected)
            return;
        if (this._showingApps) {
            selected.open_new_window(global.get_current_time());
        } else {
            selected = Shell.WindowTracker.get_default().get_window_app(selected);
            selected.open_new_window(global.get_current_time());
        }
    }

    _switchToFirstWS() {
        Main.wm.actionMoveWorkspace(global.workspace_manager.get_workspace_by_index(0));
        this.show();
        this._showWsIndex();
    }

    _switchToLastWS() {
        Main.wm.actionMoveWorkspace(global.workspace_manager.get_workspace_by_index(global.workspace_manager.n_workspaces - 1));
        this.show();
        this._showWsIndex();
    }

    _toggleWinAbove() {
        let selected = this._getSelected();
        if (!selected)
            return;
        this._getActions().toggleAboveWindow(selected);
        Main.wm.actionMoveWorkspace(selected.get_workspace());
        this._updateSwitcher();
    }

    _toggleWinSticky() {
        let selected = this._getSelected();
        if (!selected)
            return;
        this._getActions().toggleStickyWindow(selected);
        this._updateSwitcher();
    }

    _openPrefsWindow() {
        Main.extensionManager.openExtensionPrefs(Me.metadata.uuid, '', {});
    }

    ////////////////////////////////////////////////////////////////////////

    _triggerAction(action, direction = 0) {
        if (this._recentSwitchTimeoutId && this.SHOW_WIN_IMEDIATELY) {
            this._select(this._next());
        }
        switch (action) {
        case Action.SELECT_ITEM:
            this._disableHover();
            this._scrollHandler(direction);
            break;
        case Action.SWITCH_FILTER:
            this._switchFilterMode();
            break;
        case Action.SWITCH_WS:
            this._switchWorkspace(direction);
            break;
        case Action.SHOW:
            this._showWindow(this._selectedIndex);
            break;
        case Action.GROUP_APP:
            this._groupWindowsByApp();
            break;
        case Action.CURRENT_MON_FIRST:
            this._groupCurrentMonFirst();
            break;
        case Action.SINGLE_APP:
            this._toggleSingleAppMode();
            break;
        case Action.SWITCHER_MODE:
            this._toggleSwitcherMode();
            break;
        case Action.ACTIVATE:
            this._finish();
            break;
        case Action.THUMBNAIL:
            this._createWinThumbnail();
            break;
        case Action.MOVE_TO_WS:
            this._moveToCurrentWS();
            break;
        case Action.FS_ON_NEW_WS:
            this._toggleFullscreenOnNewWS();
        case Action.HIDE:
            this.fadeAndDestroy();
            break;
        case Action.MENU:
            this._openAppIconMenu();
            break;
        case Action.CLOSE_QUIT:
            this._closeWinQuitApp();
            break;
        case Action.KILL:
            this._killApp();
            break;
        case Action.PREFS:
            this._openPrefsWindow();
            break;
        case Action.NEW_WINDOW:
            this._openNewWindow();
            break;
        case Action.NONE:
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }
    }
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _getCustomWindowList(allWindows = false) {
        let filterMode;
        if (this._tempFilterMode)
            filterMode = this._tempFilterMode;
        else
            filterMode = this.WIN_FILTER_MODE;
        let ws = global.workspace_manager.get_active_workspace();

        let monitor = this._monitorIndex;

        let workspace = null;
        let winList = AltTab.getWindows(workspace);

        const currentWin = winList[0];

        // after the shell restarts (X11) AltTab.getWindows(ws) generates different (wrong) win order than ...getwindows(null) (tested on GS 3.36 - 41)
        // so we will filter the list here if needed, to get consistent results in this situation for all FilterModes
        if (filterMode > FilterMode.ALL && !allWindows) {
            winList = winList.filter(w => w.get_workspace() === ws);
            if (filterMode === FilterMode.MONITOR && monitor > -1)
                winList = winList.filter(w => w.get_monitor() === monitor);
        }

        if (this.SKIP_MINIMIZED)
            winList = winList.filter(w => !w.minimized);

        if (this.WIN_SORTING_MODE === SortingMode.STABLE_SEQUENCE || this.WIN_SORTING_MODE === SortingMode.STABLE_CURRENT_FIRST) {
            winList.sort((a, b) => a.get_stable_sequence() - b.get_stable_sequence());
            if (this.WIN_SORTING_MODE === SortingMode.STABLE_CURRENT_FIRST) {
                const currentSq = currentWin.get_stable_sequence();
                winList.sort((a, b, cs = currentSq) => (b.get_stable_sequence() > cs) && (a.get_stable_sequence() <= cs)
                    ? 0 : 1
                );
            }
        }

        if (this.GROUP_MODE === GroupMode.WORKSPACES && filterMode === FilterMode.ALL) {
            winList.sort((a, b) => b.get_workspace().index() < a.get_workspace().index());
        }
        else if (this.GROUP_MODE === GroupMode.CURRENT_MON_FIRST && filterMode < FilterMode.MONITOR) {
            // windows from the active workspace and monnitor first
            winList.sort((a, b) =>  (b.get_workspace().index() === ws.index() && b.get_monitor() === monitor) &&
                                    (a.get_workspace().index() !== ws.index() || a.get_monitor() !== monitor));
        }
        else if (this.GROUP_MODE === GroupMode.APPS) {
            // let apps = _getAppList(winList);
            let apps = _getRunningAppsIds();
            winList.sort((a, b) => apps.indexOf(_getWindowApp(b).get_id()) < apps.indexOf(_getWindowApp(a).get_id()));
        }

        if (this._singleApp) {
            //this.SINGLE_APP_PREVIEW_SIZE = this._singleAppPreviewSize;
            if (this._switchNextApp) {
                this._singleApp = this._getNextApp(winList);
                this._switchNextApp = false;
            }
            let tracker = Shell.WindowTracker.get_default();
            winList = winList.filter(w => tracker.get_window_app(w).get_id() === this._singleApp);
        } /*else {
            this.SINGLE_APP_PREVIEW_SIZE = 0;
        }*/

        if (this._searchEntry) {
            const filterPatern = (wList, pattern) => {
                return wList.filter(w => {
                // search in window title and app name
                    const appInfo = Shell.WindowTracker.get_default().get_window_app(w).appInfo;
                    let appInfoText = appInfo
                        ? (appInfo.get_name()         ? appInfo.get_name()         : '') +
                          (appInfo.get_generic_name() ? appInfo.get_generic_name() : '') +
                          (appInfo.get_executable()   ? appInfo.get_executable()   : '')
                        : '';
                    return this._match(
                        w.title +
                        appInfoText,
                        pattern);
                });
            };

            let winListP = filterPatern(winList, this._searchEntry);
            // if no window match the pattern, remove the unmatched character
            if (winListP.length === 0 && !this._tempFilterMode) {
                // this._searchEntry = this._searchEntry.slice(0, -1);
                winListP = filterPatern(winList, this._searchEntry);
            }

            winList = winListP;
        }

        if (winList.length)
            this._showingApps = false;
        return winList;
    }

    _getAppList(pattern = '') {
        let filterMode;
        filterMode = this._tempFilterMode
            ? this._tempFilterMode
            : this.APP_FILTER_MODE;

        // pattern can be null
        if (!pattern)
            pattern = '';

        let appList = [];

        const running = Shell.AppSystem.get_default().get_running(); // AppSystem returns list in MRU order
        const runningIds = _getRunningAppsIds(true); // true for stable sequence order

        let favorites = [];
        let favoritesFull = [];

        if (this.SHOW_APPS && pattern == '') {
            if (this.INCLUDE_FAVORITES) {
                favoritesFull = global.settings.get_strv('favorite-apps');
                favorites = [...favoritesFull];
            }

            // remove running apps from favorites list
            runningIds.forEach(a => {
                const i = favorites.indexOf(a);
                if (i > -1)
                    favorites.splice(i, 1);
            });
            let favList = [...favorites];

            // find app objects for favorites
            favList.forEach(a => {
                const app = Shell.AppSystem.get_default().lookup_app(a);
                if (app)
                    appList.push(app);
            });

            if (this.APP_SORTING_MODE === SortingMode.STABLE_SEQUENCE) {
                running.sort((a, b) => runningIds.indexOf(a.get_id()) - runningIds.indexOf(b.get_id()));
            }

            appList = [...running, ...appList];
            // when triggered by a mouse, keep favorites order instead of MRU
            if (!this.KEYBOARD_TRIGGERED || !this._favoritesMRU || this.APP_SORTING_MODE !== SortingMode.MRU) {
                this._favoritesMRU = false;
                appList.sort((a, b) => {
                    a = favoritesFull.indexOf(a.get_id());
                    b = favoritesFull.indexOf(b.get_id());
                    return  b > -1 && (b < a || a === -1);
                });

                this._initialSelectionMode = SelectionMode.ACTIVE;
            }
        } else {
            this._initialSelectionMode = SelectionMode.FIRST;
            let appInfoList = Shell.AppSystem.get_default().get_installed().filter(appInfo => {
                try {
                    appInfo.get_id(); // catch invalid file encodings
                } catch (e) {
                    return false;
                }

                let name = appInfo.get_name() || '';
                let gname = appInfo.get_generic_name() || '';
                let exec = appInfo.get_executable() || '';
                // show only launchers that should be visible in this DE and invisible launchers of Gnome Settings items
                return (appInfo.should_show() || (exec.includes('gnome-control-center', 0))) && this._match(
                    `${name} ${gname} ${exec}`,
                    pattern);
            });

            for (let i = 0; i < appInfoList.length; i++) {
                let app = _convertAppInfoToShellApp(appInfoList[i]);
                appList.push(app);
            }

            const usage = Shell.AppUsage.get_default();
            // exclude running apps from the search result
            // appList = appList.filter(a => running.indexOf(a.get_id()) === -1);

            // sort apps by usage list
            appList.sort((a, b) => usage.compare(a.get_id(), b.get_id()));
            appList.sort((a, b) => b.get_n_windows() > 0 && a.get_n_windows() === 0);
            // limit the app list size
            appList.splice(12);
        }

        let windowTracker = Shell.WindowTracker.get_default();
        this._tempFilterMode = filterMode;
        if ((filterMode === FilterMode.MONITOR || filterMode === FilterMode.WORKSPACE) && pattern === '') {
            let currentWS = global.workspace_manager.get_active_workspace().index();
            this._tempFilterMode = this.APP_FILTER_MODE;
            appList = appList.filter(a => {
                if (a.get_n_windows())
                    a.cachedWindows = this._getCustomWindowList().filter(
                        w => windowTracker.get_window_app(w) === a);
                else
                    a.cachedWindows = [];
                // filter out non fav apps w/o windows
                return a.cachedWindows.length > 0 || favoritesFull.indexOf(a.get_id()) > -1;
            });
        } else {
            appList.forEach(
                a => {
                    if (a.get_n_windows())
                        a.cachedWindows = this._getCustomWindowList().filter(
                            w => windowTracker.get_window_app(w) === a);
                    else
                        a.cachedWindows = [];
                }
            );
        }

        if (appList.length)
            this._showingApps = true;

        return appList;
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

    _shouldReverse() {
        if (this.KEYBOARD_TRIGGERED || !this.REVERSE_AUTO)
            return false;
        if (this._reverseOrder)
            return true;

        let geometry = global.display.get_monitor_geometry(this._monitorIndex);
        let mousePointerX = global.get_pointer()[0];
        let diff = geometry.x + geometry.width - mousePointerX
        let reverse = diff < 100;
        this._reverseOrder = reverse;
        return reverse;
    }
});
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var WindowIcon = GObject.registerClass(
class WindowIcon extends St.BoxLayout {
    _init(item, iconIndex, switcherParams) {
        super._init({
            style_class: 'thumbnail-box',
            vertical: true,
            reactive: true,
        });
        this._switcherParams = switcherParams;
        this._icon = new St.Widget({layout_manager: new Clutter.BinLayout()});

        this.add_child(this._icon);
        this._icon.destroy_all_children();

        if (item.get_title)
            this._createWindowIcon(item);

        if ( this._switcherParams.hotKeys && iconIndex < 12)
            this._icon.add_actor(_createHotKeyNumIcon(iconIndex));

        if (this.titleLabel && this._switcherParams.showTitles) {
            this.add_child(this.titleLabel);
        }
    }

    _createWindowIcon(window) {
        this.is_window = true;

        this.window = window;

        this.titleLabel = new St.Label({
            text: window.get_title(),
            x_align: Clutter.ActorAlign.CENTER,
        });

        let tracker = Shell.WindowTracker.get_default();
        this.app = tracker.get_window_app(window);

        let mutterWindow = this.window.get_compositor_private();

        let scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;

        let switched = false;
        let size, cloneSize;

        size = this._switcherParams.winPrevSize;
        cloneSize = size;

        if (!this._switcherParams.singleAppMode && this._switcherParams.appIconSize > size) {
            size = this._switcherParams.appIconSize;
            switched = true;
            cloneSize = Math.floor((mutterWindow.width / mutterWindow.height) * this._switcherParams.winPrevSize);
        }

        let clone = AltTab._createWindowClone(mutterWindow, cloneSize * scaleFactor);
        let icon;
        if (this.app) {
            icon = this._createAppIcon(this.app,
                this._switcherParams.appIconSize);
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

        if (this._switcherParams.wsIndexes)
            this._icon.add_actor(this._createWsIcon(window.get_workspace().index() + 1));

        if (this.window.is_on_all_workspaces())
            this._icon.add_actor(this._createStickyIcon());

        this._icon.set_size(size * scaleFactor, size * scaleFactor);
    }

    _alignFront(icon, isWindow = true) {
        icon.x_align = icon.y_align = Clutter.ActorAlign.END;
        if (isWindow && this.window.is_above())
            icon.y_align = Clutter.ActorAlign.START;
    }

    _createAppIcon(app, size) {
        let appIcon = app
            ? app.create_icon_texture(size)
            : new St.Icon({icon_name: 'icon-missing', icon_size: size});
        appIcon.x_expand = appIcon.y_expand = true;
        return appIcon;
    }

    _createWsIcon(index) {
        let currentWS = global.workspace_manager.get_active_workspace().index();
        let icon = new St.Widget({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.END,
        });

        let label = new St.Label({
            text: index.toString(),
            style_class: currentWS + 1 === index ? 'workspace-index-highlight' : 'workspace-index',
        });
        icon.add_actor(label);
        return icon;
    }

    _createStickyIcon() {
        let icon = new St.Widget({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.START,
        });
        let iconF = new St.Icon({
            style_class: 'workspace-index',
            icon_name: 'view-pin-symbolic',
            icon_size: 16,
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        icon.add_actor(iconF);
        return icon;
    }
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var AppIcon = GObject.registerClass(
class AppIcon extends Dash.DashIcon {
    _init(app, iconIndex, switcherParams) {
        super._init(app);
        this._switcherParams = switcherParams;
        this.titleLabel = new St.Label({text: app.get_name()});
        // disable original app icon style
        this.style_class = '';
        this._iconContainer.remove_child(this._dot);

        const c = app.cachedWindows.length;
        if (c)
            this._iconContainer.add_child(this._createRunningIndicator(c));

        if (this._switcherParams.hotKeys && iconIndex < 12)
            this._iconContainer.add_child(_createHotKeyNumIcon(iconIndex));
    }

    // this is override of original function to adjust icon size
    _createIcon() {
        return this.app.create_icon_texture(this._switcherParams.appModeIconSize);
    }

    _createRunningIndicator(num) {
        let icon = new St.Widget({
            x_expand: true,
            y_expand: true,
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
        });

        let label = new St.Label({
            text: num.toString(),
            style_class: 'workspace-index',
        });
        icon.add_actor(label);

        return icon;
    }

    vfunc_button_press_event(buttonEvent) {
        return Clutter.EVENT_PROPAGATE;
    }

    /*_showWindow(win) {
        let a = win.above;
        win.make_above();
        a ? win.make_above() : win.unmake_above();
        Main.wm.actionMoveWorkspace(win.get_workspace());
    }*/
});
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
var WindowSwitcher = GObject.registerClass(
class WindowSwitcher extends AltTab.SwitcherPopup.SwitcherList {
    _init(items, switcherParams) {
        let squareItems = false;
        super._init(squareItems);
        this._switcherParams = switcherParams;
        this._statusLabel = new St.Label({
            x_align: Clutter.ActorAlign.START,
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'status-label',
        });
        this._statusLabel.set_text('Filter: Order:'); // this text will be replaced immediately
        if (this._switcherParams.status)
            this.add_actor(this._statusLabel);
        this._label = new St.Label({
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.add_actor(this._label);

        // this line belongs to the original code but this.windows was unused...
        //this.windows = items;

        this.icons = [];

        for (let i = 0; i < items.length; i++) {
            let item = items[i];
            let icon;
            if (item.get_title) {
                icon = new WindowIcon(item, i, this._switcherParams);
            } else {
                icon = new AppIcon(item, i, this._switcherParams);
                icon.connect('menu-state-changed',
                    (o, open) => {
                        _cancelTimeout = open;
                    });
            }

            this.addItem(icon, icon.titleLabel);
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

        let multiplier = 0;
        multiplier += this._switcherParams.status ? 1 : 0;
        multiplier += this._switcherParams.labelTitle ? 1 : 0;
        minHeight += multiplier * labelMin + spacing;
        natHeight += multiplier * labelNat + spacing;

        return [minHeight, natHeight];
    }

    vfunc_allocate(box, flags) {
        let themeNode = this.get_theme_node();
        let contentBox = themeNode.get_content_box(box);
        const spacing = themeNode.get_padding(St.Side.BOTTOM) - (this._switcherParams.labelTitle ? 4 : 0); // -4 to move label 2px up
        const labelHeight = this._switcherParams.labelTitle ? this._label.height : 0;
        const labelHeightStatus = this._switcherParams.status ? this._statusLabel.height : 0;
        const totalLabelHeight =
            labelHeightStatus + labelHeight + spacing;

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
        childBox.y2 = contentBox.y2 - labelHeightStatus + spacing;
        childBox.y1 = childBox.y2 - labelHeight - labelHeightStatus;
        if (this._switcherParams.labelTitle) {
            GNOME40 ? this._label.allocate(childBox)
                    : this._label.allocate(childBox, flags);
        }
        const childBoxStatus = new Clutter.ActorBox();
        childBoxStatus.x1 = contentBox.x1;
        childBoxStatus.x2 = contentBox.x2;
        childBoxStatus.y2 = contentBox.y2;
        childBoxStatus.y1 = childBoxStatus.y2 - labelHeightStatus;
        if (this._switcherParams.status) {
            GNOME40 ? this._statusLabel.allocate(childBoxStatus)
                    : this._statusLabel.allocate(childBoxStatus, flags);
        }
    }

    highlight(index, justOutline) {
        super.highlight(index, justOutline);
        this._label.set_text(index == -1 ? '' : this.icons[index].titleLabel.text);
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
    _init(switcherParams) {
        super._init(switcherParams);
        this._switcherMode = SwitcherMode.APPS;
        this.SHOW_APPS = true;
    }
});

// icon indicating direct activation key
function _createHotKeyNumIcon(index) {
    let icon = new St.Widget({
        x_expand: true,
        y_expand: true,
        x_align: Clutter.ActorAlign.START,
        y_align: Clutter.ActorAlign.START,
    });

    let box = new St.BoxLayout({
        style_class: 'hot-key-number',
        vertical: true,
    });

    icon.add_actor(box);
    let label = new St.Label({text: `F${(index + 1).toString()}`});
    box.add(label);

    return icon;
}

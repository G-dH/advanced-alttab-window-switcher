/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * WindowSwitcherPopup
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2023
 * @license    GPL-3.0
 */

'use strict';

const { GObject, GLib, St, Shell, Gdk, Meta, Clutter } = imports.gi;

const Main            = imports.ui.main;
const AltTab          = imports.ui.altTab;
const SwitcherPopup   = imports.ui.switcherPopup;
const AppDisplay      = imports.ui.appDisplay;
const Dash            = imports.ui.dash;
const PopupMenu       = imports.ui.popupMenu;
const Keyboard        = imports.ui.status.keyboard;
const WorkspaceThumbnail = imports.ui.workspaceThumbnail;

const ExtensionUtils  = imports.misc.extensionUtils;
const Me              = ExtensionUtils.getCurrentExtension();

const SwitcherList    = Me.imports.src.switcherList.SwitcherList;
const AppSwitcher     = Me.imports.src.switcherList.AppSwitcher;
const AppIcon         = Me.imports.src.switcherItems.AppIcon;
const WindowIcon      = Me.imports.src.switcherItems.WindowIcon;
const CaptionLabel    = Me.imports.src.captionLabel.CaptionLabel;
const WindowMenu      = Me.imports.src.windowMenu;
const Settings        = Me.imports.src.settings;
const ActionLib       = Me.imports.src.actions;

// gettext
const _               = Settings._;

const shellVersion    = parseFloat(imports.misc.config.PACKAGE_VERSION);

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
    TOP: 1,
    CENTER: 2,
    BOTTOM: 3,
};

const SortingMode = {
    MRU: 1,
    STABLE_SEQUENCE: 2,
    STABLE_CURRENT_FIRST: 3,
};

const SortingModeLabel = ['',
    _('MRU'),
    _('STABLE'),
    _('STABLE - current 1.')];

const GroupMode = {
    NONE: 1,
    CURRENT_MON_FIRST: 2,
    APPS: 3,
    WORKSPACES: 4,
};

const GroupModeLabel = ['',
    _('NONE'),
    _('MON FIRST'),
    _('APPS'),
    _('WS')];

const SelectMode = {
    NONE: -1,
    FIRST: 0,
    SECOND: 1,
    ACTIVE: 2,
};

const PreviewMode = {
    DISABLE: 1,
    PREVIEW: 2,
    SHOW_WIN: 3,
};

const UpDownAction = {
    DISABLE: 1,
    SWITCH_WS: 2,
    SINGLE_APP: 3,
    SINGLE_AND_SWITCHER: 4,
};

const DoubleSuperAction = {
    DEFAULT: 1,
    SWITCHER_MODE: 2,
    OVERVIEW: 3,
    APP_GRID: 4,
    PREV_WIN: 5,
};

const TooltipTitleMode = {
    DISABLE: 1,
    ITEM: 2,
    CENTER: 3,
};

var ANIMATION_TIME = 200;

const Action = Settings.Actions;

const SCROLL_TIMEOUT = 200;
const SCROLL_SELECTION_TIMEOUT = 20;

function primaryModifier(mask) {
    if (mask === 0)
        return 0;

    let primary = 1;
    while (mask > 1) {
        mask >>= 1;
        primary <<= 1;
    }
    return primary;
}

function _shiftPressed(state) {
    if (state === undefined)
        state = global.get_pointer()[2];

    return state & Clutter.ModifierType.SHIFT_MASK;
}

function _ctrlPressed(state) {
    if (state === undefined)
        state = global.get_pointer()[2];

    return state & Clutter.ModifierType.CONTROL_MASK;
}

function _superPressed() {
    return global.get_pointer()[2] & Clutter.ModifierType.SUPER_MASK;
}

function _isTabAction(action) {
    return [
        Meta.KeyBindingAction.SWITCH_WINDOWS,
        Meta.KeyBindingAction.SWITCH_APPLICATIONS,
    ].includes(action);
}

function _isTabBackwardAction(action) {
    return [
        Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD,
        Meta.KeyBindingAction.SWITCH_APPLICATIONS_BACKWARD,
    ].includes(action);
}

function _getWindowApp(metaWindow) {
    let tracker = Shell.WindowTracker.get_default();
    return tracker.get_window_app(metaWindow);
}

function _getRunningAppsIds(stableSequence = false) {
    let running = [];
    if (stableSequence) {
        let winList = _getWindows(null);
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

function _getWindows(workspace, modals = false) {
    // We ignore skip-taskbar windows in switchers, but if they are attached
    // to their parent, their position in the MRU list may be more appropriate
    // than the parent; so start with the complete list ...
    let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL,
        workspace);
    // ... map windows to their parent where appropriate, or leave it if the user wants to list modal windows too...
    return windows.map(w => {
        return w.is_attached_dialog() && !modals ? w.get_transient_for() : w;
    // ... and filter out skip-taskbar windows and duplicates
    // ... (if modal windows (attached_dialogs) haven't been removed in map function, leave them in the list)
    }).filter((w, i, a) => (!w.skip_taskbar && a.indexOf(w) === i) || w.is_attached_dialog());
}


var   WindowSwitcherPopup = GObject.registerClass(
class WindowSwitcherPopup extends SwitcherPopup.SwitcherPopup {
    _init() {
        this._initTime = Date.now();
        super._init();
        this._actions              = null;
        // Global options
        // filter out all modifiers except Shift|Ctrl|Alt|Super and get those used in the shortcut that triggered this popup
        this._modifierMask         = global.get_pointer()[2] & 77; // 77 covers Shift|Ctrl|Alt|Super
        this._keyBind              = ''; // can be set by the external trigger which provides the keyboard shortcut

        // options variable is set from extension.js when the extension is enabled

        this.CHCE_TRIGGERED        = false; // can be set to true from CHC-E extension
        this.KEYBOARD_TRIGGERED    = true; // can be set to false if mouse was used to trigger AATWS
        this.PREVIEW_SELECTED      = options.get('switcherPopupPreviewSelected');
        this.SEARCH_DEFAULT        = options.get('switcherPopupStartSearch');
        this.POSITION_POINTER      = options.POSITION_POINTER;

        this.POPUP_POSITION        = options.POPUP_POSITION;
        // default gaps between switcher and top/bottom screen edge
        this.TOP_MARGIN            = 6;
        this.BOTTOM_MARGIN         = 6;
        // current screen scale factor that also affects margins
        const { scaleFactor } = St.ThemeContext.get_for_stage(global.stage);
        this.SCALE_FACTOR          = scaleFactor;

        // Window switcher
        this.WIN_FILTER_MODE       = options.get('winSwitcherPopupFilter');
        this.GROUP_MODE            = options.get('winSwitcherPopupOrder');
        this.WIN_SORTING_MODE      = options.get('winSwitcherPopupSorting');

        // App switcher
        this.APP_FILTER_MODE       = options.get('appSwitcherPopupFilter');
        this.APP_SORTING_MODE      = options.get('appSwitcherPopupSorting');
        this.SORT_FAVORITES_BY_MRU = options.get('appSwitcherPopupFavMru');

        this.INCLUDE_FAVORITES     = options.get('appSwitcherPopupFavoriteApps');

        // Runtime variables
        switch (options.get('switcherPopupMonitor')) {
        case 1: this._monitorIndex = global.display.get_primary_monitor();
            break;
        case 2: this._monitorIndex = this._getCurrentMonitorIndex();
            break;
        case 3: this._monitorIndex = global.display.get_current_monitor();
            break;
        default: this._monitorIndex = global.display.get_primary_monitor();
        }

        this.SHOW_APPS = false;

        if (this.SEARCH_DEFAULT)
            this._searchEntry = '';
        else
            this._searchEntry = null;

        this._defaultGrouping      = this.GROUP_MODE; // remember default sorting
        this._initialSelectionMode = this.WIN_SORTING_MODE === SortingMode.STABLE_SEQUENCE ? SelectMode.ACTIVE : SelectMode.SECOND;
        this._switcherMode         = SwitcherMode.WINDOWS;
        this._singleApp            = null;

        this._selectedIndex        = -1;    // deselect
        this._tempFilterMode       = null;
        this._firstRun             = true;
        this._favoritesMRU         = true;
        this._lastActionTimeStamp  = 0;
        this._updateInProgress     = false;
        // _skipInitialSelection allows to avoid double selection when re-showing switcher followed by custom selection
        this._skipInitialSelection = false;
        options.cancelTimeout      = false;

        global.advancedWindowSwitcher = this;

        this._wsManagerConId = global.workspace_manager.connect('workspace-switched', this._onWorkspaceChanged.bind(this));
        this._newWindowConId = 0;

        this._timeoutIds = {};
    }

    _onWorkspaceChanged() {
        if (!this._doNotUpdateOnNewWindow)
            this._updateOnWorkspaceSwitched();
    }

    _updateOnWorkspaceSwitched(callback) {
        if (this._timeoutIds.wsSwitcherAnimationDelayId)
            GLib.source_remove(this._timeoutIds.wsSwitcherAnimationDelayId);


        this._timeoutIds.wsSwitcherAnimationDelayId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            // re-build the switcher after workspace switcher animation to avoid stuttering
            250 * St.Settings.get().slow_down_factor,
            () => {
                this.WIN_FILTER_MODE = options.WIN_FILTER_MODE;
                this.show();
                if (callback)
                    callback();

                this._timeoutIds.wsSwitcherAnimationDelayId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _pushModal() {
        let result = true;
        if (shellVersion >= 42) {
            let grab = Main.pushModal(this);
            // We expect at least a keyboard grab here
            if ((grab.get_seat_state() & Clutter.GrabState.KEYBOARD) === 0) {
                Main.popModal(grab);
                result = false;
            }
            this._grab = grab;
            this._haveModal = true;
        } else if (!Main.pushModal(this)) {
            if (!Main.pushModal(this, { options: Meta.ModalOptions.POINTER_ALREADY_GRABBED }))
                result = false;
        }

        this._haveModal = result;
        return result;
    }

    show(backward, binding, mask) {
        if (this._updateInProgress)
            return false;
        this._updateInProgress = true;

        if (this._firstRun && !this._pushModal()) {
            // workarounds releasing already grabbed input on X11
            const focusWin = global.display.get_focus_window();
            // calling focus() can release the input of full-screen VBox machine with control panel
            if (focusWin)
                focusWin.focus(global.get_current_time());
            if (!this._pushModal()) {
                // steal the input first and try to pushModal later
                global.stage.set_key_focus(this);

                this._timeoutIds.pushModal = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    // delay cannot be too short
                    // if system is busy, pushModal may fail again
                    200,
                    () => {
                        if (!this._pushModal()) {
                            log(`[${Me.metadata.uuid}] Error: Unable to grab input, AATWS cannot start.`);
                            this.destroy();
                        }

                        this._timeoutIds.pushModal = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            }
        }

        // if only one monitor is connected, then filter MONITOR is redundant to WORKSPACE, therefore MONITOR mode will be ignored
        if (Main.layoutManager.monitors.length < 2) {
            if (this.WIN_FILTER_MODE === FilterMode.MONITOR)
                this.WIN_FILTER_MODE = FilterMode.WORKSPACE;


            if (this.APP_FILTER_MODE === FilterMode.MONITOR)
                this.APP_FILTER_MODE = FilterMode.WORKSPACE;
        }

        // set filter for both switchers to the value of the currently activated switcher if requested
        if (this._firstRun && options.SYNC_FILTER) {
            if (this._switcherMode === SwitcherMode.APPS)
                this.WIN_FILTER_MODE = this.APP_FILTER_MODE;
            else
                this.APP_FILTER_MODE = this.WIN_FILTER_MODE;
        }

        // you can have different setting for switcher triggered ba kbd and mouse, but both should be switchable on the fly using a hotkey
        this.INCLUDE_FAVORITES = this.KEYBOARD_TRIGGERED || !this._firstRun ? this.INCLUDE_FAVORITES : options.INCLUDE_FAV_MOUSE;

        if (binding === 'switch-group' || binding === 'switch-group-backward') {
            this._switchGroupInit = true;
            let id, name;
            // let metaWin = global.display.get_tab_list(Meta.WindowType.NORMAL, null)[0];
            const metaWin = _getWindows(null)[0];
            if (metaWin) {
                const app = _getWindowApp(metaWin);
                id = app.get_id();
                name = app.get_name();
            }
            if (id) {
                this._singleApp = [id, name];
                this.SHOW_APPS = false;
            } else {
                this._singleApp = null;
            }
        }

        this.showHotKeys = this.KEYBOARD_TRIGGERED;

        if (!this._pointer) {
            this._pointer = [];
            [this._pointer.x, this._pointer.y] = global.get_pointer();
        }

        if (this._tempFilterMode)
            this._tempFilterMode = null;


        let itemList = this._getItemList();

        if (!itemList.length && this._searchEntryNotEmpty()) {
            // no results -> back to the last successful pattern
            this._searchEntry = this._searchEntry.slice(0, -1);
            this._tempFilterMode = null;
            itemList = this._getItemList();
        }

        if (itemList.length > 0) {
            if (this._shouldReverse())
                itemList.reverse();

            // avoid immediate switch to recent window when Show Win Preview mode is active
            if (this.PREVIEW_SELECTED === PreviewMode.SHOW_WIN && !this._showingApps && !this.KEYBOARD_TRIGGERED && this.WIN_SORTING_MODE === SortingMode.MRU)
                this._initialSelectionMode = SelectMode.FIRST;


            let showWinTitles = options.WINDOW_TITLES === 1 || (options.WINDOW_TITLES === 3 && this._singleApp);
            let switcherParams = {
                mouseControl: !this.KEYBOARD_TRIGGERED,
                showingApps: this._showingApps,
                showItemTitle: this._showingApps ? options.SHOW_APP_TITLES : showWinTitles,
                showWinTitles,
                winPrevSize: this._singleApp ? options.SINGLE_APP_PREVIEW_SIZE : options.WINDOW_PREVIEW_SIZE,
                hotKeys: options.HOT_KEYS && this.KEYBOARD_TRIGGERED,
                singleApp: this._singleApp,
                addAppDetails: this._searchEntryNotEmpty(),
                includeFavorites: this.INCLUDE_FAVORITES,
                searchActive: this._searchEntryNotEmpty(),
                reverseOrder: this._shouldReverse(),
            };

            if (this._switcherList) {
                this._switcherList.destroy();
                this._switcherList = null;
            }

            this._switcherList = new SwitcherList(itemList, options, switcherParams);
            this._connectShowAppsIcon();

            if (!options.HOVER_SELECT && this.KEYBOARD_TRIGGERED)
                this._switcherList._itemEntered = function () {};


            this._items = this._switcherList.icons;
            this._connectIcons();
            this._showPopup(backward, binding, mask);
        } else {
            return false;
        }

        this._tempFilterMode = null;
        if (!this._newWindowConId)
            this._connectNewWindows();


        this._updateInProgress = false;
        return true;
    }

    _showPopup(backward, binding, mask) {
        if (this._items.length === 0)
            return false;

        this._alreadyShowed = true;

        this.add_child(this._switcherList);
        this._switcherList.connect('item-activated', this._itemActivated.bind(this));
        this._switcherList.connect('item-entered', this._itemEntered.bind(this));
        this._switcherList.connect('item-removed', this._itemRemoved.bind(this));
        // Need to force an allocation so we can figure out whether we
        // need to scroll when selecting
        this.visible = true;
        this.opacity = 0;

        this.get_allocation_box();

        if (options.colorStyle.SWITCHER_LIST)
            this._switcherList.add_style_class_name(options.colorStyle.SWITCHER_LIST);

        // if switcher switches the filter mode, color the popup border to indicate current filter - red for MONITOR, orange for WS, green for ALL
        if (this._filterSwitched && !options.STATUS && !(this._showingApps && this._searchEntryNotEmpty())) {
            let fm = this._showingApps ? this.APP_FILTER_MODE : this.WIN_FILTER_MODE;
            fm = this._tempFilterMode ? this._tempFilterMode : fm;

            if (fm === FilterMode.MONITOR || (fm === FilterMode.WORKSPACE && (Main.layoutManager.monitors.length < 2)))
                this._switcherList.add_style_class_name('switcher-list-monitor');
            else if (fm === FilterMode.WORKSPACE)
                this._switcherList.add_style_class_name('switcher-list-workspace');
            else if (fm === FilterMode.ALL)
                this._switcherList.add_style_class_name('switcher-list-all');
        }

        // scrolling by overshooting mouse pointer over left/right edge doesn't work in gnome 40+, so this is my implementation
        if (shellVersion >= 40 && this._switcherList._scrollableLeft || this._switcherList._scrollableRight) {
            const activeWidth = 5;
            this._switcherList.reactive = true;
            this._switcherList.connect('motion-event', () => {
                if (this._switcherList._scrollView.hscroll.adjustment.get_transition('value'))
                    return;

                const pointerX = global.get_pointer()[0];

                if (this._switcherList._scrollableRight && this._selectedIndex < (this._items.length - 1) && pointerX > (this._switcherList.allocation.x2 - activeWidth))
                    this._select(this._next(true));
                else if (this._switcherList._scrollableLeft && this._selectedIndex > 0 && pointerX < (this._switcherList.allocation.x1 + activeWidth))
                    this._select(this._previous(true));
            });
        }

        this._switcherList._rightArrow.add_style_class_name(options.colorStyle.ARROW);
        this._switcherList._leftArrow.add_style_class_name(options.colorStyle.ARROW);

        const themeNode = this._switcherList.get_theme_node();
        const padding = Math.round(themeNode.get_padding(St.Side.BOTTOM) / 2 / this.SCALE_FACTOR);

        if (this._firstRun) {
            if (this.CHCE_TRIGGERED && this.POSITION_POINTER && !this.KEYBOARD_TRIGGERED) {
                this.TOP_MARGIN = 2;
                this.BOTTOM_MARGIN = 2;
            } else if (this.POPUP_POSITION === Position.TOP) {
                this.TOP_MARGIN = Math.round(Main.panel.height / this.SCALE_FACTOR + 4);
            }
        }

        this._switcherList.set_style(`margin-top: ${this.TOP_MARGIN}px; margin-bottom: ${this.BOTTOM_MARGIN}px; padding-bottom: ${padding}px;`);

        if (this._searchEntryNotEmpty())
            this._initialSelectionMode = SelectMode.FIRST;


        if (this._firstRun || this._searchEntry !== null)
            this._initialSelection(backward, binding);

        if (!this._searchEntryNotEmpty() && this._initialSelectionMode === SelectMode.NONE)
            this._initialSelectionMode = SelectMode.ACTIVE;


        // There's a race condition; if the user released Alt before
        // we got the grab, then we won't be notified. (See
        // https://bugzilla.gnome.org/show_bug.cgi?id=596695 for
        // details.) So we check now. (Have to do this after updating
        // selection.)
        if (mask !== undefined)
            this._modifierMask = primaryModifier(mask);

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

        // avoid showing overlay label before the switcher popup
        if (this._firstRun && this._itemCaption)
            this._itemCaption.opacity = 0;


        // We delay showing the popup so that fast Alt+Tab users aren't
        // disturbed by the popup briefly flashing.
        // but not when we're just overriding already shown content
        if (this._firstRun) {
            // timeout in which click on the switcher background acts as 'activate' despite configuration
            // for quick switch to recent window when triggered using mouse and top/bottom popup position
            this._recentSwitchTime = Date.now() + 300;
            // the initial delay needs to include the time spent so far
            const delay = Math.max(0, options.INITIAL_DELAY - (Date.now() - this._initTime));
            this._initialDelayTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_HIGH,
                this.KEYBOARD_TRIGGERED && !this._overlayKeyTriggered ? delay : 0,
                () => {
                    if (!this._doNotShowImmediately) {
                        if (this.KEYBOARD_TRIGGERED) {
                            if (this._itemCaption)
                                this._itemCaption.opacity = 255;
                            this.opacity = 255;
                            this._timeoutIds.setInputDelay = GLib.timeout_add(
                                GLib.PRIORITY_DEFAULT,
                                20,
                                () => {
                                    this._setInput();
                                    this._timeoutIds.setInputDelay = 0;
                                }
                            );
                        } else {
                            this._shadeIn();
                        }
                        Main.osdWindowManager.hideAll();
                        // build ws thumbnails if enabled
                        this._showWsThumbnails();
                        if (this._wsTmb) {
                            this._wsTmb.opacity = 0;
                            this._wsTmb.ease({
                                opacity: 255,
                                duration: ANIMATION_TIME / 2,
                                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                            });
                        }
                    }

                    this._initialDelayTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }
            );

            GLib.Source.set_name_by_id(this._initialDelayTimeoutId, '[gnome-shell] Main.osdWindow.cancel');
        } else {
            this.opacity = 255;
            if (this._searchEntryNotEmpty())
                this._showSearchCaption(this._searchEntry);
            else if (this._searchEntry === '' && this._searchCaption)
                this._searchCaption.hide();
        }

        this._resetNoModsTimeout();
        Main.osdWindowManager.hideAll();

        if (this._searchEntry === '' && !this.SEARCH_DEFAULT)
            this._showSearchCaption('Type to search...');


        if (this._overlayKeyTriggered && options.get('enableSuper')) {
            // do this only for the first run
            this._overlayKeyTriggered = false;
            const _overlaySettings = ExtensionUtils.getSettings('org.gnome.mutter');
            this._originalOverlayKey = _overlaySettings.get_string('overlay-key');
            _overlaySettings.set_string('overlay-key', '');

            this._timeoutIds.overlayKeyInit = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                500,
                () => {
                    this._timeoutIds.overlayKeyInit = 0;
                    return GLib.SOURCE_REMOVE;
                }
            );
        }

        this._firstRun = false;
        this._setSwitcherStatus();
        return true;
    }

    _connectShowAppsIcon() {
        const showAppsIcon = this._switcherList._showAppsIcon;
        if (!showAppsIcon)
            return;

        showAppsIcon.connect('button-press-event', (a, event) => {
            const btn = event.get_button();
            if (btn === Clutter.BUTTON_SECONDARY) {
                Main.overview.toggle();
                return Clutter.EVENT_STOP;
            } else if (btn === Clutter.BUTTON_MIDDLE) {
                new Me.imports.actions.Actions().openPrefsWindow();
                return Clutter.EVENT_STOP;
            }
            return Clutter.EVENT_PROPAGATE;
        });
    }

    _onDestroy() {
        this._doNotUpdateOnNewWindow = true;

        this._popModal();

        // remove original timeouts
        if (this._motionTimeoutId)
            GLib.source_remove(this._motionTimeoutId);
        if (this._initialDelayTimeoutId)
            GLib.source_remove(this._initialDelayTimeoutId);
        if (this._noModsTimeoutId)
            GLib.source_remove(this._noModsTimeoutId);

        // Make sure the SwitcherList is always destroyed, it may not be
        // a child of the actor at this point.
        if (this._switcherList)
            this._switcherList.destroy();

        // remove all local timeouts
        Object.values(this._timeoutIds).forEach(id => {
            if (id)
                GLib.source_remove(id);
        });

        if (this._wsManagerConId)
            global.workspace_manager.disconnect(this._wsManagerConId);


        if (this._newWindowConId)
            global.display.disconnect(this._newWindowConId);

        this._removeCaptions();

        if (this._actions) {
            this._actions.clean();
            this._actions = null;
        }

        this._destroyWinPreview();

        if (this._originalOverlayKey) {
            const _overlaySettings = ExtensionUtils.getSettings('org.gnome.mutter');
            _overlaySettings.set_string('overlay-key', this._originalOverlayKey);
        }

        if (this._wsTmb) {
            this.remove_child(this._wsTmb);
            this._wsTmb = null;
        }

        global.advancedWindowSwitcher = null;
    }

    _destroyWinPreview() {
        if (this._winPreview) {
            this._winPreview.destroy();
            this._winPreview = null;
        }
    }

    _removeCaptions() {
        if (this._itemCaption) {
            this._itemCaption.destroy();
            this._itemCaption = null;
        }

        if (this._searchCaption) {
            this._searchCaption.destroy();
            this._searchCaption = null;
        }
    }

    _itemRemoved(switcher, n) {
        // n is -1 when this._showingApps
        if (n === -1)
            this._delayedUpdate(200);
        else
            this._itemRemovedHandler(n);
    }

    _itemRemovedHandler(n) {
        if (this._items.length > 0) {
            let newIndex;

            if (n < this._selectedIndex)
                newIndex = this._selectedIndex - 1;
            else if (n === this._selectedIndex)
                newIndex = Math.min(n, this._items.length - 1);
            else if (n > this._selectedIndex)
                return; // No need to select something new in this case
            this._selectedIndex = -1;
            this._select(newIndex);
        } else {
            // if switcher is empty, try to repopulate it.
            this._switcherDestroyedOnLastWinClosed = true;
            this.show();
        }
    }

    _itemEntered(switcher, n) {
        if (!this.mouseActive)
            return;
        const item = this._items[n];
        // avoid unnecessary reentrance, reenter only when close button needs to be displayed
        if (!(this._selectedIndex === n && (item._closeButton && item._closeButton.opacity === 255)) ||
             (this._selectedIndex === n && !item._closeButton))
            this._itemEnteredHandler(n);
        this._updateMouseControls();
    }

    vfunc_allocate(box, flags) {
        let monitor = this._getMonitorByIndex(this._monitorIndex);
        // no flags in GS 40+
        const useFlags = flags !== undefined;
        if (shellVersion >= 40)
            box.set_size(monitor.width, monitor.height);

        if (useFlags)
            this.set_allocation(box, flags);
        else
            this.set_allocation(box);
        let childBox = new Clutter.ActorBox();
        // Allocate the switcherList
        // We select a size based on an icon size that does not overflow the screen
        let [, childNaturalHeight] = this._switcherList.get_preferred_height(monitor.width);
        let [, childNaturalWidth] = this._switcherList.get_preferred_width(childNaturalHeight);
        let x;

        if (this._switcherAppPos && !this._showingApps) {
            // if single app view was triggered from the app switcher, align the window switcher to selected app
            x = Math.max(this._switcherAppPos - childNaturalWidth / 2, monitor.x);
            x = Math.min(x, monitor.x + monitor.width - childNaturalWidth);
            x = Math.max(x, monitor.x);
        }

        if (this.CHCE_TRIGGERED && this.POSITION_POINTER && !this.KEYBOARD_TRIGGERED) {
            if (x === undefined)
                x = Math.min(this._pointer.x, monitor.x + monitor.width - childNaturalWidth);
            childBox.x1 = x;
            if (childBox.x1 < monitor.x)
                childBox.x1 = monitor.x;
            childBox.y1 = Math.min(Math.max(this._pointer.y - (childNaturalHeight / 2), monitor.y), monitor.y + monitor.height - childNaturalHeight);
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

        if (useFlags)
            this._switcherList.allocate(childBox, flags);
        else
            this._switcherList.allocate(childBox);

        if (this._wsTmb) {
            const SIZE = 110;
            const wsTmb = this._wsTmb;

            let height = SIZE;
            let width;
            if (wsTmb.get_preferred_custom_width) {
                // custom function of Vertical Workspaces extension
                [, width] = wsTmb.get_preferred_custom_width(height);
            } else {
                // in default GS this sets the size same as in the overview
                [, width] = wsTmb.get_preferred_width(height * 2);
                [, height] = wsTmb.get_preferred_height(width);
            }


            width = Math.min(width, monitor.width);

            let x = monitor.x + (monitor.width - width) / 2;
            let y;
            const yOffset = options.ITEM_CAPTIONS > 1 ? 60 : 20;
            if (this.POPUP_POSITION === Position.BOTTOM)
                y = this._switcherList.allocation.y1 - height - yOffset;
            else if (this.POPUP_POSITION === Position.TOP || this.POPUP_POSITION === Position.CENTER)
                y = this._switcherList.allocation.y2 + yOffset;


            childBox.set_origin(x, y);
            childBox.set_size(width, height);

            if (useFlags)
                wsTmb.allocate(childBox, flags);
            else
                wsTmb.allocate(childBox);
        }

        if (this._itemCaption) {
            this._setCaptionAllocationBox(this._itemCaption, childBox, monitor);
            if (useFlags)
                this._itemCaption.allocate(childBox, flags);
            else
                this._itemCaption.allocate(childBox);
        }

        if (this._searchCaption) {
            this._setCaptionAllocationBox(this._searchCaption, childBox, monitor);
            if (useFlags)
                this._searchCaption.allocate(childBox, flags);
            else
                this._searchCaption.allocate(childBox);
        }
    }

    _setCaptionAllocationBox(caption, childBox, monitor) {
        let index = this._selectedIndex;
        // get item position on the screen and calculate center position of the label
        let actor, xPos;
        if (options.ITEM_CAPTIONS === 2 && caption === this._itemCaption)
            actor = this._items[index];
        else
            actor = this._switcherList;


        if (actor) {
            [xPos] = actor.get_transformed_position();
            xPos = Math.floor(xPos + actor.width / 2);
        } else {
            xPos = monitor.width / 2;
        }

        let [, height] = caption.get_preferred_height(monitor.width);
        let [, width] = caption.get_preferred_width(height);
        width = Math.min(width, monitor.width);
        childBox.set_size(width, height);

        const margin = 8;
        const parent = this._switcherList;
        const yOffset = caption._yOffset;

        // win/app titles should be always placed centered to the switcher popup
        let captionCenter = xPos ? xPos : parent.allocation.x1 + parent.width / 2;

        // the +/-1 px compensates padding
        let x = Math.floor(Math.max(Math.min(captionCenter - (width / 2), monitor.x + monitor.width - width - 1), monitor.x + 1));
        let y = parent.allocation.y1 - height - yOffset - margin;

        if (y < monitor.y)
            y = parent.allocation.y2 + yOffset + margin;

        childBox.set_origin(x, y);
        return childBox;
    }

    _initialSelection(backward /* binding */) {
        if (this._skipInitialSelection) {
            this._skipInitialSelection = false;
            return;
        }
        if (this._itemCaption) {
            // this._itemCaption._destroy();
            this._itemCaption.hide();
        }

        if (this._items.length === 1 && this._switcherList) {
            this._select(0);
            return;
        }

        let reverse = this._shouldReverse();

        // if items are grouped by workspace, select next item on the current ws
        if (this.GROUP_MODE === GroupMode.WORKSPACES && !this._showingApps && this.WIN_SORTING_MODE === SortingMode.MRU) {
            const activeWs = global.workspace_manager.get_active_workspace();
            if (!reverse) {
                for (let i = 0; i < this._items.length; i++) {
                    if (this._items[i].window.get_workspace() === activeWs) {
                        let index = i;
                        if (this._initialSelectionMode === SelectMode.SECOND && index + 1 < this._items.length)
                            index = i + 1;

                        this._select(index);
                        return;
                    }
                }
            } else {
                for (let i = this._items.length - 1; i >= 0; i--) {
                    if (this._items[i].window.get_workspace() === activeWs) {
                        let index = i;
                        if (this._initialSelectionMode === SelectMode.SECOND && index > 0)
                            index = i - 1;

                        this._select(index);
                        return;
                    }
                }
            }
        }

        if (this._initialSelectionMode === SelectMode.ACTIVE) {
            this._select(this._getFocusedItemIndex());
            return;
        }

        if (backward) {
            this._select(this._items.length - 1);
            return;
        }

        // (revers && backwards) should never happen since reverse is mouse option and backward kbd only

        if (this._initialSelectionMode === SelectMode.SECOND) {
            if (!reverse) {
                this._select(1);
            } else if (reverse) {
                this._select(this._items.length - 2);
                this._switcherList._scrollToRight(this._items.length - 1);
            }
        } else if (this._initialSelectionMode === SelectMode.FIRST) {
            if (!reverse)
                this._select(0);
            else
                this._select(this._items.length - 1);
        } else if (this._initialSelectionMode === SelectMode.NONE && reverse) {
            // if reversed and list longer than display, move to the last (reversed first) item
            this._switcherList._scrollToRight(this._items.length - 1);
        }
    }

    _connectNewWindows() {
        this._newWindowConId = global.display.connect_after('window-created', (w, win) => {
            if (this._doNotUpdateOnNewWindow)
                return;

            // new window was created but maybe not realized yet, so we will wait before updating content of the switcher
            const winActor = win.get_compositor_private();
            if (!winActor.realized) {
                this._awaitingWin = win;
                const realizeId = winActor.connect('realize', () => {
                    // update switcher only if no newer window is waiting for realization
                    if (this._awaitingWin === win) {
                        this._updateSwitcher();
                        this._awaitingWin = null;
                    }
                    winActor.disconnect(realizeId);
                });
            } else {
                this._updateSwitcher();
            }
        });

        /* this._newWindowConId = global.display.connect_after('window-created', (w, win) => {
            if (this._doNotUpdateOnNewWindow || this._newWindowConId)
                return;

            // new window was created but maybe not realized yet, so we will wait before updating content of the switcher
            // delay is easier to handle than many 'realize' signal connections, if user spawn many new windows quickly
            if (this._newWindowConId) {
                GLib.source_remove(this._newWindowConId);
            }

            this._newWindowConId = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                200, () => {
                this._newWindowConId = 0;
                this._updateSwitcher();
                return;
            });
        });*/
    }

    // Set keyboard layout stored in AATWS settings if available and needed.
    // This function must be executed after the popup is displayed and reset before activation of selected window.

    // In GS 40-42 any popup window causes the currently active window lose focus, unlike in 3.3x and 43.
    // This means that AATWS is actually setting input for the active window in GS 3.3x and 43,
    // if GS is set to Set input individually for each window
    // and needs to be reset before activation of another window.
    _setInput(reset = false) {
        if (reset) {
            // reset the input only if needed
            if (this._originalSource && this._originalSource.id !== options.INPUT_SOURCE_ID)
                this._originalSource.activate(false);

            this._originalSource = null;

            return;
        }

        if (!options.REMEMBER_INPUT || !options.INPUT_SOURCE_ID)
            return;


        const inputSourceManager = Keyboard.getInputSourceManager();
        this._originalSource = inputSourceManager._currentSource;
        const inputSources = Object.values(inputSourceManager._inputSources);

        if (inputSources.length < 2)
            return;

        for (let i = 0; i < inputSources.length; i++) {
            if (inputSources[i].id === options.INPUT_SOURCE_ID) {
                inputSources[i].activate(false);
                this._activeInput = options.INPUT_SOURCE_ID;
                this._setSwitcherStatus();
                break;
            }
        }
    }

    // switch to the next keyboard layout in the list
    _switchInputSource() {
        const inputSourceManager = Keyboard.getInputSourceManager();
        const currentSource = inputSourceManager._currentSource;
        const inputSources = Object.values(inputSourceManager._inputSources);

        if (inputSources.length < 2)
            return;

        const currentIndex = inputSources.indexOf(currentSource);
        const nextIndex = (currentIndex + 1) % inputSources.length;
        const activeSource = inputSources[nextIndex];
        activeSource.activate(false);
        if (options.REMEMBER_INPUT)
            options.set('inputSourceId', activeSource.id);

        this._activeInput = activeSource.id;
        this._setSwitcherStatus();
    }

    _getItemList() {
        let itemList;

        if (this._singleApp && this._switcherDestroyedOnLastWinClosed) {
            if (this._searchEntryNotEmpty()) {
                this._searchEntry = '';
            } else {
                this._singleApp = null;
                this._switcherDestroyedOnLastWinClosed = false;
                if (this._switcherMode === SwitcherMode.APPS)
                    this.SHOW_APPS = true;
            }
        }

        if (this.SHOW_APPS) {
            itemList = this._getAppList(this._searchEntry);
            if (!itemList.length && this.APP_FILTER_MODE > 1) {
                this._tempFilterMode = FilterMode.ALL;
                itemList = this._getAppList(this._searchEntry);
            }
        } else {
            itemList = this._getCustomWindowList(this._searchEntry);
        }

        let filterSwitchAllowed = (this._searchEntry === null || this._searchEntry === '') ||
                                    (options.SEARCH_ALL && this._searchEntryNotEmpty());

        // if no window matches the searched pattern, try to switch to a less restricted filter if possible and allowed
        // even if the switcher is in app mode, try to search windows if no app matches the search pattern
        let mode = this._switcherMode === SwitcherMode.APPS ? this.WIN_FILTER_MODE : this.WIN_FILTER_MODE - 1;
        if (itemList.length === 0 &&
            (this.WIN_FILTER_MODE !== FilterMode.ALL || this._switcherMode === SwitcherMode.APPS) &&
            filterSwitchAllowed
        ) {
            for (mode; mode > 0; mode--) {
                this._tempFilterMode = mode;
                itemList = this._getCustomWindowList(this._searchEntry);
                if (itemList.length > 0) {
                    // if on empty WS/monitor ...
                    if (this._searchEntry === null || this._searchEntry === '') {
                        // ... select first item if firstRun
                        if (this._firstRun) {
                            this._initialSelectionMode = SelectMode.FIRST;
                            this._selectedIndex = 0;
                        // ... select nothing if not firstRun
                        } else {
                            this._initialSelectionMode = SelectMode.NONE;
                            this._selectedIndex = -1;
                        }
                        // set filter mode to ALL to avoid switching it back if user creates/moves any window to this empty ws
                        this.WIN_FILTER_MODE = this._tempFilterMode;
                    }
                    break;
                }
                this._filterSwitched = true;
            }
        }

        // if no windows/apps match the searched pattern and searching apps is allowed, try to find some apps instead
        if (itemList.length === 0 && options.SEARCH_APPS === true && this._searchEntryNotEmpty()) {
            itemList = this._getAppList(this._searchEntry);
            this._initialSelectionMode = SelectMode.FIRST;
        }

        // if no windows at all, show dash content to launch new app
        if (!itemList.length && !_getWindows(null).length && !this._searchEntryNotEmpty()) {
            this._switcherMode = SwitcherMode.APPS;
            this.INCLUDE_FAVORITES = true;
            this.SHOW_APPS = true;
            this._initialSelectionMode = SelectMode.FIRST;

            return this._getAppList();
        }

        return itemList;
    }

    _shadeIn() {
        /* let translation_y = 0;
        let translationWsTmb_y = 0;
        switch (this.POPUP_POSITION) {
            case 1:
                translation_y =  -this._switcherList.height - (Main.panel.height + 20) / this.SCALE_FACTOR;
                if (this._wsTmb)
                    translationWsTmb_y = -this._wsTmb.allocation.y2;
                break;
            case 3:
                translation_y =  this._switcherList.height + 20;
                translationWsTmb_y = this._wsTmb.allocation.y1;
                break;
        }
        this._switcherList.translation_y = translation_y;*/
        if (this._wsTmb) {
            // this._wsTmb.translation_y = translationWsTmb_y;
            this._wsTmb.opacity = 0;
        }
        this.opacity = 255;
        this._switcherList.opacity = 0;

        if (this._itemCaption)
            this._itemCaption.opacity = 0;


        this._inAnimation = true;
        this._switcherList.ease({
            // delay animation by the time needed for creating the popup
            // delay: 50,
            // translation_y: 0,
            opacity: 255,
            duration: ANIMATION_TIME,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                this._inAnimation = false;
                if (this._itemCaption)
                    this._itemCaption.opacity = 255;
                this._timeoutIds.setInputDelay = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    20,
                    () => {
                        this._setInput();
                        this._timeoutIds.setInputDelay = 0;
                    }
                );
            },
        });

        if (this._wsTmb) {
            this._wsTmb.ease({
                opacity: 255,
                // translation_y: 0,
                duration: ANIMATION_TIME,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            });
        }

        if (this._itemCaption) {
            this._itemCaption.ease({
                opacity: 255,
                duration: ANIMATION_TIME,
            });
        }
    }

    _shadeOut() {
        if (this._itemCaption)
            this._itemCaption.opacity = 0;


        this._popModal();

        let translation_y = 0;
        switch (this.POPUP_POSITION) {
        case 1:
            translation_y =  -this._switcherList.height - (Main.panel.height + 6) / this.SCALE_FACTOR;
            break;
        case 3:
            translation_y =  this._switcherList.height + 6;
            break;
        }

        let opacity = 255;
        if (this.POSITION_POINTER) {
            translation_y = 0;
            opacity = 0;
        }

        this._switcherList.ease({
            translation_y,
            opacity,
            duration: 100,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => this.destroy(),
        });

        if (this._wsTmb) {
            this._wsTmb.ease({
                duration: 100,
                mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                translation_y: opacity ? this._switcherList.allocation.y2 - this._wsTmb.y : 0,
                opacity,
            });
        }
    }

    fadeAndDestroy() {
        this._doNotShowImmediately = true;
        this._popModal();

        if (this._itemCaption)
            this._itemCaption.opacity = 0;

        if (this.opacity > 0) {
            if (this.KEYBOARD_TRIGGERED)
                this.destroy();
            else
                this._shadeOut();
        } else {
            this.destroy();
        }
    }

    _finish() {
        if (this._timeoutIds.showWinImmediately) {
            GLib.source_remove(this._timeoutIds.showWinImmediately);
            this._timeoutIds.showWinImmediately = 0;
        }
        this._doNotShowWin = true;
        this._doNotUpdateOnNewWindow = true;
        const selected = this._getSelectedTarget();
        if (this._showingApps && selected) {
            if ((!_shiftPressed() && !_ctrlPressed()) && !this.KEYBOARD_TRIGGERED && options.SHOW_WINS_ON_ACTIVATE &&
                    selected && selected.cachedWindows &&
                    ((selected.cachedWindows[1] && options.SHOW_WINS_ON_ACTIVATE === 2) ||
                    (options.SHOW_WINS_ON_ACTIVATE === 1 && global.display.get_tab_list(0, null).length &&
                    selected.cachedWindows[0] === global.display.get_tab_list(0, null)[0])) &&
                    selected.cachedWindows[0].get_workspace() === global.workspace_manager.get_active_workspace()
            ) {
                this._toggleSingleAppMode();
                return;
            } else if (selected.cachedWindows && selected.cachedWindows[0]) {
                if (options.APP_RAISE_FIRST_ONLY) {
                    this._setInput('reset');
                    this._activateWindow(selected.cachedWindows[0]);
                    // options.skipThisFocus = true;
                } else {
                    // following not only activates the app recent window, but also rise all other windows of the app above other windows
                    // but if item is activated without key/button press (ACTIVATE_ON_HIDE), only the first window is raised, so we need to raise the windows anyway
                    // selected.activate_window(selected.cachedWindows[0], global.get_current_time());

                    const wins = selected.cachedWindows;
                    for (let i = wins.length - 1; i >= 0; i--)
                        wins[i].raise();

                    this._setInput('reset');
                    this._activateWindow(selected.cachedWindows[0]);
                    // options.skipThisFocus = true;
                }
            } else if (selected && selected.get_n_windows) {
                if (selected.get_n_windows() === 0) {
                    // app has no windows - probably not running
                    selected.activate();
                    // options.skipThisFocus = true;
                } else {
                    // in this case app is running but no window match the current filter mode
                    selected.open_new_window(global.get_current_time());
                }
            } else if (selected && selected._is_showAppsIcon) {
                this._getActions().toggleAppGrid();
            }
        } else if (selected) {
            this._setInput('reset');
            this._activateWindow(selected);
            // Main.activateWindow(selected);
        }

        // don't close the switcher if there is higher possibility that user wants to continue using it
        if (!this._showingApps || (this.KEYBOARD_TRIGGERED || options.ACTIVATE_ON_HIDE || (!this.KEYBOARD_TRIGGERED && !options.SHOW_WINS_ON_ACTIVATE) || selected._is_showAppsIcon))
            super._finish();
        else
            this._doNotUpdateOnNewWindow = false;
    }

    _activateWindow(metaWin) {
        const wsSwitched = global.workspaceManager.get_active_workspace_index() !== metaWin.get_workspace().index();
        Main.activateWindow(metaWin);
        if (wsSwitched) { // && this.SHOW_WS_POPUP) {
            this._getActions().showWsSwitcherPopup();
        }
    }

    _connectIcons() {
        this._iconsConnections = [];
        this._switcherList._items.forEach(switcherButton => {
            this._iconsConnections.push(switcherButton.connect('button-press-event', this._onItemBtnPressEvent.bind(this)));
            this._iconsConnections.push(switcherButton.connect('scroll-event', this._onItemScrollEvent.bind(this)));
            // connect ShowAppsIcon
            if (switcherButton.get_child().toggleButton) {
                switcherButton.get_child().toggleButton.connect('notify::checked', () => {
                    this.fadeAndDestroy();
                    this._getActions().toggleAppGrid();
                });
            }
        });
    }

    _onWindowItemAppClicked(actor, event) {
        const button = event.get_button();
        if (button === Clutter.BUTTON_PRIMARY) {
            this._toggleSingleAppMode();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    }

    _updateSwitcher(winToApp = false) {
        let id;

        if (winToApp) {
            if (this._items[0] && this._items[0].window)
                id = _getWindowApp(this._items[0].window);
            id = id ? id.get_id() : 0;
        } else {
            id = this._getSelectedID();
        }

        this._skipInitialSelection = true;

        this.show();
        this._select(this._getItemIndexByID(id));
        if (!options.PREVIEW_SELECTED)
            this._destroyWinPreview();
    }

    _delayedUpdate(delay) {
        if (this._timeoutIds.update)
            GLib.source_remove(this._timeoutIds.update);

        this._timeoutIds.update = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            delay,
            () => {
                this._updateSwitcher();

                this._timeoutIds.update = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    }

    _setSwitcherStatus() {
        if (!options.STATUS)
            return;

        this._switcherList._statusLabel.set_text(
            `${_('Filter: ')}${FilterModeLabel[this._tempFilterMode === null ? this.WIN_FILTER_MODE : this._tempFilterMode]
            }${this._singleApp ? `/${_('APP')}` : ''},  ${
                _('Group:')} ${this._showingApps ? 'No' : GroupModeLabel[this.GROUP_MODE]}, ${
                _('Sort:')} ${this._showingApps ? SortingModeLabel[this.APP_SORTING_MODE] : SortingModeLabel[this.WIN_SORTING_MODE]}, ${
                _('Search:')} ${this._searchEntry === null ? 'Off' : 'On'}${
                this._activeInput ? `, ${_('Keyboard:')} ${this._activeInput}` : ''}`
        );
    }

    _resetNoModsTimeout() {
        if (this._noModsTimeoutId)
            GLib.source_remove(this._noModsTimeoutId);
        this._noModsTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            options.NO_MODS_TIMEOUT,
            () => {
                if (!this.KEYBOARD_TRIGGERED && this._isPointerOut() && !this._isPointerOnWsTmb() && !options.cancelTimeout) {
                    if (this.PREVIEW_SELECTED === PreviewMode.SHOW_WIN) {
                        if (this._lastShowed)
                            this._selectedIndex = this._lastShowed;


                        if (this._showingApps) {
                            const selected = this._getSelectedTarget();
                            if (selected && selected.cachedWindows && selected.cachedWindows.length) {
                                this._finish();
                            } else {
                                if (options.ACTIVATE_ON_HIDE)
                                    this._finish();
                                else
                                    this.fadeAndDestroy();
                            }
                        } else {
                            this._finish();
                        }
                    } else if (options.ACTIVATE_ON_HIDE) {
                        this._finish();
                    } else {
                        this.fadeAndDestroy();
                    }

                    this._noModsTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                } else {
                    this._resetNoModsTimeout();
                }
                return GLib.SOURCE_CONTINUE;
            }
        );
    }

    _getFocusedItemIndex() {
        // const metaWin = global.display.get_tab_list(Meta.TabList.NORMAL, null)[0];
        const metaWin = _getWindows(null)[0];
        if (!metaWin)
            return 0;

        let id;
        let pt;

        if (this._items[0]._is_window) {
            id = metaWin.get_id();
            pt = 'window';
        } else {
            id = _getWindowApp(metaWin).get_id();
            pt = 'app';
        }
        for (let i = 0; i < this._items.length; i++) {
            if (this._items[i]._is_showAppsIcon)
                continue;
            if (this._items[i][pt].get_id() === id)
                return i;
        }

        return 0;
    }

    _getSelectedID() {
        let item = this._items[this._selectedIndex > -1 ? this._selectedIndex : 0];
        return item._id;
    }

    _select(index) {
        if (!this._switcherList || index === this._highlighted)
            return;

        if (this._initialSelectionMode === SelectMode.NONE) {
            this._initialSelectionMode = SelectMode.ACTIVE;
        } else {
            this._selectedIndex = index;
            this._switcherList.highlight(index);
            // don't slow down showing the popup
            if (options.ITEM_CAPTIONS > 1)
                this._showTitleCaption();
        }

        this._destroyWinPreview();

        if (this.PREVIEW_SELECTED === PreviewMode.SHOW_WIN) {
            if (this._timeoutIds.showWinImmediately) {
                GLib.source_remove(this._timeoutIds.showWinImmediately);
                this._timeoutIds.showWinImmediately = 0;
            }

            if (!this._doNotShowWin) {
                this._timeoutIds.showWinImmediately = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    100,
                    () => {
                        if (this.KEYBOARD_TRIGGERED || (!this.KEYBOARD_TRIGGERED && !this._isPointerOut())) {
                            this._showWindow();
                            this._lastShowed = this._selectedIndex;
                        }

                        this._timeoutIds.showWinImmediately = 0;
                        return GLib.SOURCE_REMOVE;
                    }
                );
            }

            return;
        } else if (this.PREVIEW_SELECTED === PreviewMode.PREVIEW) {
            this._showPreview();
        }

        this._resetNoModsTimeout();
        if (options.INTERACTIVE_INDICATORS)
            this._updateMouseControls();
    }

    _next(reversed = false) {
        if (this._reverseOrder  && !reversed)
            return this._previous(true);


        let step = 1;
        if (!options.WRAPAROUND && this._selectedIndex === (this._items.length - 1))
            step = 0;


        return mod(this._selectedIndex + step, this._items.length);
    }

    _previous(reversed = false) {
        if (this._reverseOrder && !reversed)
            return this._next(true);


        let step = 1;
        if (!options.WRAPAROUND && this._selectedIndex === 0)
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


                    if (_getWindowApp(this._items[i].window).get_id() !== nextApp || i === lastIndex) {
                        this._select(i + (i === 0 ? 0 : 1));
                        return;
                    }
                }
            }

            // if no other app found try again from start
            if (i === lastIndex && !secondRun) {
                i = step === 1 ? -1 : this._items.length;
                secondRun = true;
            }
        }
    }

    _getNextApp() {
        let stableSequence = this.WIN_SORTING_MODE === SortingMode.STABLE_SEQUENCE;
        let apps = _getRunningAppsIds(stableSequence);

        if (apps.length === 0)
            return null;

        let currentIndex = apps.indexOf(this._singleApp[0]);
        if (currentIndex < 0)
            return null;

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
        let windows = _getWindows(currentWS);

        if (windows.length === 0)
            return null;


        let ri = windows[0].get_monitor();

        for (let w of windows) {
            if (w.get_monitor() !== ri)
                return false;
        }

        return true;
    }

    _getSelectedTarget() {
        let selected = null;
        if (this._selectedIndex > -1) {
            let it = this._items[this._selectedIndex];
            if (it && it._is_window)
                selected = it.window;
            else if (it && it._is_app)
                selected = it.app;
            else if (it && it._is_showAppsIcon)
                selected = it;
        }

        return selected;
    }

    _getItemIndexByID(id) {
        for (let i = 0; i < this._items.length; i++) {
            if (this._items[i]._id === id)
                return i;
        }
        return 0;
    }

    _isPointerOut() {
        const [x, y] = global.get_pointer();
        const switcher = this._switcherList;
        // margin expands the "inside" area around the popup to cover gap between the popup and the edge of screen (Top/Bottom position), plus small overlap
        let result = false;
        const margin = this.BOTTOM_MARGIN * this.SCALE_FACTOR - 1;
        const marginTop = this.TOP_MARGIN * this.SCALE_FACTOR;

        if (x < (switcher.allocation.x1 - margin) || x > (switcher.allocation.x1 + switcher.width + margin)) {
            // return true if the pointer is horizontally outside the switcher and cannot be at the top or bottom of the screen
            if (!((this.POPUP_POSITION === Position.TOP && y === switcher.allocation.y1 - marginTop) || (this.POPUP_POSITION === Position.BOTTOM && y === switcher.allocation.y2 + margin)))
                result = true;
        } else if (y < (switcher.allocation.y1 - marginTop) || y > (switcher.allocation.y2 + margin)) {
            result = true;
        }

        return result && !this._isPointerOnWsTmb(true);
    }

    _isPointerOnWsTmb(includeSpaceBetween = false) {
        if (!this._wsTmb)
            return false;

        const [x, y] = global.get_pointer();
        const wsTmb = this._wsTmb;

        const switcher = this._switcherList;

        if (x < wsTmb.allocation.x1 || (x > (wsTmb.allocation.x1 + wsTmb.width))) {
            // return true if the pointer is horizontally outside the wsTmb
            return false;
        }

        if (includeSpaceBetween) {
            // include space between ws thumbnails and the switcher
            const wsTmbAbove = switcher.allocation.y1 > wsTmb.allocation.y1;
            const wsTmbY1 = wsTmbAbove ? wsTmb.allocation.y1 : switcher.allocation.y2;
            const wsTmbY2 = wsTmbAbove ? switcher.allocation.y1 : wsTmb.allocation.y2;

            if (y < wsTmbY1 || y > wsTmbY2)
                return false;
        } else if (y < wsTmb.allocation.y1 || y > wsTmb.allocation.y2) {
            return false;
        }

        return true;
    }

    _getCurrentMonitorIndex() {
        const ws = global.workspaceManager.get_active_workspace();
        let windows = _getWindows(ws);
        const monIndex = windows.length > 0 ? windows[0].get_monitor()
            : global.display.get_current_monitor();
        return monIndex;
    }

    _getMonitorByIndex(monitorIndex) {
        let monitors = Main.layoutManager.monitors;
        for (let monitor of monitors) {
            if (monitor.index === monitorIndex)
                return monitor;
        }

        return -1;
    }

    _searchEntryNotEmpty() {
        return this._searchEntry !== null && this._searchEntry !== '';
    }

    // sometimes mouse hover don't select item and click/scroll on the item would activate another (previously selected) item
    _selectClickedItem(item) {
        for (let i = 0; i < this._switcherList._items.length; i++) {
            if (item === this._switcherList._items[i]) {
                this._selectedIndex = i;
                return;
            }
        }
    }

    _onItemBtnPressEvent(actor, event) {
        this._selectClickedItem(actor);
        const btn = event.get_button();
        let action;

        switch (btn) {
        case Clutter.BUTTON_PRIMARY:
            action = this._showingApps
                ? options.get('appSwitcherPopupPrimClickItem')
                : options.get('winSwitcherPopupPrimClickItem');
            break;
        case Clutter.BUTTON_SECONDARY:
            action = this._showingApps
                ? options.get('appSwitcherPopupSecClickItem')
                : options.get('winSwitcherPopupSecClickItem');
            break;
        case Clutter.BUTTON_MIDDLE:
            action = this._showingApps
                ? options.get('appSwitcherPopupMidClickItem')
                : options.get('winSwitcherPopupMidClickItem');
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }

        this._triggerAction(action);

        return Clutter.EVENT_STOP;
    }

    _onItemScrollEvent(actor, event) {
        const direction = event.get_scroll_direction();
        if (direction === Clutter.ScrollDirection.SMOOTH)
            return Clutter.EVENT_STOP;

        const action = this._showingApps
            ? options.get('appSwitcherPopupScrollItem')
            : options.get('winSwitcherPopupScrollItem');

        if (!this._scrollActionAllowed(action))
            return Clutter.EVENT_STOP;

        // if scroll doesn't control selection, select the item under the pointer in case the hover selection missed the event
        if (action !== Action.SELECT_ITEM)
            this._selectClickedItem(actor);


        this._lastActionTimeStamp = Date.now();
        this._triggerAction(action, direction);

        return Clutter.EVENT_STOP;
    }

    _scrollActionAllowed(action) {
        const timeout = action === Action.SELECT_ITEM
            ? SCROLL_SELECTION_TIMEOUT
            : SCROLL_TIMEOUT;
        if (Date.now() - this._lastActionTimeStamp < timeout)
            return false;
        return true;
    }

    vfunc_key_press_event(keyEvent) {
        let keysym = keyEvent.keyval;
        // the action is an integer which is bind to the registered shortcut
        // but custom shortcuts are not stable
        let action = global.display.get_keybinding_action(
            keyEvent.hardware_keycode, keyEvent.modifier_state);
        this._disableHover();
        if (this._keyPressHandler(keysym, action) !== Clutter.EVENT_PROPAGATE) {
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
        // monitor release of possible shortcut modifier keys only
        if (this._modifierMask) {
            let mods = global.get_pointer()[2];
            let state = mods & this._modifierMask;

            if (state === 0) {
                if (this._selectedIndex !== -1) {
                    // this.blockSwitchWsFunction = true;
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
            options.cancelTimeout = true;

            // delete last string when Backspace was pressed
            if (keysym === Clutter.KEY_BackSpace) {
                this._searchEntry = this._searchEntry.slice(0, -1);
                this.show();
                return Clutter.EVENT_STOP;
            // add character to search pattern
            } else if (!_isTabAction(action) && this._searchEntry !== null && !_ctrlPressed() &&
                        ((keysymName.length === 1 && (/[a-zA-Z0-9]/).test(keysymName)) || keysym === Clutter.KEY_space)) {
                if (keysymName === 'space')
                    keysymName = ' ';


                if (!(keysymName === ' ' && (this._searchEntry === '' || this._searchEntry[this._searchEntry.length - 1] === ' '))) {
                    this._searchEntry += keysymName.toLowerCase();
                    this.show();
                    return Clutter.EVENT_STOP;
                }
            }
        }

        if (keysym === Clutter.KEY_Escape && this._singleApp && !this.KEYBOARD_TRIGGERED) {
            this._toggleSingleAppMode();
        } else if (keysymName === this._originalOverlayKey || keysymName === 'Super_L') {
            // if overlay-key (usually Super_L) is pressed within the timeout after AATWS was triggered - double press
            if ((!_ctrlPressed() && _shiftPressed()) || (this._timeoutIds.overlayKeyInit && options.SUPER_DOUBLE_PRESS_ACT === DoubleSuperAction.OVERVIEW)) {
                this.fadeAndDestroy();
                Main.overview.toggle();
                if (this._searchEntryNotEmpty()) {
                    if (Main.overview.viewSelector) {
                        Main.overview.viewSelector._entry.set_text(this._searchEntry);
                        Main.overview.viewSelector._entry.grab_key_focus();
                    } else {
                        Main.overview._overview.controls._searchController._entry.set_text(this._searchEntry);
                    }
                }
            } else if ((_ctrlPressed() && _shiftPressed()) || (this._timeoutIds.overlayKeyInit && options.SUPER_DOUBLE_PRESS_ACT === DoubleSuperAction.APP_GRID)) {
                this.fadeAndDestroy();
                this._getActions().toggleAppGrid();
            } else if (this._timeoutIds.overlayKeyInit && options.SUPER_DOUBLE_PRESS_ACT === DoubleSuperAction.PREV_WIN) {
                this._finish();
            } else if (this._timeoutIds.overlayKeyInit && options.SUPER_DOUBLE_PRESS_ACT === DoubleSuperAction.SWITCHER_MODE) {
                // set default filter for respective mode, as if the switcher was launched for the first time
                if (this._switcherMode === SwitcherMode.WINDOWS)
                    this.APP_FILTER_MODE = options.get('appSwitcherPopupFilter');
                else
                    this.WIN_FILTER_MODE = options.get('winSwitcherPopupFilter');

                this._toggleSwitcherMode();
            } else if (_ctrlPressed()) {
                this._switchFilterMode();
            /* } else if (_shiftPressed()) {
                this._toggleSwitcherMode();*/
            } else {
                this.fadeAndDestroy();
                // this._toggleSwitcherMode();
            }
        } else if (_isTabAction(action) || _isTabBackwardAction(action) ||
            ((keysym === Clutter.KEY_Tab || keysym === Clutter.KEY_ISO_Left_Tab) && !_ctrlPressed()) ||
                // shortcut key that triggered the switcher - support for CHC-E
                (this._keyBind &&
                    (keysym === Clutter[`KEY_${this._keyBind.toUpperCase()}`] ||
                    keysym === Clutter[`KEY_${this._keyBind.toLowerCase()}`])
                )) {
            if (this._singleApp)
                this._toggleSingleAppMode();
            else if (_shiftPressed() || _isTabBackwardAction(action))
                this._select(this._previous());
            else
                this._select(this._next());
        // else if (keysym === Clutter.KEY_semicolon || keysym === 96 || keysym === 126 || keysym === 65112) { // 96 is grave, 126 ascii tilde, 65112 dead_abovering. I didn't find Clutter constants.
        } else if (action === Meta.KeyBindingAction.SWITCH_GROUP || action === Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD ||
                 keysym === Clutter.KEY_semicolon || keysym === 96 || keysym === 126 || keysym === 65112) {
            const selected = this._getSelectedTarget();
            if (_ctrlPressed()) {
                this._toggleSwitcherMode();
            // Ctrl not pressed
            } else if (this._switcherMode === SwitcherMode.APPS) {
                if (this._showingApps && selected.cachedWindows) {
                    if (selected && selected.cachedWindows.length)
                        this._toggleSingleAppMode();
                } else if (this._singleApp) {
                    if (_shiftPressed() || action === Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD)
                        this._select(this._previous());
                    else
                        this._select(this._next());
                } else if (selected && selected._is_showAppsIcon) {
                    this.INCLUDE_FAVORITES = !this.INCLUDE_FAVORITES;
                    this._updateSwitcher();
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
                    this._skipInitialSelection = true;
                    this.show();
                    this._selectNextApp(0);
                } else {
                    this._selectNextApp(index);
                }
            }
        } else if ((keysym === Clutter.KEY_Tab || keysym === Clutter.KEY_ISO_Left_Tab) && _ctrlPressed()) {
            let mod = Main.layoutManager.monitors.length;

            if (_shiftPressed())
                this._monitorIndex = (this._monitorIndex + mod - 1) % mod;
            else
                this._monitorIndex = (this._monitorIndex + 1) % mod;

            this._updateSwitcher();
            this._showWsThumbnails();
        } else if (options.get('hotkeySearch').includes(keyString) || keysym === Clutter.KEY_Insert) {
            this._toggleSearchMode();


        // Clear search entry or Force close (kill -9) the window process
        } else if (keysym === Clutter.KEY_Delete) {
            if (!_shiftPressed() && this._searchEntry !== null) {
                this._searchEntry = '';
                this.show();
            } else if (_shiftPressed()) {
                this._killApp();
            }
        } else if (keysym === Clutter.KEY_Left || options.get('hotkeyLeft').includes(keyString)) {
            if (_shiftPressed() && _ctrlPressed())
                this._moveFavorites(-1);
            else if (_ctrlPressed() && !_shiftPressed())
                this._moveWinToAdjacentWs(Clutter.ScrollDirection.UP);
            else if (!_shiftPressed())
                this._select(this._previous(true));
            else
                this._switchMonitor(Meta.DisplayDirection.LEFT);
        } else if (keysym === Clutter.KEY_Right || options.get('hotkeyRight').includes(keyString)) {
            if (_shiftPressed() && _ctrlPressed())
                this._moveFavorites(+1);
            else if (_ctrlPressed() && !_shiftPressed())
                this._moveWinToAdjacentWs(Clutter.ScrollDirection.DOWN);
            else if (!_shiftPressed())
                this._select(this._next(true));
            else
                this._switchMonitor(Meta.DisplayDirection.RIGHT);
        } else if (keysym === Clutter.KEY_Page_Up) {
            if (_ctrlPressed())
                this._reorderWorkspace(-1);
            else
                this._switchWorkspace(Meta.MotionDirection.UP);
        } else if (keysym === Clutter.KEY_Page_Down) {
            if (_ctrlPressed())
                this._reorderWorkspace(+1);
            else
                this._switchWorkspace(Meta.MotionDirection.DOWN);
        } else if (keysym === Clutter.KEY_Up || keysym === Clutter.KEY_Page_Up || options.get('hotkeyUp').includes(keyString)) {
            if (_ctrlPressed() && !_shiftPressed())
                this._moveWinToAdjacentWs(Clutter.ScrollDirection.UP);
            else if (_ctrlPressed() && _shiftPressed())
                this._moveWinToNewAdjacentWs(Clutter.ScrollDirection.UP);
            else if (!_ctrlPressed() && !_shiftPressed() && options.UP_DOWN_ACTION === UpDownAction.SWITCH_WS)
                this._switchWorkspace(Meta.MotionDirection.UP);
            else if (!_ctrlPressed() && !_shiftPressed() && options.UP_DOWN_ACTION === UpDownAction.SINGLE_APP)
                this._toggleSingleAppMode();
            else if (!_ctrlPressed() && !_shiftPressed() && options.UP_DOWN_ACTION === UpDownAction.SINGLE_AND_SWITCHER)
                this._toggleSwitcherMode();
            else
                this._switchMonitor(Meta.DisplayDirection.UP);
        } else if (keysym === Clutter.KEY_Down || keysym === Clutter.KEY_Page_Down || options.get('hotkeyDown').includes(keyString)) {
            if (_ctrlPressed() && !_shiftPressed())
                this._moveWinToAdjacentWs(Clutter.ScrollDirection.DOWN);
            else if (_ctrlPressed() && _shiftPressed())
                this._moveWinToNewAdjacentWs(Clutter.ScrollDirection.DOWN);
            else if (!_ctrlPressed() && !_shiftPressed() && options.UP_DOWN_ACTION === UpDownAction.SWITCH_WS)
                this._switchWorkspace(Meta.MotionDirection.DOWN);
            else if (!_ctrlPressed() && !_shiftPressed() && options.UP_DOWN_ACTION >= UpDownAction.SINGLE_APP)
                this._toggleSingleAppMode();
            else
                this._switchMonitor(Meta.DisplayDirection.DOWN);
        } else if (keysym === Clutter.KEY_Home) {
            if (_shiftPressed())
                this._switchToFirstWS();
            else
                this._select(0);
        } else if (keysym === Clutter.KEY_End) {
            if (_shiftPressed())
                this._switchToLastWS();
            else
                this._select(this._items.length - 1);
        } else if (options.get('hotkeySwitchFilter').includes(keyString)) {
            this._switchFilterMode();
        // } else if (keysym === Clutter.KEY_plus || keysym === Clutter.KEY_1 || keysym === Clutter.KEY_exclam) {
        } else if (options.get('hotkeySingleApp').includes(keyString)) {
            this._toggleSingleAppMode();

        // toggle sort by workspaces
        } else if (options.get('hotkeyGroupWs').includes(keyString) && (options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            if (!this._showingApps)
                this._toggleWsOrder();

        // show window or overview
        } else if (keysym === Clutter.KEY_space || keysym === Clutter.KEY_KP_0 || keysym === Clutter.KEY_KP_Insert) {
            if (_ctrlPressed()) {
                this._popModal();
                Main.overview.toggle();
                // need to release and grab the input back, otherwise the Shell gets to an irresponsive state
                this._pushModal();
            } else {
                // this._showWindow();
                this._toggleShowPreview();
            }

        // close window/app
        } else if (options.get('hotkeyCloseQuit').includes(keyString)) {
            if (options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)
                this._closeWinQuitApp();


        // close all listed windows that belongs to the selected app
        } else if (options.get('hotkeyCloseAllApp').includes(keyString) && (options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            this._closeAppWindows();


        // make selected window Always on Top
        } else if (options.get('hotkeyAbove').includes(keyString) && (options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            if (!this._showingApps)
                this._toggleWinAbove();

        // make selected window Always on Visible Workspace
        } else if (options.get('hotkeySticky').includes(keyString) && (options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            if (!this._showingApps)
                this._toggleWinSticky();

        // move selected window to the current workspace
        } else if (options.get('hotkeyMoveWinToMonitor').includes(keyString) &&
                 (options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            this._moveToCurrentWS();

        // maximize (and move if needed) selected window on the current workspace and monitor
        } else if (options.get('hotkeyMaximize').includes(keyString) &&
                 (options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            if (!this._showingApps)
                this._toggleMaximizeOnCurrentMonitor();

        // toggle FS on new ws
        } else if (options.get('hotkeyFsOnNewWs').includes(keyString) &&
                 (options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            if (this._showingApps || this._selectedIndex < 0)
                return Clutter.EVENT_PROPAGATE;

            this._toggleFullscreenOnNewWS();

        // open New Window
        } else if ((options.get('hotkeyNewWin').includes(keyString) &&
                  (options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) ||
                 (keysym === Clutter.KEY_Return && _ctrlPressed())) {
            this._openNewWindow();

        // toggle Switcher Mode
        } else if (options.get('hotkeySwitcherMode').includes(keyString)) {
            this._toggleSwitcherMode();

        // make thumbnail of selected window
        } else if (options.get('hotkeyThumbnail').includes(keyString)) {
            if ((options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true) && !_ctrlPressed())
                this._createWinThumbnail();
            else if (_ctrlPressed() && _shiftPressed())
                this._getActions().removeThumbnails();
            else if (_ctrlPressed())
                this._getActions().removeLastThumbnail();
        } else if (options.get('hotkeyPrefs').includes(keyString) && (options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            this._openPrefsWindow();
            this.fadeAndDestroy();
        } else if (options.get('hotkeyFavorites').includes(keyString) && (options.SHIFT_AZ_HOTKEYS ? _shiftPressed() : true)) {
            this.INCLUDE_FAVORITES = !this.INCLUDE_FAVORITES;
            this.show();
        } else if (keysym === Clutter.KEY_Return && _shiftPressed()) {
            this._switchInputSource();
        } else if (keysym === Clutter.KEY_Menu) {
            if (this._showingApps)
                this._openAppIconMenu();
            else
                this._openWindowMenu();
        } else {
            return Clutter.EVENT_PROPAGATE;
        }

        return Clutter.EVENT_STOP;
    }

    vfunc_button_press_event(event) {
        if (this._wsTmb && this._isPointerOnWsTmb())
            return Clutter.EVENT_STOP;


        const btn = event.button;
        const pointerOut = this._isPointerOut();
        let action;

        switch (btn) {
        case Clutter.BUTTON_PRIMARY:
            /* if ((this._recentSwitchTime - Date.now() > 0) && !pointerOut) {
                action = Action.ACTIVATE;
            } else { */
            action = pointerOut
                ? options.get('switcherPopupPrimClickOut')
                : options.get('switcherPopupPrimClickIn');
            // }
            break;

        case Clutter.BUTTON_SECONDARY:
            action = pointerOut
                ? options.get('switcherPopupSecClickOut')
                : options.get('switcherPopupSecClickIn');
            break;

        case Clutter.BUTTON_MIDDLE:
            action = pointerOut
                ? options.get('switcherPopupMidClickOut')
                : options.get('switcherPopupMidClickIn');
            break;

        default:
            return Clutter.EVENT_PROPAGATE;
        }

        this._triggerAction(action);
        return Clutter.EVENT_STOP;
    }

    vfunc_scroll_event(event) {
        let direction = event.direction;
        if (direction === Clutter.ScrollDirection.SMOOTH)
            return false;


        if (this._wsTmb && this._isPointerOnWsTmb()) {
            // scroll over ws thumbnails switches ws
            if (Date.now() - this._lastActionTimeStamp > 50) {
                direction = direction === Clutter.ScrollDirection.UP
                    ? Meta.MotionDirection.UP
                    : Meta.MotionDirection.DOWN;
                if (_shiftPressed() || _ctrlPressed())
                    this._reorderWorkspace(direction === Meta.MotionDirection.UP ? -1 : 1);
                else
                    this._switchWorkspace(direction);


                this._lastActionTimeStamp = Date.now();
            }

            return Clutter.EVENT_STOP;
        }

        const action = this._isPointerOut()
            ? options.get('switcherPopupScrollOut')
            : options.get('switcherPopupScrollIn');

        if (!this._scrollActionAllowed(action))
            return Clutter.EVENT_STOP;

        this._resetNoModsTimeout();

        this._lastActionTimeStamp = Date.now();
        this._triggerAction(action, direction);

        return Clutter.EVENT_STOP;
    }

    _showSearchCaption(text) {
        const margin = 20;
        const offset = this._itemCaption
            ? this._itemCaption.height + margin + (this._wsTmb ? this._wsTmb.height : 0)
            : margin;

        const fontSize = options.CAPTIONS_SCALE * 2;
        const params = {
            name: 'search-label',
            text,
            fontSize,
            yOffset: offset,
            monitorIndex: this._monitorIndex,
        };
        if (!this._searchCaption) {
            this._searchCaption = new CaptionLabel(params, options);
            this.add_child(this._searchCaption);
        } else {
            this._searchCaption.update(params);
        }
    }

    _showTitleCaption() {
        let selected = this._items[this._selectedIndex];

        if (!selected)
            return;

        let title;
        let details = '';

        if (selected._is_window) {
            title = selected.window.get_title();
            const appName = selected.app.get_name();
            details = appName === title ? '' : appName;
        } else {
            title = selected.titleLabel.get_text();
            // if searching apps add more info to the caption
            if (selected._appDetails) {
                if (selected._appDetails.generic_name && !this._match(title, selected._appDetails.generic_name))
                    details += `${selected._appDetails.generic_name}`;



                if (selected._appDetails.description && !this._match(title, selected._appDetails.description)) {
                    if (details)
                        details += '\n';


                    details += `${selected._appDetails.description}`;
                }
            }
        }

        const fontSize = options.CAPTIONS_SCALE;

        const params = {
            name: 'item-label',
            text: title,
            description: details,
            fontSize,
            yOffset: 0,
        };

        if (!this._itemCaption) {
            this._itemCaption = new CaptionLabel(params, options);
            this.add_child(this._itemCaption);
        } else {
            this._itemCaption.update(params);
        }

        if (this._inAnimation)
            this._itemCaption.opacity = 0;

        this._itemCaption.connect('destroy', () => {
            this._itemCaption = null;
        });
    }

    _updateMouseControls() {
        if (!this.mouseActive)
            return;

        // activate indicators only when mouse pointer is (probably) used to control the switcher
        if (this._updateNeeded) {
            this._items.forEach(w => {
                if (w._closeButton)
                    w._closeButton.opacity = 0;

                if (w._aboveStickyIndicatorBox)
                    w._aboveStickyIndicatorBox.opacity = 0;

                if (w._hotkeyIndicator)
                    w._hotkeyIndicator.opacity = 255;
            });
        }

        const item = this._items[this._selectedIndex];
        if (!item)
            return;

        // workaround - only the second call of _isPointerOut() returns correct answer
        this._isPointerOut();
        if (item.window && !this._isPointerOut()) {
            if (!item._closeButton) {
                item._createCloseButton(item.window);
                this._updateNeeded = true;
                item._closeButton.connect('enter-event', () => {
                    item._closeButton.add_style_class_name('window-close-hover');
                });
                item._closeButton.connect('leave-event', () => {
                    item._closeButton.remove_style_class_name('window-close-hover');
                });
            }
            item._closeButton.opacity = 255;
        }


        if (!options.INTERACTIVE_INDICATORS || this._isPointerOut() || this._selectedIndex < 0)
            return;

        if (item.window && !item._aboveStickyIndicatorBox) {
            item._aboveStickyIndicatorBox = item._getIndicatorBox();
            item._icon.add_child(item._aboveStickyIndicatorBox);
        }

        if (item._aboveStickyIndicatorBox) {
            item._aboveStickyIndicatorBox.opacity = 255;
            if  (item._hotkeyIndicator)
                item._hotkeyIndicator.opacity = 0;
        }


        if (item._aboveIcon && !item._aboveIcon.reactive) {
            item._aboveIcon.reactive = true;
            item._aboveIcon.opacity = 255;
            item._aboveIcon.connect('button-press-event', this._toggleWinAbove.bind(this));
            item._aboveIcon.connect('enter-event', () => {
                item._aboveIcon.add_style_class_name('window-state-indicators-hover');
            });
            item._aboveIcon.connect('leave-event', () => {
                item._aboveIcon.remove_style_class_name('window-state-indicators-hover');
            });
        }

        if (item._stickyIcon && !item._stickyIcon.reactive) {
            item._stickyIcon.reactive = true;
            item._stickyIcon.opacity = 255;
            item._stickyIcon.connect('button-press-event', this._toggleWinSticky.bind(this));
            item._stickyIcon.connect('enter-event', () => {
                item._stickyIcon.add_style_class_name('window-state-indicators-hover');
            });
            item._stickyIcon.connect('leave-event', () => {
                item._stickyIcon.remove_style_class_name('window-state-indicators-hover');
            });
        }

        if (item.window && !item._menuIcon) {
            item._menuIcon = new St.Icon({
                style_class: 'window-state-indicators',
                icon_name: 'view-more-symbolic',
                icon_size: 16,
                y_expand: true,
                y_align: Clutter.ActorAlign.START,
            });
            item._menuIcon.add_style_class_name(options.colorStyle.INDICATOR_OVERLAY);
            item._aboveStickyIndicatorBox.add_child(item._menuIcon);
            item._menuIcon.reactive = true;
            item._menuIcon.opacity = 255;
            item._menuIcon.connect('button-press-event', () => {
                this._openWindowMenu();
                return Clutter.EVENT_STOP;
            });
            item._menuIcon.connect('enter-event', () => {
                item._menuIcon.add_style_class_name('window-state-indicators-hover');
            });
            item._menuIcon.connect('leave-event', () => {
                item._menuIcon.remove_style_class_name('window-state-indicators-hover');
            });
        }

        if (item._appIcon && !item._appIcon.reactive) {
            item._appIcon.reactive = true;
            item._appIcon.connect('button-press-event', (actor, event) => {
                const button = event.get_button();
                if (button === Clutter.BUTTON_PRIMARY) {
                    this._toggleSingleAppMode();
                    return Clutter.EVENT_STOP;
                } else if (button === Clutter.BUTTON_MIDDLE) {
                    this._openNewWindow();
                    return Clutter.EVENT_STOP;
                } else if (button === Clutter.BUTTON_SECONDARY) {
                    this._toggleSwitcherMode();
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            item._appIcon.connect('enter-event', () => {
                item._appIcon.add_style_class_name(options.colorStyle.INDICATOR_OVERLAY_HOVER);
            });
            item._appIcon.connect('leave-event', () => {
                item._appIcon.remove_style_class_name(options.colorStyle.INDICATOR_OVERLAY_HOVER);
            });
        }

        if (item._wsIndicator && !item._wsIndicator.reactive) {
            const cws = global.workspaceManager.get_active_workspace();
            const ws = item.window.get_workspace();

            if (ws === cws)
                return;

            item._wsIndicator.reactive = true;
            item._wsIndicator.connect('button-press-event', (actor, event) => {
                const button = event.get_button();
                if (button === Clutter.BUTTON_PRIMARY) {
                    if (this._getSelectedTarget().get_workspace().index() !== global.workspaceManager.get_active_workspace_index())
                        this._moveToCurrentWS();
                    return Clutter.EVENT_STOP;
                } else if (button === Clutter.BUTTON_MIDDLE) {
                    return Clutter.EVENT_PROPAGATE;
                } else if (button === Clutter.BUTTON_SECONDARY) {
                    if (ws === cws)
                        Main.overview.toggle();
                    else
                        Main.wm.actionMoveWorkspace(ws);

                    /* this._filterSwitched = true;
                    this.WIN_FILTER_MODE = FilterMode.WORKSPACE;
                    this._updateSwitcher();*/
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            item._wsIndicator.connect('enter-event', () => {
                const ws = global.workspaceManager.get_active_workspace_index() + 1;
                const winWs = item.window.get_workspace().index() + 1;
                const monitor = item.window.get_monitor();
                const currentMonitor = global.display.get_current_monitor();
                const multiMonitor = global.display.get_n_monitors() - 1;
                item._wsIndicator.text = `${winWs}${multiMonitor ? `.${monitor.toString()}` : ''} → ${ws}${multiMonitor ? `.${currentMonitor.toString()}` : ''}`;
                // item._wsIndicator.add_style_class_name('ws-indicator-hover');
            });
            item._wsIndicator.connect('leave-event', () => {
                // item._wsIndicator.remove_style_class_name('ws-indicator-hover');
                item._wsIndicator.text = (item.window.get_workspace().index() + 1).toString();
            });
        }

        /* if (!item._frontConnection) {
            item._frontConnection = item._front.connect('button-press-event', this._onWindowItemAppClicked.bind(this));
            this._iconsConnections.push(item._frontConnection);
        }*/

        if (item._winCounterIndicator && !item._winCounterIndicator.reactive) {
            item._winCounterIndicator.reactive = true;
            item._winCounterIndicator.connect('button-press-event', (actor, event) => {
                const button = event.get_button();
                if (button === Clutter.BUTTON_PRIMARY) {
                    this._toggleSingleAppMode();
                    return Clutter.EVENT_STOP;
                } else if (button === Clutter.BUTTON_MIDDLE) {
                    return Clutter.EVENT_PROPAGATE;
                } else if (button === Clutter.BUTTON_SECONDARY) {
                    // inactive
                }
                return Clutter.EVENT_PROPAGATE;
            });

            item._winCounterIndicator.connect('enter-event', () => {
                item._winCounterIndicator.add_style_class_name(options.colorStyle.RUNNING_COUNTER_HOVER);
            });
            item._winCounterIndicator.connect('leave-event', () => {
                item._winCounterIndicator.remove_style_class_name(options.colorStyle.RUNNING_COUNTER_HOVER);
            });
        }

        item._mouseControlsSet = true;
    }

    // Actions
    // ////////////////////////////////////////
    _getActions() {
        if (!this._actions)
            this._actions = new ActionLib.Actions();


        return this._actions;
    }

    _moveFavorites(direction) {
        if ((!this._showingApps && this.INCLUDE_FAVORITES) || !this._getSelectedTarget())
            return;

        let app = this._getSelectedTarget().get_id();
        let favorites = global.settings.get_strv('favorite-apps');
        let fromIndex = favorites.indexOf(app);
        let maxIndex = favorites.length - 1;

        if (fromIndex !== -1) {
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

    _toggleShowPreview() {
        if (this.PREVIEW_SELECTED === PreviewMode.PREVIEW) {
            this.PREVIEW_SELECTED = PreviewMode.DISABLE;
            this._destroyWinPreview();
        } else {
            this.PREVIEW_SELECTED = PreviewMode.PREVIEW;
            this._showPreview();
        }
    }

    _showPreview(toggle = false) {
        let selected = this._getSelectedTarget();
        if (!selected || selected._is_showAppsIcon)
            return;


        if (toggle && this._winPreview) {
            this._destroyWinPreview();
            return;
        }

        let metaWin;
        if (selected.get_windows) {
            if (!selected.cachedWindows.length) {
                this._destroyWinPreview();
                return;
            }

            metaWin = selected.cachedWindows[0];
        } else {
            metaWin = selected;
        }

        if (!this._winPreview) {
            this._winPreview = new AltTab.CyclerHighlight();
            global.window_group.add_actor(this._winPreview);
            global.window_group.set_child_above_sibling(this._winPreview, null);
        }

        this._winPreview.window = metaWin;
    }

    _showWindow() {
        if (this._doNotShowWin)
            return;
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
            return;

        // let appId = 0;

        if (selected.get_windows) {
            if (!selected.cachedWindows.length)
                return;

            // appId = selected.get_id();
            selected = selected.cachedWindows[0];
        }

        /* let id = selected.get_id();
        if (appId)
            id = appId;*/

        if (selected.minimized)
            selected.unminimize();


        selected.raise();

        if (global.workspace_manager.get_active_workspace() !== selected.get_workspace()) {
            Main.wm.actionMoveWorkspace(selected.get_workspace());
            this._getActions().showWsSwitcherPopup();
        }
    }

    _toggleSingleAppMode(switchOn = false) {
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
            return;

        let winToApp = false;
        if (!this._singleApp || switchOn) {
            if (this._showingApps && selected.cachedWindows) {
                if (!selected.cachedWindows.length)
                    return;

                this._singleApp = [selected.get_id(), selected.get_name()];
                this.SHOW_APPS = false;
                if (!options.SYNC_FILTER)
                    this.WIN_FILTER_MODE = this.APP_FILTER_MODE;
            } else {
                let id, name;
                const app = _getWindowApp(selected);
                if (app) {
                    id = app.get_id();
                    name = app.get_name();
                    this._singleApp = [id, name];
                }
            }
        } else {
            this._singleApp = null;
            this._switcherAppPos = null;
            if (this._switcherMode === SwitcherMode.APPS) {
                this.SHOW_APPS = true;
                winToApp = true;
            }

            if (!options.SYNC_FILTER)
                this.WIN_FILTER_MODE = options.WIN_FILTER_MODE;
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
            options.cancelTimeout = false;
            if (this._searchCaption)
                this._searchCaption.hide();
        } else {
            this._searchEntry = '';
            this._modifierMask = 0;
            options.cancelTimeout = true;
            this.SEARCH_DEFAULT = false;
        }

        this.show();
    }

    _toggleSwitcherMode() {
        const selected = this._getSelectedTarget();
        if (this._switcherMode === SwitcherMode.APPS) {
            this._switcherMode = SwitcherMode.WINDOWS;
            this.SHOW_APPS = false;
            this._singleApp = null;

            if (!this._searchEntryNotEmpty()) {
                let id = 0;
                if (this._showingApps) {
                    if (selected && selected.cachedWindows && selected.cachedWindows.length)
                        id = selected.cachedWindows[0].get_id();
                } else {
                    id = _getWindowApp(this._items[0].window).get_id();
                }

                this._skipInitialSelection = true;
                this.show();
                this._select(this._getItemIndexByID(id));
            } else {
                this._initialSelectionMode = SelectMode.FIRST;
                this.show();
            }
        } else /* if (this._switcherMode === SwitcherMode.WINDOWS)*/ {
            this._switcherMode = SwitcherMode.APPS;
            this.SHOW_APPS = true;
            this._singleApp = null;

            if (!this._searchEntryNotEmpty()) {
                let id;

                if (this._showingApps) {
                    if (this._selectedIndex > -1 && selected && selected.cachedWindows && selected.cachedWindows.length)
                        id = selected.cachedWindows[0].get_id();
                } else if (this._selectedIndex > -1) {
                    id = _getWindowApp(this._items[this._selectedIndex].window).get_id();
                }

                if (id !== undefined) {
                    this._skipInitialSelection = true;
                    this.show();
                    this._select(this._getItemIndexByID(id));
                } else {
                    this._initialSelectionMode = SelectMode.FIRST;
                    this.show();
                }
            } else {
                this._initialSelectionMode = SelectMode.FIRST;
                this.show();
            }
        }
    }

    _switchFilterMode() {
        let filterMode = this._showingApps
            ? this.APP_FILTER_MODE
            : this.WIN_FILTER_MODE;
        // if active ws has all windows on one monitor, ignore the monitor filter mode to avoid 'nothing happens' when switching between modes
        let m = (Main.layoutManager.monitors.length > 1) && !this._allWSWindowsSameMonitor() ? 3 : 2;
        filterMode -= 1;

        if (filterMode < FilterMode.ALL)
            filterMode = m;


        if (this._switcherMode === SwitcherMode.WINDOWS) {
            this.WIN_FILTER_MODE = filterMode;
            if (options.SYNC_FILTER)
                this.APP_FILTER_MODE = filterMode;
        } else {
            this.APP_FILTER_MODE = filterMode;
            if (options.SYNC_FILTER)
                this.WIN_FILTER_MODE = filterMode;
        }
        this._filterSwitched = true;
        this._updateSwitcher();
    }

    _toggleWsOrder() {
        if (this.GROUP_MODE === GroupMode.WORKSPACES)
            this.GROUP_MODE = this._defaultGrouping;
        else
            this.GROUP_MODE = GroupMode.WORKSPACES;


        this._updateSwitcher();
        this._getActions().showWsSwitcherPopup();
    }

    _switchWorkspace(direction) {
        let id = this._getSelectedID();
        this._getActions().switchWorkspace(direction, true);

        if (this._selectedIndex > -1) {
            this._skipInitialSelection = true;
            const callback = function () {
                this._doNotShowWin = true;
                this._select(this._getItemIndexByID(id));
                this._doNotShowWin = false;
            }.bind(this);
            this._updateOnWorkspaceSwitched(callback);
        } else {
            this._updateOnWorkspaceSwitched();
        }

        this._getActions().showWsSwitcherPopup();
    }

    _switchMonitor(direction) {
        let display = global.display;
        let nMonitors = display.get_n_monitors();

        if (nMonitors > 1 && this._monitorIndex >= 0) {
            let monIdx = display.get_monitor_neighbor_index(this._monitorIndex, direction);

            if (monIdx > -1) {
                this._monitorIndex = monIdx;
                this._updateSwitcher();
                this._showWsThumbnails();
            }
        }
    }

    /* _onlySelectedOnCurrentWs(selectedWindows) {
        let wsWindows = global.workspace_manager.get_active_workspace().list_windows();
        let match = 0;
        wsWindows.forEach(w => match += selectedWindows.includes(w) ? 1 : 0);
        if (match === wsWindows.length)
            return true;
        return false;
    }*/

    _moveWinToNewAdjacentWs(direction, select = null) {
        let selected = select;
        if (!selected)
            selected = this._getSelectedTarget();


        if (!selected || selected._is_showAppsIcon || (selected.cachedWindows && !selected.cachedWindows.length))
            return;


        let wsIndex = global.workspace_manager.get_active_workspace_index();
        wsIndex += direction === Clutter.ScrollDirection.UP ? 0 : 1;
        Main.wm.insertWorkspace(wsIndex);
        this._moveWinToAdjacentWs(direction, selected);
    }

    _moveWinToAdjacentWs(direction, select = null) {
        let selected = select;
        if (!selected)
            selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon || (selected.cachedWindows && !selected.cachedWindows.length))
            return;


        // avoid recreation of the switcher during the move
        this._doNotUpdateOnNewWindow = true;
        let wsIndex = global.workspace_manager.get_active_workspace_index();
        wsIndex += direction === Clutter.ScrollDirection.UP ? -1 : 1;
        wsIndex = Math.min(wsIndex, global.workspace_manager.get_n_workspaces() - 1);

        // create new workspace if window should be moved in front of the first workspace
        if (wsIndex < 0 & !select) {
            this._moveWinToNewAdjacentWs(direction, selected);
            this._doNotUpdateOnNewWindow = false;
            return;
        } else if (wsIndex < 0) {
            return;
        }

        direction = direction === Clutter.ScrollDirection.UP
            ? Meta.MotionDirection.UP
            : Meta.MotionDirection.DOWN;
        let ws = global.workspace_manager.get_workspace_by_index(wsIndex);
        if (this._showingApps) {
            this._getActions().switchWorkspace(direction, true);
            this._moveToCurrentWS();
        } else {
            Main.wm.actionMoveWindow(selected, ws);
            this._updateSwitcher();
        }

        this._getActions().showWsSwitcherPopup(direction, wsIndex);
        this._doNotUpdateOnNewWindow = false;
    }

    _moveToCurrentWS() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
            return;

        let winList = selected.cachedWindows ? selected.cachedWindows : [selected];
        winList.forEach(win => {
            this._getActions().moveWindowToCurrentWs(win, this.KEYBOARD_TRIGGERED ? this._monitorIndex : -1);
        });

        this._showWindow();
        this._delayedUpdate(100);
    }

    _reorderWorkspace(direction = 0) {
        this._getActions().reorderWorkspace(direction);
        this._getActions().showWsSwitcherPopup();
    }

    _toggleMaximizeOnCurrentMonitor() {
        let selected = this._getSelectedTarget();
        if (selected && !selected.cachedWindows) {
            this._getActions().toggleMaximizeOnCurrentMonitor(
                selected, this.KEYBOARD_TRIGGERED ? this._monitorIndex : -1);
            this._showWindow();
            this._updateSwitcher();
        }
    }

    _toggleFullscreenOnNewWS() {
        let selected = this._getSelectedTarget();
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
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
            return;

        if (selected && selected.get_windows) {
            if (selected.cachedWindows)
                selected = selected.cachedWindows[0];
            else
                return;
        }

        this._getActions().makeThumbnailWindow(selected);
    }

    _openWindowMenu() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
            return;

        const windowMenuManager = new WindowMenu.WindowMenuManager(this);
        const item = this._items[this._selectedIndex];

        options.cancelTimeout = true;

        windowMenuManager.showWindowMenuForWindow(selected, Meta.WindowMenuType.WM, item);
        windowMenuManager.menu.connect('destroy',
            () => {
                options.cancelTimeout = false;
            }
        );
    }

    _openAppIconMenu() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
            return;

        let nWindows = selected.cachedWindows.length;
        let popupItems = [
            [_(`Move ${nWindows} Windows to New Workspace`), this._moveWinToNewAdjacentWs, Clutter.ScrollDirection.DOWN],
            [_(`Move ${nWindows} Windows to Current WS/Monitor`), this._moveToCurrentWS],
            [_('Force Quit'), this._killApp],
            [_(`Close ${nWindows} Windows`), this._closeAppWindows],
        ];

        if (shellVersion < 41) // this item was added in 41
            popupItems.push([_('Quit'), this._closeWinQuitApp]);

        let appIcon = this._items[this._selectedIndex];
        if (appIcon) {
            appIcon.popupMenu();
            if (nWindows && (!appIcon._menu._alreadyCompleted || shellVersion < 41)) {
                appIcon._menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                popupItems.forEach(i => {
                    let item = new PopupMenu.PopupMenuItem(i[0]);
                    appIcon._menu.addMenuItem(item);
                    item.connect('activate', i[1].bind(this));
                });
                appIcon._menu._alreadyCompleted = true;
            }
            let menuItems = appIcon._menu._getMenuItems();
            menuItems[1].active = true;
        }

        // remove items added by OFP extension
        if (this._items[this._selectedIndex]._addedMenuItems) {
            this._items[this._selectedIndex]._addedMenuItems.forEach(
                item => item.destroy()
            );
            this._items[this._selectedIndex]._addedMenuItems = undefined;
        }
    }

    _closeWinQuitApp() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
            return;

        if (this._showingApps)
            selected.request_quit();
        else if (_ctrlPressed() && (this.KEYBOARD_TRIGGERED && !_ctrlPressed(this._modifierMask)))
            _getWindowApp(selected).request_quit();
        else
            selected.delete(global.get_current_time());

        // if any window remains, update the switcher content
        // if (this._items.length > 1)
        //    this._delayedUpdate(200);
    }

    _closeAppWindows() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
            return;

        this._getActions().closeAppWindows(selected, this._items);
    }

    _killApp() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
            return;

        if (this._showingApps) {
            if (selected.cachedWindows.length > 0)
                selected.cachedWindows[0].kill();
        } else {
            selected.kill();
        }
    }

    _openNewWindow() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
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
        this._getActions().showWsSwitcherPopup();
    }

    _switchToLastWS() {
        Main.wm.actionMoveWorkspace(global.workspace_manager.get_workspace_by_index(global.workspace_manager.n_workspaces - 1));
        this.show();
        this._getActions().showWsSwitcherPopup();
    }

    _toggleWinAbove() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
            return;

        this._getActions().toggleAboveWindow(selected);
        // Main.wm.actionMoveWorkspace(selected.get_workspace());
        this._updateSwitcher();
    }

    _toggleWinSticky() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._is_showAppsIcon)
            return;

        this._getActions().toggleStickyWindow(selected);
        this._updateSwitcher();
    }

    _openPrefsWindow() {
        this._getActions().openPrefsWindow();
    }

    _showWsThumbnails() {
        const enabled = options.WS_THUMBNAILS === 1 || (options.WS_THUMBNAILS === 2 && !this.KEYBOARD_TRIGGERED);
        if (shellVersion >= 42 && enabled) {
            if (this._wsTmb) {
                this.remove_child(this._wsTmb);
                // adding dummy placeholder with empty hide function removes errors caused by accessing already destroyed placeholder while destroying wsTmb
                // problem are callbacks registered by Meta.later_add in ThumbnailsBox class
                this._wsTmb._dropPlaceholder = { hide: () => {} };
                this._wsTmb.destroy();
            }
            const wsTmb = new
            WorkspaceThumbnail.ThumbnailsBox(Main.overview._overview.controls._workspacesDisplay._scrollAdjustment,
                this._monitorIndex,
                Clutter.Orientation.HORIZONTAL);

            wsTmb._createThumbnails();
            // wsTmb.add_style_class_name(options.colorStyle.CAPTION_LABEL);
            this.add_child(wsTmb);
            this.set_child_below_sibling(wsTmb, null);
            this._wsTmb = wsTmb;
        }
    }

    // //////////////////////////////////////////////////////////////////////

    _triggerAction(action, direction = 0) {
        // select recent window instead of the first one
        /* if ((this._recentSwitchTime - Date.now() > 0) && this.PREVIEW_SELECTED === PreviewMode.SHOW_WIN) {
            this._select(this._next());
        }*/

        switch (action) {
        case Action.ACTIVATE:
            if (_shiftPressed() && !_ctrlPressed())
                this._moveToCurrentWS();
            else if (_ctrlPressed() && !_shiftPressed())
                this._openNewWindow();
            else
                this._finish();

            break;
        case Action.SELECT_ITEM:
            this._disableHover();
            this._scrollHandler(direction);
            break;
        case Action.SWITCH_FILTER:
            this._switchFilterMode();
            break;
        case Action.SWITCH_WS:
            direction = direction === Clutter.ScrollDirection.UP ? Meta.MotionDirection.UP : Meta.MotionDirection.DOWN;
            this._switchWorkspace(direction);
            break;
        case Action.SHOW:
            // this._showWindow();
            this._toggleShowPreview();
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
        case Action.THUMBNAIL:
            this._createWinThumbnail();
            break;
        case Action.MOVE_TO_WS:
            this._moveToCurrentWS();
            break;
        case Action.FS_ON_NEW_WS:
            this._toggleFullscreenOnNewWS();
            break;
        case Action.HIDE:
            this.fadeAndDestroy();
            break;
        case Action.MENU:
            if (this._showingApps)
                this._openAppIconMenu();
            else
                this._openWindowMenu();
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
        return Clutter.EVENT_STOP;
    }
    // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
    // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    _getCustomWindowList(pattern = '', allWindows = false) {
        if (typeof  pattern === 'string')
            pattern = pattern.trim();


        let filterMode;
        if (this._tempFilterMode)
            filterMode = this._tempFilterMode;
        else
            filterMode = this.WIN_FILTER_MODE;

        let ws = global.workspace_manager.get_active_workspace();
        let monitor = this._monitorIndex;
        let workspace = null;
        let winList = _getWindows(workspace, options.INCLUDE_MODALS);

        const currentWin = winList[0];

        // after the shell restarts (X11) AltTab.getWindows(ws) generates different (wrong) win order than ...getwindows(null) (tested on GS 3.36 - 41)
        // so we will filter the list here if needed, to get consistent results in this situation for all FilterModes
        if (filterMode > FilterMode.ALL && !allWindows) {
            winList = winList.filter(w => w.get_workspace() === ws);
            if (filterMode === FilterMode.MONITOR && monitor > -1)
                winList = winList.filter(w => w.get_monitor() === monitor);
        }

        if (!options.MINIMIZED_LAST && !options.SKIP_MINIMIZED) {
            // wm returns tablist with the minimized windows at the end of the list, we want to move them back to their real MRU position
            // but avoid sorting all windows because parents of the modal windows could already be moved to their children position.
            winList = winList.sort((a, b) => (b.get_user_time() > a.get_user_time()) && b.minimized);
        }

        if (options.SKIP_MINIMIZED)
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
        } else if (this.GROUP_MODE === GroupMode.CURRENT_MON_FIRST && filterMode < FilterMode.MONITOR) {
            // windows from the active workspace and monitor first
            winList.sort((a, b) =>  (b.get_workspace().index() === ws.index() && b.get_monitor() === monitor) &&
                                    (a.get_workspace().index() !== ws.index() || a.get_monitor() !== monitor));
        } else if (this.GROUP_MODE === GroupMode.APPS) {
            // let apps = _getAppList(winList);
            let apps = _getRunningAppsIds();
            winList.sort((a, b) => apps.indexOf(_getWindowApp(b).get_id()) < apps.indexOf(_getWindowApp(a).get_id()));
        }

        if (this._singleApp) {
            if (this._switchNextApp) {
                this._singleApp = this._getNextApp(winList);
                this._switchNextApp = false;
            }

            const tracker = Shell.WindowTracker.get_default();
            const id = this._singleApp[0];
            const name = this._singleApp[1];

            // some apps (like VirtualBox) may create multiple windows with different app ids, but with the same name
            winList = winList.filter(w => tracker.get_window_app(w).get_id() === id || tracker.get_window_app(w).get_name() === name);
        }

        if (pattern) {
            const filterList = (wList, pattern) => {
                return wList.filter(w => {
                // search in window title and app name/exec
                    const appInfo = Shell.WindowTracker.get_default().get_window_app(w).appInfo;
                    const title = w.title;
                    let appName;
                    let appGeneric;
                    let appExec;

                    if (appInfo) {
                        appName = appInfo.get_name() || '';
                        appGeneric = appInfo.get_generic_name() || '';
                        appExec = appInfo.get_executable() || '';
                    }
                    let text = `${title} ${appName} ${appGeneric} ${appExec}`;

                    return this._match(text, pattern);
                });
            };

            let winListP = filterList(winList, pattern);
            if (winListP.length > 0 && this._searchEntryNotEmpty())
                winListP.sort((a, b) => this._isMoreRelevant(a.get_title(), b.get_title(), pattern));

            winList = winListP;
        }

        if (winList.length)
            this._showingApps = false;


        return winList;
    }

    _getAppList(pattern = '') {
        let filterMode = this._tempFilterMode
            ? this._tempFilterMode
            : this.APP_FILTER_MODE;

        // pattern can be null
        if (!pattern)
            pattern = '';
        pattern = pattern.trim();

        let appList = [];

        const running = Shell.AppSystem.get_default().get_running(); // AppSystem returns list in MRU order
        const runningIds = _getRunningAppsIds(true); // true for stable sequence order

        let favorites = [];
        let favoritesFull = [];

        if (this.SHOW_APPS && pattern === '') {
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

            if (this.APP_SORTING_MODE === SortingMode.STABLE_SEQUENCE || (!this.KEYBOARD_TRIGGERED && options.get('switcherPopupExtAppStable')))
                running.sort((a, b) => runningIds.indexOf(a.get_id()) - runningIds.indexOf(b.get_id()));


            appList = [...running, ...appList];
            // when triggered by a mouse, keep favorites order instead of default and also when hotkey to reordering favs was used
            if ((!this.KEYBOARD_TRIGGERED && options.get('switcherPopupExtAppStable')) || !this._favoritesMRU || this.APP_SORTING_MODE !== SortingMode.MRU) {
                this._favoritesMRU = false;
                appList.sort((a, b) => {
                    a = favoritesFull.indexOf(a.get_id());
                    b = favoritesFull.indexOf(b.get_id());
                    return  b > -1 && (b < a || a === -1);
                });

                this._initialSelectionMode = SelectMode.ACTIVE;
            }
        } else {
            this._initialSelectionMode = SelectMode.FIRST;
            let appInfoList = Shell.AppSystem.get_default().get_installed();

            appInfoList = appInfoList.filter(appInfo => {
                try {
                    appInfo.get_id(); // catch invalid file encodings
                } catch (e) {
                    return false;
                }

                // let name = appInfo.get_name() || '';
                let string = '';
                let shouldShow = false;
                if (appInfo.get_display_name) {
                    let exec = appInfo.get_commandline() || '';

                    // show only launchers that should be visible in this DE and invisible launchers of Gnome Settings items
                    shouldShow = appInfo.should_show() || exec.includes('gnome-control-center', 0);

                    if (shouldShow) {
                        let dispName = appInfo.get_display_name() || '';
                        let gName = appInfo.get_generic_name() || '';
                        // let exec = appInfo.get_executable() || '';
                        let description = appInfo.get_description() || '';
                        let categories = appInfo.get_string('Categories') || '';
                        let keywords = appInfo.get_string('Keywords') || '';
                        string = `${dispName} ${gName} ${exec} ${description} ${categories} ${keywords}`;
                    }
                }

                return shouldShow && this._match(string, pattern);
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
            // prefer apps where any word in their name starts with the pattern
            appList.sort((a, b) => this._isMoreRelevant(a.app_info.get_display_name(), b.app_info.get_display_name(), pattern));
            // prefer currently running apps
            if (options.SEARCH_PREF_RUNNING)
                appList.sort((a, b) => b.get_n_windows() > 0 && a.get_n_windows() === 0);

            // limit the app list size
            appList.splice(options.APP_SEARCH_LIMIT);
        }

        // let windowTracker = Shell.WindowTracker.get_default();
        this._tempFilterMode = filterMode;
        if (/* (filterMode === FilterMode.MONITOR || filterMode === FilterMode.WORKSPACE) &&*/ pattern === '') {
            this._tempFilterMode = this.APP_FILTER_MODE;
            appList = appList.filter(a => {
                if (a.get_n_windows())
                    a.cachedWindows = this._filterWindowsForWsMonitor(a.get_windows());
                else
                    a.cachedWindows = [];


                // filter out non fav apps w/o windows
                return a.cachedWindows.length > 0 || favoritesFull.indexOf(a.get_id()) > -1;
            });
        } else {
            appList.forEach(
                a => {
                    if (a.get_n_windows())
                        a.cachedWindows = this._filterWindowsForWsMonitor(a.get_windows());
                    else
                        a.cachedWindows = [];
                }
            );
        }

        if (appList.length)
            this._showingApps = true;


        return appList;
    }

    _filterWindowsForWsMonitor(windows) {
        const filterMode = this._tempFilterMode
            ? this._tempFilterMode
            : this.APP_FILTER_MODE;
        const currentWS = global.workspace_manager.get_active_workspace_index();
        const currentMon = global.display.get_current_monitor();

        return windows.filter(
            w => filterMode === FilterMode.ALL || ((filterMode === FilterMode.WORKSPACE || filterMode === FilterMode.MONITOR) && w.get_workspace().index() === currentWS)
        ).filter(w => (filterMode === FilterMode.ALL || filterMode === FilterMode.WORKSPACE) || (filterMode === FilterMode.MONITOR && w.get_monitor() === currentMon)
        ).filter(w => !w.skip_taskbar || (options.INCLUDE_MODALS && w.is_attached_dialog()));
    }

    _match(string, pattern) {
        // remove diacritics and accents from letters
        let s = string.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        let p = pattern.toLowerCase();
        let ps = p.split(/ +/);

        // allows to use multiple exact patterns separated by space in arbitrary order
        for (let w of ps) {
            if (!s.includes(w))
                return false;
        }
        return true;
    }

    _isMoreRelevant(stringA, stringB, pattern) {
        let regex = /[^a-zA-Z\d]/;
        let strSplitA = stringA.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(regex);
        let strSplitB = stringB.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(regex);
        let aAny = false;
        strSplitA.forEach(w => {
            aAny = aAny || w.startsWith(pattern);
        });
        let bAny = false;
        strSplitB.forEach(w => {
            bAny = bAny || w.startsWith(pattern);
        });

        // if both strings contain a word that starts with the pattern
        // prefer the one whose first word starts with the pattern
        if (aAny && bAny)
            return !strSplitA[0].startsWith(pattern) && strSplitB[0].startsWith(pattern);
        else
            return !aAny && bAny;
    }

    _shouldReverse() {
        if (this.KEYBOARD_TRIGGERED || !options.REVERSE_AUTO)
            return false;

        if (this._reverseOrder)
            return true;


        let geometry = global.display.get_monitor_geometry(this._monitorIndex);
        let mousePointerX = global.get_pointer()[0];
        let diff = geometry.x + geometry.width - mousePointerX;
        let reverse = diff < 100;
        this._reverseOrder = reverse;

        return reverse;
    }
});

// ////////////////////////////////////////////////////////////////////////////////

var   AppSwitcherPopup = GObject.registerClass(
class AppSwitcherPopup extends WindowSwitcherPopup {
    _init(switcherParams) {
        super._init(switcherParams);
        this._switcherMode = SwitcherMode.APPS;
        this.SHOW_APPS = true;
    }
});

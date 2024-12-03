/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * WindowSwitcherPopup
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as SwitcherPopup from 'resource:///org/gnome/shell/ui/switcherPopup.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as WorkspaceThumbnail from 'resource:///org/gnome/shell/ui/workspaceThumbnail.js';

import * as Actions from './actions.js';
import * as CaptionLabel from './captionLabel.js';
import * as Enum from './enum.js';
import * as InputHandler from './inputHandler.js';
import * as ListProvider from './listProvider.js';
import * as SwitcherList from './switcherList.js';
import * as Util from './util.js';
import * as WindowMenu from './windowMenu.js';

let GroupModeLabel;/* = ['',
    _('NONE'),
    _('MON FIRST'),
    _('APPS'),
    _('WS')];*/

let SortingModeLabel;/* = ['',
    _('MRU'),
    _('STABLE'),
    _('STABLE - current 1.')];*/

let FilterModeLabel;/* = ['',
    _('ALL'),
    _('WS '),
    _('MON')];*/

let Me;
let opt;
// gettext
let _;

export const ANIMATION_TIME = 200;
const DISABLE_HOVER_TIMEOUT = 500; // milliseconds
const SCROLL_TIMEOUT = 200;
const SCROLL_SELECTION_TIMEOUT = 20;

export function init(me) {
    Me = me;
    opt = Me.opt;
    _ = Me._;

    FilterModeLabel = ['',
        _('ALL'),
        _('WS '),
        _('MON')];
    SortingModeLabel = ['',
        _('MRU'),
        _('STABLE'),
        _('STABLE - current 1.')];
    GroupModeLabel = ['',
        _('NONE'),
        _('MON FIRST'),
        _('APPS'),
        _('WS')];
}

export function cleanGlobal() {
    opt = null;
    Me = null;
    _ = null;
}

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

function mod(a, b) {
    return (a + b) % b;
}

let shortcutModifiers;

function _shiftPressed(state) {
    return Util.shiftPressed(state, shortcutModifiers);
}

function _ctrlPressed(state) {
    return Util.ctrlPressed(state, shortcutModifiers);
}

// ////////////////////////////////////////////////////////////////////////////////

export const AppSwitcherPopup = {
    after__init() {
        this._switcherMode = Enum.SwitcherMode.APPS;
        this._showApps = true;
    },
};

export const WindowSwitcherPopup = {
    _init() {
        shortcutModifiers = global.get_pointer()[2];
        this._initTime = Date.now();
        SwitcherPopup.SwitcherPopup.prototype._init.bind(this)({
            offscreen_redirect: Clutter.OffscreenRedirect.ALWAYS,
        });

        [this.PANEL_TOP,
            this.PANEL_BOTTOM]     = this._getPanelPlacement();
        this.MARGIN_TOP            = 12;
        this.MARGIN_BOTTOM         = 12;

        this._actions              = new Actions.Actions(Me, this, shortcutModifiers);
        this._inputHandler         = new InputHandler.InputHandler(opt, this, shortcutModifiers);
        this._listProvider         = new ListProvider.ListProvider(this, opt);

        // Global options
        // filter out all modifiers except Shift|Ctrl|Alt|Super and get those used in the shortcut that triggered this popup
        this._modifierMask         = global.get_pointer()[2] & 77; // 77 covers Shift|Ctrl|Alt|Super
        this._keyBind              = ''; // can be set by the external trigger which provides the keyboard shortcut

        this._keyboardTriggered    = true; // can be set to false if mouse was used to trigger AATWS
        this._positionPointer      = false; // will be updated in show()
        this._dashMode             = false; // will be updated in show()

        // current screen scale factor that also affects margins
        this.SCALE_FACTOR          = St.ThemeContext.get_for_stage(global.stage).scaleFactor;

        // ///////////////////////////////////////////////
        // Runtime variables

        // Window switcher
        this._winFilterMode        = opt.WIN_FILTER_MODE;
        this._groupMode            = opt.GROUP_MODE;

        // App switcher
        this._appFilterMode        = opt.APP_FILTER_MODE;
        this._includeFavorites     = opt.INCLUDE_FAVORITES;

        // Other
        this._switcherMode         = Enum.SwitcherMode.WINDOWS;
        this._popupPosition        = opt.POPUP_POSITION;
        this._monitorIndex         = this._getMonitorIndex();
        this._searchActive         = opt.SEARCH_DEFAULT;
        this._searchQuery          = this._searchActive ? '' : null;
        this._previewSelected      = opt.PREVIEW_SELECTED;
        this._defaultGrouping      = this._groupMode; // remember default sorting
        this._initialSelectionMode = opt.WIN_SORTING_MODE === Enum.SortingMode.STABLE_SEQUENCE ? Enum.SelectMode.ACTIVE : Enum.SelectMode.SECOND;

        this._showApps             = false;
        this._singleApp            = null;
        this._selectedIndex        = -1;    // deselect
        this._firstRun             = true;
        this._favoritesMRU         = true;
        this._lastActionTimeStamp  = 0;
        this._updateInProgress     = false;
        this._skipInitialSelection = false;
        this._allowFilterSwitchOnOnlyItem = false;

        opt.cancelTimeout           = false;

        Main.layoutManager.aatws = this;

        global.workspace_manager.connectObject('workspace-switched', this._onWorkspaceChanged.bind(this), this);
        Main.overview.connectObject('showing', () => this.fadeAndDestroy(), this);
        this._connectNewWindows();

        this._timeoutIds = {};
    },

    _getMonitorIndex() {
        switch (opt.get('switcherPopupMonitor')) {
        case 2:
            return Util.getCurrentMonitorIndex();
        case 3:
            return global.display.get_current_monitor();
        default:
            return global.display.get_primary_monitor();
        }
    },

    _getPanelPlacement() {
        const panelBox = Main.layoutManager.panelBox;
        const panelVisible = Main.panel.visible && panelBox.visible && panelBox.get_parent() === Main.layoutManager.uiGroup;
        const panelHorizontal = (panelBox.width / panelBox.height) > 1;
        this._monitorGeometry      = global.display.get_monitor_geometry(this._monitorIndex);
        return [
            panelVisible && panelBox.y === this._monitorGeometry.y && panelHorizontal,
            panelVisible && panelBox.allocation.y2 === (this._monitorGeometry.y + this._monitorGeometry.height) && panelHorizontal,
        ];
    },

    _onWorkspaceChanged() {
        if (!this._doNotUpdateOnNewWindow)
            this._updateOnWorkspaceSwitched();
    },

    _updateOnWorkspaceSwitched(callback) {
        if (this._timeoutIds.wsSwitcherAnimationDelayId)
            GLib.source_remove(this._timeoutIds.wsSwitcherAnimationDelayId);

        this._timeoutIds.wsSwitcherAnimationDelayId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            // re-build the switcher after workspace switcher animation to avoid stuttering
            250 * St.Settings.get().slow_down_factor,
            () => {
                this._winFilterMode = opt.WIN_FILTER_MODE;
                this._updateSwitcher();
                if (callback)
                    callback();

                this._timeoutIds.wsSwitcherAnimationDelayId = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    },

    _connectNewWindows() {
        this._newWindowConId = global.display.connect_after('window-created', this._onNewWindowCreated.bind(this));
    },

    _onNewWindowCreated(w, win) {
        if (this._doNotUpdateOnNewWindow)
            return;

        // new window has been created but maybe not yet realized
        const winActor = win.get_compositor_private();
        if (!winActor.realized) {
            if (this._realize?.id)
                this._realize.winActor.disconnect(this._realize.id);

            this._realize = { winActor };

            this._realize.id = winActor.connect('realize', () => {
                this._updateSwitcher();
                this._realize.winActor.disconnect(this._realize.id);
                this._realize = null;
            });
        } else {
            this._updateSwitcher();
        }
    },

    show(backward, binding, mask) {
        if (this._updateInProgress)
            return false;
        this._updateInProgress = true;

        this._inputHandler._remapOverlayKeyIfNeeded();

        if (this._firstRun) {
            this._pushModalCustom();

            // Update run-time variables
            const externalTrigger = this.CHCE_TRIGGERED !== undefined ? this.CHCE_TRIGGERED : this._externalTrigger; // backward compatibility
            this._keyboardTriggered = this.KEYBOARD_TRIGGERED !== undefined ? this.KEYBOARD_TRIGGERED : this._keyboardTriggered; // backward compatibility
            this._dashMode = !this._keyboardTriggered || (this._keyboardTriggered && this._overlayKeyTriggered);
            this._positionPointer = opt.POSITION_POINTER && externalTrigger && !this._keyboardTriggered;
            this._includeFavorites = this._dashMode ? opt.DASH_APP_INCLUDE_FAVORITES : this._includeFavorites;
        }

        this._updateFilterMode();
        this._handleSingleAppMode(binding);
        this._storePointerPosition();

        let itemList = this._getAdjustedItemList();
        if (!itemList.length)
            return false;

        this._updateSwitcherList(itemList);

        // Need to force an allocation so we can figure out whether we
        // need to scroll when selecting
        this.visible = true;
        this.opacity = 0;
        this.get_allocation_box();

        this._setInitialSelection(backward, binding);

        if (this._resetNoModsTimeoutOrFinish(binding, mask))
            return true;

        this._updateStyle();
        this._updateCaptionLabelOpacity();
        this._wsTmb?.remove_all_transitions();
        this._setSwitcherStatus();

        this._showPopup();

        this._showSearchCaptionIfNeeded();

        this._firstRun = false;
        this._updateInProgress = false;
        return true;
    },

    _pushModalCustom() {
        if (this._pushModal())
            return;

        // workarounds releasing already grabbed input on X11
        const focusWin = global.display.get_focus_window();
        // calling focus() can release the input of full-screen VBox machine with control panel
        if (focusWin)
            focusWin.focus(global.get_current_time());

        if (this._pushModal())
            return;

        // steal the input first and try to pushModal later
        global.stage.set_key_focus(this);

        this._timeoutIds.pushModal = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            // delay cannot be too short
            // if system is busy, pushModal may fail again
            200,
            () => {
                if (!this._pushModal()) {
                    console.error(`[${Me.metadata.name}] Error: Unable to grab input, AATWS failed to pop up`);
                    this.destroy();
                }

                this._timeoutIds.pushModal = 0;
                return GLib.SOURCE_REMOVE;
            }
        );
    },

    _pushModal() {
        let result = true;
        let grab = Main.pushModal(this);
        // We expect at least a keyboard grab here
        if ((grab.get_seat_state() & Clutter.GrabState.KEYBOARD) === 0) {
            Main.popModal(grab);
            result = false;
        }
        this._grab = grab;
        this._haveModal = true;
        this._haveModal = result;
        return result;
    },

    _resetNoModsTimeoutOrFinish(binding, mask) {
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
                    this._finish();
                    return true;
                }
            }
        } else {
            this._resetNoModsTimeout();
        }
        return false;
    },

    _updateStyle() {
        if (opt.colorStyle.SWITCHER_LIST)
            this._switcherList.add_style_class_name(opt.colorStyle.SWITCHER_LIST);

        // if switcher switches the filter mode, color the popup border to indicate current filter - red for MONITOR, orange for WS, green for ALL
        if (this._filterSwitched && !opt.STATUS && !(this._showingApps && this._searchQuery)) {
            let fm = this._showingApps ? this._appFilterMode : this._winFilterMode;
            fm = this._listProvider._currentFilterMode ?? fm;

            if (fm === Enum.FilterMode.MONITOR || (fm === Enum.FilterMode.WORKSPACE && (Main.layoutManager.monitors.length < 2)))
                this._switcherList.add_style_class_name('switcher-list-monitor');
            else if (fm === Enum.FilterMode.WORKSPACE)
                this._switcherList.add_style_class_name('switcher-list-workspace');
            else if (fm === Enum.FilterMode.ALL)
                this._switcherList.add_style_class_name('switcher-list-all');

            // Compensate for the thicker border to prevent switcher from moving on filter changed
            if (!this._marginsCorrected) {
                this.MARGIN_TOP -= 1;
                this.MARGIN_BOTTOM -= 1;
                this._marginsCorrected = true;
            }
        }

        this._switcherList._rightArrow.add_style_class_name(opt.colorStyle.ARROW);
        this._switcherList._leftArrow.add_style_class_name(opt.colorStyle.ARROW);

        const themeNode = this._switcherList.get_theme_node();
        const padding = Math.round(themeNode.get_padding(St.Side.BOTTOM) / 2 / this.SCALE_FACTOR);
        if (this._firstRun) {
            if (this._positionPointer) {
                this.MARGIN_TOP = 2;
                this.MARGIN_BOTTOM = 2;
            } else if (this._popupPosition === Enum.Position.TOP) {
                if (this.PANEL_TOP)
                    this.MARGIN_TOP = Math.round(Main.panel.height / this.SCALE_FACTOR + 4);
            } else if (this._popupPosition === Enum.Position.BOTTOM) {
                if (this.PANEL_BOTTOM)
                    this.MARGIN_BOTTOM = Math.round(Main.panel.height / this.SCALE_FACTOR + 4);
            }
        }
        this._switcherList.set_style(`margin-top: ${this.MARGIN_TOP}px; margin-bottom: ${this.MARGIN_BOTTOM}px; padding-bottom: ${padding}px;`);
    },

    _updateCaptionLabelOpacity() {
        // avoid showing overlay label before the switcher popup
        if (this._firstRun && this._itemCaption)
            this._itemCaption.opacity = 0;
        else if (this._itemCaption)
            this._itemCaption.opacity = 255;
    },

    _showSearchCaptionIfNeeded() {
        if (this._searchQuery === '' && !this._searchActive)
            CaptionLabel.showSearchCaption(_('Type to search'), this, opt);
    },

    _showPopup() {
        // We delay showing the popup so that fast Alt+Tab users aren't
        // disturbed by the popup briefly flashing.
        // but not when we're just overriding already shown content
        if (this._firstRun) {
            // build ws thumbnails if enabled
            this._showWsThumbnails();
            // timeout in which click on the switcher background acts as 'activate' despite configuration
            // for quick switch to recent window when triggered using mouse and top/bottom popup position
            this._recentSwitchTime = Date.now() + 300;
            // the initial delay needs to include the time spent so far
            const delay = Math.max(0, opt.INITIAL_DELAY - (Date.now() - this._initTime));
            this._initialDelayTimeoutId = GLib.timeout_add(
                GLib.PRIORITY_HIGH,
                this._dashMode ? 0 : delay,
                () => {
                    if (this._dashMode) {
                        this._animateIn();
                    } else {
                        this._itemCaption?.set_opacity(255);
                        this.opacity = 255;
                        this._inputHandler._setInputTimeout();
                    }

                    this._initialDelayTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                }
            );

            GLib.Source.set_name_by_id(this._initialDelayTimeoutId, '[gnome-shell] Main.osdWindow.cancel');
        } else {
            this.opacity = 255;
            if (this._searchQuery)
                CaptionLabel.showSearchCaption(this._searchQuery, this, opt);
            else if (this._searchQuery === '')
                this._searchCaption?.hide();
        }

        Main.osdWindowManager.hideAll();
    },

    _updateFilterMode() {
        // if only one monitor is connected, then filter MONITOR is redundant to WORKSPACE, therefore MONITOR mode will be ignored
        if (Main.layoutManager.monitors.length < 2) {
            if (this._winFilterMode === Enum.FilterMode.MONITOR)
                this._winFilterMode = Enum.FilterMode.WORKSPACE;

            if (this._appFilterMode === Enum.FilterMode.MONITOR)
                this._appFilterMode = Enum.FilterMode.WORKSPACE;
        }

        // set filter for both switchers to the value of the currently activated switcher if requested
        if (this._firstRun && opt.SYNC_FILTER) {
            if (this._switcherMode === Enum.SwitcherMode.APPS)
                this._winFilterMode = this._appFilterMode;
            else
                this._appFilterMode = this._winFilterMode;
        }
    },

    _handleSingleAppMode(binding) {
        if (binding === 'switch-group' || binding === 'switch-group-backward') {
            let id, name;
            // let metaWin = global.display.get_tab_list(Meta.WindowType.NORMAL, null)[0];
            const metaWin = Util.getWindows(null)[0];
            if (metaWin) {
                const app = Util.getWindowApp(metaWin);
                id = app.get_id();
                name = app.get_name();
            }
            if (id) {
                this._singleApp = { id, name };
                this._showApps = false;
            } else {
                this._singleApp = null;
            }
        }
    },

    _storePointerPosition() {
        if (!this._pointer) {
            this._pointer = [];
            [this._pointer.x, this._pointer.y] = global.get_pointer();
        }
    },

    _setInitialSelection(backward) {
        const recentWindow = Util.getWindows(null)[0];
        if (this._searchQuery) {
            if (!this._showingApps) {
                // if the first window in the list is the current one, select the second window
                const firstWindow = this._reverseOrder ? this._items[this._items.length - 1].window : this._items[0].window;
                if (firstWindow && firstWindow.get_id() === recentWindow.get_id())
                    this._initialSelectionMode = Enum.SelectMode.SECOND;
                else
                    this._initialSelectionMode = Enum.SelectMode.FIRST;
            } else {
                this._initialSelectionMode = Enum.SelectMode.FIRST;
            }
            // avoid immediate switch to recent window when Show Win Preview mode is active
        }

        // if all windows are minimized, the first on the list is the previously used
        if (this._firstRun && this._items[0].window && this._items[0].window.minimized)
            this._initialSelectionMode = Enum.SelectMode.FIRST;

        if (!this._searchQuery && this._initialSelectionMode === Enum.SelectMode.NONE)
            this._initialSelectionMode = Enum.SelectMode.ACTIVE;

        if (!this._skipInitialSelection /* || this._searchQuery !== null*/)
            this._initialSelection(backward);
    },

    _initialSelection(backward) {
        if (this._skipInitialSelection) {
            this._skipInitialSelection = false;
            return;
        }

        if (this._items.length === 1 && this._switcherList) {
            this._select(0);
            return;
        }

        let reverse = this._shouldReverse();

        // if items are grouped by workspace, select next item on the current ws
        if (this._groupMode === Enum.GroupMode.WORKSPACES && !this._showingApps && opt.WIN_SORTING_MODE === Enum.SortingMode.MRU) {
            this._selectNextOnCurrentWs(reverse);
            return;
        }

        if (this._initialSelectionMode === Enum.SelectMode.ACTIVE) {
            this._select(this._getFocusedItemIndex());
            return;
        }

        if (backward) {
            this._select(this._items.length - 1);
            return;
        }

        // (revers && backwards) should never happen since reverse is mouse option and backward kbd only
        if (this._initialSelectionMode === Enum.SelectMode.SECOND) {
            if (!reverse) {
                this._select(1);
            } else if (reverse) {
                this._select(this._items.length - 2);
                this._switcherList._scrollToRight(this._items.length - 1);
            }
        } else if (this._initialSelectionMode === Enum.SelectMode.FIRST) {
            if (!reverse)
                this._select(0);
            else
                this._select(this._items.length - 1);
        } else if (this._initialSelectionMode === Enum.SelectMode.NONE && reverse) {
            // if reversed and list longer than display, move to the last (reversed first) item
            this._switcherList._scrollToRight(this._items.length - 1);
        }
    },

    _selectNextOnCurrentWs(reverse) {
        const activeWs = global.workspace_manager.get_active_workspace();
        if (!reverse) {
            for (let i = 0; i < this._items.length; i++) {
                if (this._items[i].window.get_workspace() === activeWs) {
                    let index = i;
                    if (this._initialSelectionMode === Enum.SelectMode.SECOND && index + 1 < this._items.length)
                        index = i + 1;

                    this._select(index);
                    break;
                }
            }
        } else {
            for (let i = this._items.length - 1; i >= 0; i--) {
                if (this._items[i].window.get_workspace() === activeWs) {
                    let index = i;
                    if (this._initialSelectionMode === Enum.SelectMode.SECOND && index > 0)
                        index = i - 1;

                    this._select(index);
                    break;
                }
            }
        }
    },

    _shouldReverse() {
        if (this._keyboardTriggered || !opt.REVERSE_AUTO)
            return false;

        if (this._reverseOrder)
            return true;

        let geometry = this._monitorGeometry;
        let mousePointerX = global.get_pointer()[0];
        let diff = geometry.x + geometry.width - mousePointerX;
        let reverse = diff < 100;
        this._reverseOrder = reverse;

        return reverse;
    },

    _updateSwitcherList(itemList) {
        if (this._switcherList)
            this._switcherList.destroy();

        this._switcherList = new SwitcherList.SwitcherList(itemList, opt, this);
        // this._switcherList._list.vertical = true;

        if (!opt.HOVER_SELECT && this._keyboardTriggered)
            this._switcherList._itemEntered = function () {};

        this._items = this._switcherList.icons;

        this._connectIcons();

        this._switcherList.connect('item-activated', this._itemActivated.bind(this));
        this._switcherList.connect('item-entered', this._itemEntered.bind(this));
        this._switcherList.connect('item-removed', this._itemRemoved.bind(this));
        this._switcherList.connect('destroy', () => {
            this._switcherList = null;
        });
        this._switcherList.reactive = true;
        const enterConId = this._switcherList.connect('enter-event', () => {
            if (!this._scrollByPointerOvershootAdded)
                this._addScrollByPointerOvershoot();

            opt.cancelTimeout = false;

            // This connection is no longer needed
            this._switcherList.disconnect(enterConId);
        });

        this.add_child(this._switcherList);

        // If the dash mode popup has been opened using the mouse outside the popup,
        // wait until the pointer hovers over the popup to start the timeout
        if (this._firstRun && this._dashMode && !this._overlayKeyTriggered && this._inputHandler.isPointerOut())
            opt.cancelTimeout = true;
    },

    _addScrollByPointerOvershoot() {
        const switcherList = this._switcherList;
        if (!switcherList || this._scrollByPointerOvershootAdded)
            return;

        // Scrolling by overshooting mouse pointer over the left/right edge is not implemented since GNOME 40
        // Following workaround is about moving pointer over the edge area of the switcher to scroll the list
        if (switcherList._rightArrow.opacity || switcherList._leftArrow.opacity) {
            const activeWidth = 5;
            switcherList.connect('motion-event', () => {
                if (switcherList._scrollView.get_hscroll_bar().adjustment.get_transition('value'))
                    return;

                const pointerX = global.get_pointer()[0];

                if (switcherList._scrollableRight && this._selectedIndex < (this._items.length - 1) && pointerX > (switcherList.allocation.x2 - activeWidth))
                    this._select(this._next(true));
                else if (switcherList._scrollableLeft && this._selectedIndex > 0 && pointerX < (switcherList.allocation.x1 + activeWidth))
                    this._select(this._previous(true));
            });
            this._scrollByPointerOvershootAdded = true;
        }
    },

    _connectIcons() {
        this._iconsConnections = [];
        this._switcherList._items.forEach(switcherButton => {
            this._iconsConnections.push(switcherButton.connect('button-press-event', this._onItemBtnPressEvent.bind(this)));
            this._iconsConnections.push(switcherButton.connect('scroll-event', this._onItemScrollEvent.bind(this)));
            // connect ShowAppsIcon
            if (switcherButton.get_child().toggleButton) {
                switcherButton.get_child().toggleButton.connect('notify::checked', () => {
                    this.fadeAndDestroy();
                    this._actions.toggleAppGrid();
                });
            }
        });
    },

    _onDestroy() {
        this._doNotUpdateOnNewWindow = true;

        this._popModal();

        // Remove connections
        this._realize?.winActor.disconnect(this._realize.id);
        if (this._newWindowConId)
            global.display.disconnect(this._newWindowConId);

        global.workspace_manager.disconnectObject(this);

        Main.overview.disconnectObject(this);

        // remove inherited timeouts
        if (this._motionTimeoutId)
            GLib.source_remove(this._motionTimeoutId);
        if (this._initialDelayTimeoutId)
            GLib.source_remove(this._initialDelayTimeoutId);
        if (this._noModsTimeoutId)
            GLib.source_remove(this._noModsTimeoutId);

        // remove all local timeouts
        if (this._timeoutIds) { // Tiling assistant compatibility
            Object.values(this._timeoutIds).forEach(id => {
                if (id)
                    GLib.source_remove(id);
            });
        }

        this._removeCaptions();
        this._destroyWinPreview();

        if (this._wsTmb) {
            this.remove_child(this._wsTmb);
            this._wsTmb = null;
        }

        // Make sure the SwitcherList is always destroyed, it may not be
        // a child of the actor at this point.
        this._switcherList?.destroy();

        this._inputHandler?.clean();
        this._inputHandler = null;

        this._actions?.clean();
        this._actions = null;

        Main.layoutManager.aatws = null;
    },

    _destroyWinPreview() {
        if (this._winPreview) {
            this._winPreview.destroy();
            this._winPreview = null;
        }
    },

    _removeCaptions() {
        if (this._itemCaption) {
            this._itemCaption.destroy();
            this._itemCaption = null;
        }

        if (this._searchCaption) {
            this._searchCaption.destroy();
            this._searchCaption = null;
        }
    },

    _itemRemoved(switcher, n) {
        // n is -1 when this._showingApps
        if (n === -1)
            this._delayedUpdate(200);
        else
            this._itemRemovedHandler(n);
    },

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
            this._resetOnEmptyList();
            this.show();
        }
    },

    _resetOnEmptyList() {
        if (!this._singleApp)
            return;

        if (this._searchQuery) {
            this._searchQuery = '';
        } else {
            this._singleApp = null;
            if (this._switcherMode === Enum.SwitcherMode.APPS)
                this._showApps = true;
        }
    },

    _itemEntered(switcher, n) {
        if (!this.mouseActive)
            return;
        const item = this._items[n];
        // avoid unnecessary reentrance, reenter only when close button needs to be displayed
        if (!(this._selectedIndex === n && (item._closeButton && item._closeButton.opacity === 255)) ||
             (this._selectedIndex === n && !item._closeButton))
            this._itemEnteredHandler(n);
        if (this._switcherList._updateMouseControls) // Prevent error if used by the Tiling assistant
            this._switcherList._updateMouseControls(n);
    },

    vfunc_allocate(box) {
        // Prevent updating the allocation if switcherList is being destroyed
        if (!this._switcherList)
            return;

        let monitor = Util.getMonitorByIndex(this._monitorIndex);
        box.set_size(monitor.width, monitor.height);

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

        if (this._positionPointer) {
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
            if (this._popupPosition === Enum.Position.TOP)
                offset = 0;
            if (this._popupPosition === Enum.Position.BOTTOM)
                offset = monitor.height - childNaturalHeight;
            childBox.y1 = monitor.y + offset;
        }

        childBox.x2 = Math.min(monitor.x + monitor.width, childBox.x1 + childNaturalWidth);
        childBox.y2 = childBox.y1 + childNaturalHeight;

        this._switcherList.allocate(childBox);

        if (this._wsTmb) {
            const SIZE = 110;
            const wsTmb = this._wsTmb;

            let height = SIZE;
            let [, width] = wsTmb.get_preferred_width(height);
            [, height] = wsTmb.get_preferred_height(width);

            width = Math.min(width, monitor.width);

            let x = monitor.x + (monitor.width - width) / 2;
            let y;
            const yOffset = opt.ITEM_CAPTIONS !== Enum.TooltipTitle.DISABLE ? 60 : 20;
            if (this._popupPosition === Enum.Position.BOTTOM)
                y = this._switcherList.allocation.y1 - height - yOffset;
            else if (this._popupPosition === Enum.Position.TOP || this._popupPosition === Enum.Position.CENTER)
                y = this._switcherList.allocation.y2 + yOffset;

            childBox.set_origin(x, y);
            childBox.set_size(width, height);

            wsTmb.allocate(childBox);
        }

        if (this._itemCaption) {
            this._setCaptionAllocationBox(this._itemCaption, childBox, monitor);
            this._itemCaption.allocate(childBox);
        }

        if (this._searchCaption) {
            this._setCaptionAllocationBox(this._searchCaption, childBox, monitor);
            this._searchCaption.allocate(childBox);
        }
    },

    _setCaptionAllocationBox(caption, childBox, monitor) {
        let index = this._selectedIndex;
        // get item position on the screen and calculate center position of the label
        let actor, xPos;
        if (opt.ITEM_CAPTIONS === Enum.TooltipTitle.ITEM && caption === this._itemCaption)
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
    },

    _getAdjustedItemList() {
        let itemList = this._listProvider.getItemList(this._searchQuery);

        if (!itemList.length && this._searchQuery) {
            // no results -> back to the last successful pattern
            this._searchQuery = this._searchQuery.slice(0, -1);
            this._listProvider._currentFilterMode = null;
            itemList = this._listProvider.getItemList(this._searchQuery);
        }

        if (this._shouldReverse())
            itemList.reverse();

        this._listProvider._currentFilterMode = null;
        this._showingApps = !itemList[0]?.get_title;

        return itemList;
    },

    _animateIn() {
        let translationY = 0;
        switch (this._popupPosition) {
        case Enum.Position.TOP:
            translationY -= this._switcherList.height +
                        (this.PANEL_TOP ? (Main.panel.height + this.MARGIN_TOP) / this.SCALE_FACTOR : this.MARGIN_TOP);
            break;
        case Enum.Position.BOTTOM:
            translationY = this._switcherList.height +
                        (this.PANEL_TOP ? (Main.panel.height + this.MARGIN_BOTTOM) / this.SCALE_FACTOR : this.MARGIN_BOTTOM);
            break;
        }
        this._switcherList.translation_y = translationY;
        if (this._wsTmb)
            this._wsTmb.scale_y = 0;

        this.opacity = 255;
        this._switcherList.opacity = 255;

        if (this._itemCaption)
            this._itemCaption.opacity = 0;

        this._inAnimation = true;
        this._switcherList.ease({
            translation_y: 0,
            duration: ANIMATION_TIME * opt.ANIMATION_TIME_FACTOR,
            mode: Clutter.AnimationMode.EASE_OUT_QUAD,
            onComplete: () => {
                if (this._wsTmb) {
                    this._wsTmb.opacity = 0;
                    this._wsTmb.ease({
                        opacity: 255,
                        scale_y: 1,
                        duration: ANIMATION_TIME * opt.ANIMATION_TIME_FACTOR / 2,
                        mode: Clutter.AnimationMode.EASE_OUT_QUAD,
                        onStopped: () => {
                            this._wsTmb.opacity = 255;
                            this._wsTmb.scale_y = 1;
                        },
                    });
                }
                if (this._overlayKeyTriggered && this._itemCaption)
                    this._itemCaption.opacity = 255;

                this._inAnimation = false;
                this._timeoutIds.setInputDelay = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    20,
                    () => {
                        this._inputHandler.setInput();
                        this._timeoutIds.setInputDelay = 0;
                    }
                );
            },
        });
    },

    _animateOut() {
        if (this._itemCaption)
            this._itemCaption.opacity = 0;

        this._popModal();

        let translationY = 0;
        let opacity = 255;
        if (this._positionPointer) {
            translationY = 0;
            opacity = 0;
        }

        if (this._switcherList) {
            switch (this._popupPosition) {
            case Enum.Position.TOP:
                translationY -= this._switcherList.height +
                            (this.PANEL_TOP ? (Main.panel.height + this.MARGIN_TOP) / this.SCALE_FACTOR : this.MARGIN_TOP);
                break;
            case Enum.Position.BOTTOM:
                translationY = this._switcherList.height +
                            (this.PANEL_BOTTOM ? (Main.panel.height + this.MARGIN_BOTTOM) / this.SCALE_FACTOR : this.MARGIN_BOTTOM);
                break;
            }

            this._switcherList.ease({
                translation_y: translationY,
                duration: ANIMATION_TIME / 2 * opt.ANIMATION_TIME_FACTOR,
                mode: Clutter.AnimationMode.EASE_IN_QUAD,
                onComplete: () => {
                    this.destroy();
                },
            });

            if (this._wsTmb) {
                this._wsTmb.ease({
                    duration: ANIMATION_TIME / 2 * opt.ANIMATION_TIME_FACTOR,
                    mode: Clutter.AnimationMode.EASE_IN_QUAD,
                    translation_y: opacity ? this._switcherList.allocation.y2 - this._wsTmb.y : 0,
                    opacity,
                });
            }
        } else {
            this.destroy();
        }
    },

    fadeAndDestroy() {
        this._popModal();

        if (this._itemCaption)
            this._itemCaption.opacity = 0;

        if (this.opacity > 0 && this._dashMode)
            this._animateOut();
        else if (this._timeoutIds) // Tiling assistant compatibility
            this._delayedDestroy();
        else
            this.destroy();
    },

    // Avoid no stage errors when user is too fast
    _delayedDestroy() {
        if (this._timeoutIds.delayedDestroy)
            GLib.source_remove(this._timeoutIds.delayedDestroy);

        this._timeoutIds.delayedDestroy = GLib.idle_add(
            GLib.PRIORITY_DEFAULT,
            () => {
                this._timeoutIds.delayedDestroy = 0;
                this.destroy();
                return GLib.SOURCE_REMOVE;
            }
        );
    },

    _finish() {
        if (this._timeoutIds.showWinImmediately) {
            GLib.source_remove(this._timeoutIds.showWinImmediately);
            this._timeoutIds.showWinImmediately = 0;
        }

        this._doNotShowWin = true;
        this._doNotUpdateOnNewWindow = true;
        const selected = this._getSelectedTarget();
        const hasFocus = this._selectedHasFocus(selected);

        if (this._showingApps && selected) {
            if (this._shouldToggleSingleAppMode(selected)) {
                this._toggleSingleAppMode();
                return;
            } else if (selected.cachedWindows?.length) {
                this._activateApp(selected);
            } else if (selected.get_n_windows) {
                this._launchApp(selected);
            } else if (selected._isShowAppsIcon) {
                this._actions.toggleAppGrid();
                return;
            } else if (selected._isSysActionIcon) {
                selected.activate();
            }
        } else if (selected) {
            this._inputHandler.setInput('reset');
            this._activateWindow(selected);
        }

        this.fadeAndDestroy();
        if (this._shouldFadeAndDestroy(hasFocus))
            this.fadeAndDestroy();
        else
            this._doNotUpdateOnNewWindow = false;
    },

    _shouldToggleSingleAppMode(selected) {
        const focus = global.display.get_tab_list(0, null)[0];
        return  selected?.cachedWindows?.length &&
                !_shiftPressed() && !_ctrlPressed() &&
                this._dashMode &&
                opt.LIST_WINS_ON_ACTIVATE &&
                ((opt.LIST_WINS_ON_ACTIVATE === Enum.ListOnActivate.FOCUSED_MULTI_WINDOW && selected.cachedWindows.length > 1 && selected.cachedWindows.includes(focus)) ||
                 (opt.LIST_WINS_ON_ACTIVATE === Enum.ListOnActivate.FOCUSED && selected.cachedWindows[0] === focus)) &&
                selected.cachedWindows[0].get_workspace() === global.workspace_manager.get_active_workspace();
    },

    _selectedHasFocus(selected) {
        const window = selected.cachedWindows?.length ? selected.cachedWindows[0] : selected;
        const focus = global.display.get_tab_list(0, null)[0];
        return window === focus;
    },

    _shouldFadeAndDestroy(hasFocus) {
        return  !this._dashMode || (this._dashMode && !this._showingApps) || hasFocus ||
                opt.ACTIVATE_ON_HIDE; /* ||
                (!this._keyboardTriggered && !opt.LIST_WINS_ON_ACTIVATE)*/
    },

    _activateApp(selected) {
        if (!opt.APP_RAISE_FIRST_ONLY) {
            // The following line not only activates the app recent window, but also rise all other windows of the app above other windows
            // selected.activate_window(selected.cachedWindows[0], global.get_current_time());
            // However, if the item is activated without key/button press (ACTIVATE_ON_HIDE), only the first window is raised, so we need to raise the windows manually

            const wins = selected.cachedWindows;
            for (let i = wins.length - 1; i >= 0; i--)
                wins[i].raise();
        }

        this._inputHandler.setInput('reset');
        this._activateWindow(selected.cachedWindows[0]);
    },

    _launchApp(selected) {
        if (!selected.get_n_windows()) {
            // app has no windows - probably not running
            selected.activate();
        } else {
            // app is running but no window match the current filter mode
            selected.open_new_window(-1);
        }
    },

    _activateWindow(metaWin) {
        const wsSwitched = global.workspaceManager.get_active_workspace_index() !== metaWin.get_workspace()?.index();
        Main.activateWindow(metaWin);
        if (wsSwitched) { // && this.SHOW_WS_POPUP) {
            this._actions.showWsSwitcherPopup();
        }
    },

    _onWindowItemAppClicked(actor, event) {
        const button = event.get_button();
        if (button === Clutter.BUTTON_PRIMARY) {
            this._toggleSingleAppMode();
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    },

    _updateSwitcher(winToApp) {
        const selected = this._getSelectedTarget();
        let id;

        if (winToApp) // Switching mode Win -> App
            id = Util.getWindowApp(selected)?.get_id() ?? null;
        else if (winToApp === false) // Switching mode App -> Win
            id = selected?.cachedWindows ? selected.cachedWindows[0]?.get_id() : null;
        else // Update without switching the switcher mode
            id = this._getSelectedID();

        this.show();
        let index = this._getItemIndexByID(id);
        if (index === -1)
            index = 0;
        this._select(index);
        if (opt.PREVIEW_SELECTED === Enum.PreviewMode.DISABLE)
            this._destroyWinPreview();
    },

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
    },

    _setSwitcherStatus() {
        if (!opt.STATUS)
            return;

        let filterMode = this._showingApps ? this._appFilterMode : this._winFilterMode;
        filterMode = this._listProvider._currentFilterMode; //  ?? filterMode;

        this._switcherList._statusLabel.set_text(
            `${_('Filter: ')}${FilterModeLabel[filterMode]
            }${this._singleApp ? `/${_('APP')}` : ''},  ${
                _('Group:')} ${this._showingApps ? 'No' : GroupModeLabel[this._groupMode]}, ${
                _('Sort:')} ${this._showingApps ? SortingModeLabel[opt.APP_SORTING_MODE] : SortingModeLabel[opt.WIN_SORTING_MODE]}, ${
                _('Search:')} ${this._searchQuery === null ? 'Off' : 'On'}${
                this._activeInput ? `, ${_('Keyboard:')} ${this._activeInput}` : ''}`
        );
    },

    _resetNoModsTimeout() {
        if (this._noModsTimeoutId)
            GLib.source_remove(this._noModsTimeoutId);

        this._noModsTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            opt.NO_MODS_TIMEOUT,
            () => {
                const shouldFinish =    this._dashMode &&
                                        !this._overlayKeyTriggered &&
                                        this._inputHandler.isPointerOut() &&
                                        !opt.cancelTimeout;
                if (shouldFinish) {
                    if (opt.ACTIVATE_ON_HIDE)
                        this._finish();
                    else
                        this.fadeAndDestroy();

                    this._noModsTimeoutId = 0;
                    return GLib.SOURCE_REMOVE;
                } else {
                    this._resetNoModsTimeout();
                }
                return GLib.SOURCE_CONTINUE;
            }
        );
    },

    _getFocusedItemIndex() {
        // const metaWin = global.display.get_tab_list(Meta.TabList.NORMAL, null)[0];
        const metaWin = Util.getWindows(null)[0];
        if (!metaWin)
            return 0;

        let id;
        let pt;

        if (this._items[0]._isWindow) {
            id = metaWin.get_id();
            pt = 'window';
        } else {
            id = Util.getWindowApp(metaWin).get_id();
            pt = 'app';
        }
        for (let i = 0; i < this._items.length; i++) {
            if (this._items[i]._isShowAppsIcon)
                continue;
            if (this._items[i][pt].get_id() === id)
                return i;
        }

        return 0;
    },

    _getSelectedID() {
        let item = this._items[this._selectedIndex > -1 ? this._selectedIndex : null];
        return item._id;
    },

    _select(index) {
        if (!this._switcherList || index === this._highlighted || index < 0)
            return;

        this._selectedIndex = index;
        this._switcherList.highlight(index);
        // don't slow down showing the popup
        if (opt.ITEM_CAPTIONS !== Enum.TooltipTitle.DISABLE)
            CaptionLabel.showTitleCaption(this, opt);

        this._destroyWinPreview();
        if (this._previewSelected === Enum.PreviewMode.PREVIEW)
            this._showPreview();

        this._resetNoModsTimeout();
    },

    _next(reversed = false) {
        if (this._reverseOrder  && !reversed)
            return this._previous(true);

        let step = 1;
        if (!opt.WRAPAROUND && this._selectedIndex === (this._items.length - 1))
            step = 0;

        return mod(this._selectedIndex + step, this._items.length);
    },

    _previous(reversed = false) {
        if (this._reverseOrder && !reversed)
            return this._next(true);

        let step = 1;
        if (!opt.WRAPAROUND && this._selectedIndex === 0)
            step = 0;

        return mod(this._selectedIndex - step, this._items.length);
    },

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
        let winApp = Util.getWindowApp(this._items[selectedIndex].window).get_id();
        let nextApp = null;
        for (let i = selectedIndex; i !== lastIndex + step; i += step) {
            if (Util.getWindowApp(this._items[i].window).get_id() !== winApp) {
                if (!_shiftPressed()) {
                    this._select(i);
                    return;
                } else {
                    // find the first window of the group
                    if (!nextApp)
                        nextApp = Util.getWindowApp(this._items[i].window).get_id();

                    if (Util.getWindowApp(this._items[i].window).get_id() !== nextApp || i === lastIndex) {
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
    },

    _getNextApp() {
        let stableSequence = opt.WIN_SORTING_MODE === Enum.SortingMode.STABLE_SEQUENCE;
        let apps = this._listProvider.getRunningAppsIds(stableSequence);

        if (apps.length === 0)
            return null;

        let currentIndex = apps.indexOf(this._singleApp.id);
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
    },

    _toggleSingleAppMode(switchOn = false) {
        let selected = this._getSelectedTarget();

        if (!selected || selected._isShowAppsIcon || selected._isSysActionIcon)
            return;

        let winToApp;
        if (!this._singleApp || switchOn) {
            if (this._showingApps && selected.cachedWindows) {
                if (!selected.cachedWindows.length)
                    return;

                this._singleApp = { id: selected.get_id(), name: selected.get_name() };
                this._showApps = false;
                if (!opt.SYNC_FILTER)
                    this._winFilterMode = this._appFilterMode;
            } else {
                let id, name;
                const app = Util.getWindowApp(selected);
                if (app) {
                    id = app.get_id();
                    name = app.get_name();
                    this._singleApp = { id, name };
                }
            }
        } else {
            this._singleApp = null;
            this._switcherAppPos = null;
            if (this._switcherMode === Enum.SwitcherMode.APPS) {
                this._showApps = true;
                winToApp = true;
            }

            if (!opt.SYNC_FILTER)
                this._winFilterMode = opt.WIN_FILTER_MODE;
        }

        if (this._singleApp) {
            let item = this._items[this._selectedIndex];
            this._switcherAppPos = Math.floor(item.get_transformed_position()[0]) + item.width / 2;
        }

        this._updateSwitcher(winToApp);
    },

    _toggleSearchMode() {
        // on the first toggle reactivate the search even if it's already active by default
        // since it allows the user to release a modifier key and type freely
        if (this._searchQuery !== null && this._secondarySearchToggle) {
            this._searchQuery = null;
            opt.cancelTimeout = false;
            if (this._searchCaption)
                this._searchCaption.hide();
        } else {
            this._searchQuery = '';
            this._modifierMask = 0;
            opt.cancelTimeout = true;
            this._searchActive = false;
        }

        this._secondarySearchToggle = true;
        this._updateSwitcher();
    },

    _resetSwitcherMode() {
        if (this._switcherMode === Enum.SwitcherMode.WINDOWS)
            this._appFilterMode = opt.get('appSwitcherPopupFilter');
        else
            this._winFilterMode = opt.get('winSwitcherPopupFilter');
    },

    _toggleSwitcherMode() {
        // const selected = this._getSelectedTarget();
        const origModeApps = this._switcherMode === Enum.SwitcherMode.APPS;
        this._switcherMode = origModeApps
            ? Enum.SwitcherMode.WINDOWS
            : Enum.SwitcherMode.APPS;
        this._showApps = !origModeApps;
        this._singleApp = null;

        this._updateSwitcher(this._showApps);
    },

    _switchFilterMode() {
        let filterMode = this._showingApps
            ? this._appFilterMode
            : this._winFilterMode;
        // if active ws has all windows on one monitor, ignore the monitor filter mode to avoid 'nothing happens' when switching between modes
        let m = (Main.layoutManager.monitors.length > 1) && !this._allWsWindowsSameMonitor() ? 3 : 2;
        filterMode -= 1;

        if (filterMode < Enum.FilterMode.ALL)
            filterMode = m;

        if (this._switcherMode === Enum.SwitcherMode.WINDOWS) {
            this._winFilterMode = filterMode;
            if (opt.SYNC_FILTER)
                this._appFilterMode = filterMode;
        } else if (this._singleApp) {
            this._winFilterMode = filterMode;
            this._appFilterMode = filterMode;
        } else {
            this._appFilterMode = filterMode;
            if (opt.SYNC_FILTER)
                this._winFilterMode = filterMode;
        }
        this._allowFilterSwitchOnOnlyItem = false;
        this._filterSwitched = true;
        this._updateSwitcher();
    },

    _switchFilterModePermanent() {
        this._switchFilterMode();
        if (this._switcherMode === Enum.SwitcherMode.APPS)
            opt.set('appSwitcherPopupFilter', this._appFilterMode);
        else
            opt.set('winSwitcherPopupFilter', this._winFilterMode);
    },

    _toggleGroupByWs() {
        if (this._groupMode === Enum.GroupMode.WORKSPACES)
            this._groupMode = this._defaultGrouping;
        else
            this._groupMode = Enum.GroupMode.WORKSPACES;

        this._updateSwitcher();
    },

    _switchWorkspace(direction) {
        let id = this._getSelectedID();
        this._actions.switchWorkspace(direction, true);

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

        if (!this._wsTmb)
            this._actions.showWsSwitcherPopup();
    },

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
    },

    _allWsWindowsSameMonitor() {
        let currentWS = global.workspace_manager.get_active_workspace();
        let windows = Util.getWindows(currentWS);

        if (windows.length === 0)
            return null;

        let ri = windows[0].get_monitor();

        for (let w of windows) {
            if (w.get_monitor() !== ri)
                return false;
        }

        return true;
    },

    _getSelectedTarget() {
        let selected = null;
        if (this._selectedIndex > -1) {
            let it = this._items[this._selectedIndex];
            if (it && it._isWindow)
                selected = it.window;
            else if (it && it._isApp)
                selected = it.app;
            else if (it && it._isShowAppsIcon)
                selected = it;
            else if (it && it._isSysActionIcon)
                selected = it;
        }

        return selected;
    },

    _getItemIndexByID(id) {
        for (let i = 0; i < this._items.length; i++) {
            if (this._items[i]._id === id)
                return i;
        }
        return -1;
    },

    _disableHover() {
        this.mouseActive = false;

        if (this._motionTimeoutId !== 0)
            GLib.source_remove(this._motionTimeoutId);

        this._motionTimeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, DISABLE_HOVER_TIMEOUT, this._mouseTimedOut.bind(this));
        GLib.Source.set_name_by_id(this._motionTimeoutId, '[gnome-shell] this._mouseTimedOut');
    },

    // /////////////////////////////////////////////////////////////////////////////////////////////
    // Key handlers

    vfunc_key_press_event(keyEvent) {
        this._disableHover();
        if (this._inputHandler)
            this._inputHandler.handleKeyPress(keyEvent);
        else // Handle the input from the Tilling assistant AltTab instance
            this._original_key_press_event(keyEvent);
        return Clutter.EVENT_STOP;
    },

    // Tiling assistant compatibility
    _original_key_press_event(event) {
        let keysym = event.get_key_symbol();
        let action = global.display.get_keybinding_action(
            event.get_key_code(), event.get_state());

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
            this._finish(event.get_time());

        return Clutter.EVENT_STOP;
    },

    vfunc_key_release_event(keyEvent) {
        // monitor release of shortcut modifier keys
        if (this._modifierMask) {
            let mods = global.get_pointer()[2];
            let state = mods & this._modifierMask;

            if (state === 0) {
                if (this._selectedIndex !== -1) {
                    // this.blockSwitchWsFunction = true;
                    this._finish();
                } else {
                    this.fadeAndDestroy();
                }
            }
        } else {
            this._resetNoModsTimeout();
        }

        return Clutter.EVENT_STOP;
    },

    // ///////////////////////////////////////////////////////////////////////////////////////////////////
    // Mouse handlers

    vfunc_button_press_event(event) {
        const action = this._inputHandler.getButtonPressAction(event);
        return this._triggerAction(action);
    },

    _onItemBtnPressEvent(actor, event) {
        this._selectClickedItem(actor);
        const action = this._inputHandler.getItemBtnPressAction(event);
        return this._triggerAction(action);
    },

    vfunc_scroll_event(event) {
        let direction = Util.getScrollDirection(event);

        const action = this._inputHandler?.getScrollAction(event);
        // If called from the Tiling assistant, _inputHandler is missing
        if (!action)
            return null;

        if (!this._scrollActionAllowed(action))
            return Clutter.EVENT_STOP;
        this._resetNoModsTimeout();
        this._lastActionTimeStamp = Date.now();
        return this._triggerAction(action, direction);
    },

    _onItemScrollEvent(actor, event) {
        let direction = Util.getScrollDirection(event);
        const action = this._inputHandler.getItemScrollAction(this._showingApps);

        // if scroll doesn't control selection, select the item under the pointer in case the hover selection missed the event
        if (action !== Enum.Actions.SELECT_ITEM)
            this._selectClickedItem(actor);

        if (!this._scrollActionAllowed(action))
            return Clutter.EVENT_STOP;

        this._lastActionTimeStamp = Date.now();
        return this._triggerAction(action, direction);
    },

    // sometimes mouse hover don't select item and click/scroll on the item would activate another (previously selected) item
    _selectClickedItem(item) {
        for (let i = 0; i < this._switcherList._items.length; i++) {
            if (item === this._switcherList._items[i]) {
                this._selectedIndex = i;
                return;
            }
        }
    },

    _scrollActionAllowed(action) {
        const timeout = action === Enum.Actions.SELECT_ITEM
            ? SCROLL_SELECTION_TIMEOUT
            : SCROLL_TIMEOUT;
        if (Date.now() - this._lastActionTimeStamp < timeout)
            return false;
        return true;
    },

    // ////////////////////////////////////////////////////////////////////////////////////////

    _moveFavorites(direction) {
        if ((!this._showingApps && this._includeFavorites) || !this._getSelectedTarget())
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
    },

    _toggleShowPreview() {
        if (this._previewSelected === Enum.PreviewMode.PREVIEW) {
            this._previewSelected = Enum.PreviewMode.DISABLE;
            this._destroyWinPreview();
        } else {
            this._previewSelected = Enum.PreviewMode.PREVIEW;
            this._showPreview();
        }
    },

    _showPreview(toggle = false) {
        let selected = this._getSelectedTarget();
        if (!selected || selected._isShowAppsIcon)
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
            this._winPreview = new Util.WindowPreview();
            global.window_group.add_child(this._winPreview);
            global.window_group.set_child_above_sibling(this._winPreview, null);
        }

        this._winPreview.window = metaWin;
    },

    _showWindow() {
        if (this._doNotShowWin)
            return;
        let selected = this._getSelectedTarget();

        if (!selected || selected._isShowAppsIcon)
            return;

        if (selected.get_windows) {
            if (!selected.cachedWindows.length)
                return;

            selected = selected.cachedWindows[0];
        }

        if (selected.minimized)
            selected.unminimize();

        selected.raise();

        if (global.workspace_manager.get_active_workspace() !== selected.get_workspace()) {
            Main.wm.actionMoveWorkspace(selected.get_workspace());
            if (!this._wsTmb)
                this._actions.showWsSwitcherPopup();
        }
    },

    _groupWindowsByApp() {
        if (this._groupMode !== Enum.GroupMode.APPS) {
            this._groupMode = Enum.GroupMode.APPS;
            this.show();
        }
    },

    _groupCurrentMonFirst() {
        if (this._groupMode !== Enum.GroupMode.CURRENT_MON_FIRST) {
            this._groupMode = Enum.GroupMode.CURRENT_MON_FIRST;
            this.show();
        }
    },

    _openWindowMenu() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._isShowAppsIcon)
            return;

        const windowMenuManager = new WindowMenu.WindowMenuManager(this);
        const item = this._items[this._selectedIndex];

        opt.cancelTimeout = true;

        windowMenuManager.showWindowMenuForWindow(selected, Meta.WindowMenuType.WM, item);
        windowMenuManager.menu.connect('destroy',
            () => {
                opt.cancelTimeout = false;
            }
        );
    },

    _openAppIconMenu() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._isShowAppsIcon)
            return;

        let nWindows = selected.cachedWindows.length;
        let popupItems = [
            [_(`Move ${nWindows} Windows to New Workspace`), () => this._actions.moveWinToNewAdjacentWs(Clutter.ScrollDirection.DOWN)],
            [_(`Move ${nWindows} Windows to Current WS/Monitor`), () => this._actions.moveToCurrentWS()],
            [_('Force Quit'), () => this._actions.killApp(this._getSelectedTarget())],
            [_(`Close ${nWindows} Windows`), () => this._actions.closeAppWindows()],
        ];

        let appIcon = this._items[this._selectedIndex];
        if (appIcon) {
            appIcon.popupMenu();
            if (nWindows && !appIcon._menu._alreadyCompleted) {
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
    },


    _openNewWindow() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._isShowAppsIcon)
            return;

        if (this._showingApps) {
            selected.open_new_window(-1);
        } else {
            selected = Shell.WindowTracker.get_default().get_window_app(selected);
            selected.open_new_window(-1);
        }
    },

    _toggleWinAbove() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._isShowAppsIcon)
            return;

        this._actions.toggleAboveWindow(selected);
        // Main.wm.actionMoveWorkspace(selected.get_workspace());
        this._updateSwitcher();
    },

    _toggleWinSticky() {
        let selected = this._getSelectedTarget();

        if (!selected || selected._isShowAppsIcon)
            return;

        this._actions.toggleStickyWindow(selected);
        this._updateSwitcher();
    },

    _showWsThumbnails() {
        const enabled = opt.WS_THUMBNAILS === 1 || (opt.WS_THUMBNAILS === 2 && this._dashMode);
        if (enabled) {
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
            // wsTmb.add_style_class_name(opt.colorStyle.CAPTION_LABEL);
            this.add_child(wsTmb);
            this.set_child_below_sibling(wsTmb, null);
            this._wsTmb = wsTmb;
        }
    },

    // //////////////////////////////////////////////////////////////////////

    _triggerAction(action, direction = 0) {
        switch (action) {
        case undefined:
            return Clutter.EVENT_PROPAGATE;
        case null:
            return Clutter.EVENT_STOP;
        case Enum.Actions.ACTIVATE:
            if (_shiftPressed() && !_ctrlPressed())
                this._moveToCurrentWS();
            else if (_ctrlPressed() && !_shiftPressed())
                this._openNewWindow();
            else
                this._finish();
            break;
        case Enum.Actions.SELECT_ITEM:
            this._disableHover();
            this._selectOnScroll(direction);
            break;
        case Enum.Actions.SWITCH_FILTER:
            this._switchFilterMode();
            break;
        case Enum.Actions.SWITCH_WS:
            this._switchWorkspace(Util.translateScrollToMotion(direction));
            break;
        case Enum.Actions.SHOW:
            // this._showWindow();
            this._toggleShowPreview();
            break;
        case Enum.Actions.GROUP_APP:
            this._groupWindowsByApp();
            break;
        case Enum.Actions.CURRENT_MON_FIRST:
            this._groupCurrentMonFirst();
            break;
        case Enum.Actions.SINGLE_APP:
            this._toggleSingleAppMode();
            break;
        case Enum.Actions.SWITCHER_MODE:
            this._toggleSwitcherMode();
            break;
        case Enum.Actions.THUMBNAIL:
            this._actions.createWindowThumbnail();
            break;
        case Enum.Actions.MOVE_TO_WS:
            this._actions.moveToCurrentWS();
            break;
        case Enum.Actions.FS_ON_NEW_WS:
            this._actions.toggleFullscreenOnNewWS();
            break;
        case Enum.Actions.MINIMIZE:
            this._actions.toggleMinimize();
            break;
        case Enum.Actions.HIDE:
            this.fadeAndDestroy();
            break;
        case Enum.Actions.MENU:
            if (this._showingApps)
                this._openAppIconMenu();
            else
                this._openWindowMenu();
            break;
        case Enum.Actions.CLOSE_QUIT:
            this._actions.closeWinQuitApp();
            break;
        case Enum.Actions.KILL:
            this._actions.killApp();
            break;
        case Enum.Actions.PREFS:
            this._actions.openPrefsWindow();
            break;
        case Enum.Actions.NEW_WINDOW:
            this._openNewWindow();
            break;
        case Enum.Actions.REORDER_WS:
            this._actions.reorderWorkspace(direction === Clutter.ScrollDirection.UP ? -1 : 1);
            break;
        case Enum.Actions.NONE:
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }
        return Clutter.EVENT_STOP;
    },
    // ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
};

/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * EventHandler
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import St from 'gi://St';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Keyboard from 'resource:///org/gnome/shell/ui/status/keyboard.js';

import * as Enum from './enum.js';
import * as Util from './util.js';


export class InputHandler {
    constructor(opt, wsp, shortcutModifiers) {
        this._shortcutModifiers = shortcutModifiers;
        this._opt = opt;
        this._wsp = wsp;
        this.MARGIN_TOP = this._wsp.MARGIN_TOP;
        this.MARGIN_BOTTOM = this._wsp.MARGIN_BOTTOM;
        this.SCALE_FACTOR = St.ThemeContext.get_for_stage(global.stage).scaleFactor;
        this._actions = wsp._actions;

        this._timeoutIds = {};
    }

    clean() {
        // remove all local timeouts
        Object.values(this._timeoutIds).forEach(id => {
            if (id)
                GLib.source_remove(id);
        });

        this._restoreOverlayKey();
    }

    _remapOverlayKeyIfNeeded() {
        if (this._wsp._overlayKeyTriggered && !this._superRemapped && this._opt.ENABLE_SUPER) {
            // do this only for the first run
            this._superRemapped = true;
            const overlaySettings = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
            this._originalOverlayKey = overlaySettings.get_string('overlay-key');
            overlaySettings.set_string('overlay-key', '');

            this._overlayKeyInitTime = Date.now();
        }
    }

    _restoreOverlayKey() {
        if (this._originalOverlayKey) {
            const overlaySettings = new Gio.Settings({ schema_id: 'org.gnome.mutter' });
            overlaySettings.set_string('overlay-key', this._originalOverlayKey);
        }
    }

    _shiftPressed(state) {
        return Util.shiftPressed(state, this._shortcutModifiers);
    }

    _ctrlPressed(state) {
        return Util.ctrlPressed(state, this._shortcutModifiers);
    }

    _isTabAction(action) {
        return [
            Meta.KeyBindingAction.SWITCH_WINDOWS,
            Meta.KeyBindingAction.SWITCH_APPLICATIONS,
        ].includes(action);
    }

    _isTabBackwardAction(action) {
        return [
            Meta.KeyBindingAction.SWITCH_WINDOWS_BACKWARD,
            Meta.KeyBindingAction.SWITCH_APPLICATIONS_BACKWARD,
        ].includes(action);
    }

    _getKeysymName(keysym) {
        const keyUtf = Clutter.keysym_to_unicode(keysym);
        return String.fromCharCode(keyUtf);
    }

    _getKeyString(keysym) {
        return this._getKeysymName(keysym).toUpperCase();
    }

    handleKeyPress(keyEvent) {
        let keysym = keyEvent.get_key_symbol();
        // the action is an integer which is bind to the registered shortcut
        // but custom shortcuts are not stable
        const keyAction = global.display.get_keybinding_action(
            keyEvent.get_key_code(), keyEvent.get_state());

        const keyString = this._getKeyString(keysym);
        const keysymName = this._getKeysymName(keysym);

        const isNumPadNumber = keysym >= Clutter.KEY_KP_1 && keysym <= Clutter.KEY_KP_9;
        const isFKey = keysym >= Clutter.KEY_F1 && keysym <= Clutter.KEY_F19;


        const handlers = [
            { name: '_handleDirectSelection', args: [keysym, isNumPadNumber, isFKey] },
            { name: '_handleSearchEntry',     args: [keysym, keysymName, isNumPadNumber, keyAction] },
            { name: '_handleSpecialKeys',     args: [keysym, keysymName, keyAction] },
            { name: '_handleNavigationKeys',  args: [keysym, keyString] },
            { name: '_handleActionKeys',      args: [keysym, keyString] },
        ];

        for (const handler of handlers) {
            if (this[handler.name](...handler.args))
                return Clutter.EVENT_STOP;
        }

        // Note: pressing one of the below keys will destroy the popup only if
        // that key is not used by the active popup's keyboard shortcut
        if (keysym === Clutter.KEY_Escape || keysym === Clutter.KEY_Tab)
            this._wsp.fadeAndDestroy();

        // Allow to explicitly select the current item; this is particularly
        // useful for no-modifier popups
        if (keysym === Clutter.KEY_space ||
            keysym === Clutter.KEY_Return ||
            keysym === Clutter.KEY_KP_Enter ||
            keysym === Clutter.KEY_ISO_Enter)
            this._wsp._finish();

        return Clutter.EVENT_PROPAGATE;
    }

    _handleDirectSelection(keysym, isNumPadNumber, isFKey) {
        if (isFKey || (isNumPadNumber && this._wsp._searchQuery === null)) {
            const index = isNumPadNumber ? keysym - Clutter.KEY_KP_1 : keysym - Clutter.KEY_F1;

            if (index < this._wsp._items.length) {
                this._wsp._selectedIndex = index;
                if (!this._shiftPressed())
                    this._wsp._finish();
                else
                    this._wsp._select(index);
            }
            return true;
        }
        return false;
    }

    _handleSearchEntry(keysym, keysymName, isNumPadNumber, action) {
        if (this._wsp._searchQuery === null || (this._shiftPressed() && !isNumPadNumber))
            return false;

        if (isNumPadNumber)
            keysymName = (keysym - Clutter.KEY_KP_0).toString();

        this._opt.cancelTimeout = true;

        if (keysym === Clutter.KEY_BackSpace) {
            this._wsp._searchQuery = this._wsp._searchQuery.slice(0, -1);
            this._wsp.show();
            return true;
        }

        if (!this._isTabAction(action) && !this._invalidSearchCharacter(keysym, keysymName)) {
            if (keysym === Clutter.KEY_space)
                keysymName = ' ';

            if (!(keysymName === ' ' && (this._wsp._searchQuery === '' || this._wsp._searchQuery.endsWith(' ')))) {
                this._wsp._searchQuery += keysymName.toLowerCase();
                this._wsp.show();
                return true;
            }
        }
        return false;
    }

    _invalidSearchCharacter(keysym, keysymName) {
        return this._ctrlPressed() || keysymName.length !== 1 || !(/[a-zA-Z0-9]/.test(keysymName) || keysym === Clutter.KEY_space);
    }

    // ------------------------------------------------------------------

    _handleSpecialKeys(keysym, keysymName, action) {
        const specialKeys = [
            { condition: keysym === Clutter.KEY_Escape && this._wsp._singleApp && !this._wsp._keyboardTriggered, method: '_toggleSingleAppMode' },
            { condition: this._isTabKeyPressed(keysym, action), method: '_handleTabKey' },
            { condition: this._isSwitchGroupAction(action, keysym), method: '_handleSwitchGroupAction' },
            { condition: this._isCtrlTabKeyPressed(keysym), method: '_handleCtrlTabKey' },
            { condition: this._isOverlayKeyPressed(keysym, keysymName), method: '_handleOverlayKey' },
        ];

        for (const key of specialKeys) {
            if (key.condition) {
                this[key.method](action);
                return true;
            }
        }

        return false;
    }

    _isOverlayKeyPressed(keysym, keysymName) {
        return keysymName === this._wsp._originalOverlayKey || keysym === Clutter.KEY_Super_L;
    }

    _isOverlayKeyInitActive() {
        return Date.now() - this._overlayKeyInitTime < 500;
    }

    _handleOverlayKey() {
        const overlayKeyInitActive = this._isOverlayKeyInitActive();
        if ((!this._ctrlPressed() && this._shiftPressed()) || (overlayKeyInitActive && this._opt.SUPER_DOUBLE_PRESS_ACT === Enum.DoubleSuperAction.OVERVIEW)) {
            this._passToOverviewSearch();
        } else if ((this._ctrlPressed() && this._shiftPressed()) || (overlayKeyInitActive && this._opt.SUPER_DOUBLE_PRESS_ACT === Enum.DoubleSuperAction.APP_GRID)) {
            this._wsp.fadeAndDestroy();
            this._actions.toggleAppGrid();
        } else if (overlayKeyInitActive && this._opt.SUPER_DOUBLE_PRESS_ACT === Enum.DoubleSuperAction.PREV_WIN) {
            this._wsp._finish();
        } else if (overlayKeyInitActive && this._opt.SUPER_DOUBLE_PRESS_ACT === Enum.DoubleSuperAction.SWITCHER_MODE) {
            this._wsp._resetSwitcherMode();
            this._wsp._toggleSwitcherMode();
        } else if (this._ctrlPressed()) {
            this._wsp._switchFilterMode();
        } else {
            this._wsp.fadeAndDestroy();
        }
    }

    _isTabKeyPressed(keysym, action) {
        return this._isTabAction(action) || this._isTabBackwardAction(action) ||
        ((keysym === Clutter.KEY_Tab || keysym === Clutter.KEY_ISO_Left_Tab) && !this._ctrlPressed()) ||
        (this._wsp._keyBind && (keysym === Clutter[`KEY_${this._wsp._keyBind.toUpperCase()}`] || keysym === Clutter[`KEY_${this._wsp._keyBind.toLowerCase()}`]));
    }

    _toggleSingleAppMode() {
        this._wsp._toggleSingleAppMode();
    }

    _handleTabKey(action) {
        if (this._wsp._singleApp)
            this._wsp._toggleSingleAppMode();

        if (!this._wsp._allowFilterSwitchOnOnlyItem && this._wsp._items.length === 1) {
            this._wsp._allowFilterSwitchOnOnlyItem = true;
            this._wsp._updateSwitcher();
        }

        if (!this._wsp._singleApp && this._shiftPressed() || this._isTabBackwardAction(action))
            this._wsp._select(this._wsp._previous());
        else if (!this._wsp._singleApp)
            this._wsp._select(this._wsp._next());
    }

    _isSwitchGroupAction(action, keysym) {
        return action === Meta.KeyBindingAction.SWITCH_GROUP || action === Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD ||
        keysym === Clutter.KEY_semicolon || keysym === 96 || keysym === 126 || keysym === 65112;
    }

    _handleSwitchGroupAction(action) {
        const selected = this._wsp._getSelectedTarget();
        if (this._ctrlPressed())
            this._wsp._toggleSwitcherMode();
        else if (this._wsp._switcherMode === Enum.SwitcherMode.APPS)
            this._handleAppSwitcherMode(selected, action);
        else if (this._wsp._switcherMode === Enum.SwitcherMode.WINDOWS)
            this._handleWindowSwitcherMode();
    }

    _handleAppSwitcherMode(selected, action) {
        // Try to switch filter on the second switch group key press if allowed
        if (this._wsp._singleApp && !this._wsp._allowFilterSwitchOnOnlyItem && this._wsp._items.length === 1) {
            this._wsp._allowFilterSwitchOnOnlyItem = true;
            this._wsp._updateSwitcher();
            return;
        }

        if (this._wsp._showingApps && selected.cachedWindows) {
            if (selected && selected.cachedWindows.length)
                this._wsp._toggleSingleAppMode();
        } else if (this._wsp._singleApp) {
            if (this._shiftPressed() || action === Meta.KeyBindingAction.SWITCH_GROUP_BACKWARD)
                this._wsp._select(this._wsp._previous());
            else
                this._wsp._select(this._wsp._next());
        } else if (selected && selected._isShowAppsIcon) {
            this._wsp._includeFavorites = !this._wsp._includeFavorites;
            this._wsp._updateSwitcher();
        } else {
            this._wsp._toggleSwitcherMode();
        }
    }

    _handleWindowSwitcherMode() {
        let index = this._wsp._selectedIndex > -1 ? this._wsp._selectedIndex : 0;

        if (this._wsp._singleApp) {
            if (this._shiftPressed())
                this._wsp._select(this._wsp._previous());
            else
                this._wsp._select(this._wsp._next());
        } else if (this._wsp._groupMode !== Enum.GroupMode.APPS) {
            this._wsp._groupMode = Enum.GroupMode.APPS;
            this._wsp._skipInitialSelection = true;
            this._wsp.show();
            this._wsp._selectNextApp(0);
        } else {
            this._wsp._selectNextApp(index);
        }
    }

    _isCtrlTabKeyPressed(keysym) {
        return (keysym === Clutter.KEY_Tab || keysym === Clutter.KEY_ISO_Left_Tab) && this._ctrlPressed();
    }

    _handleCtrlTabKey() {
        const mod = Main.layoutManager.monitors.length;

        if (this._shiftPressed())
            this._wsp._monitorIndex = (this._wsp._monitorIndex + mod - 1) % mod;
        else
            this._wsp._monitorIndex = (this._wsp._monitorIndex + 1) % mod;

        this._wsp._updateSwitcher();
        this._wsp._showWsThumbnails();
    }

    _passToOverviewSearch() {
        this._actions.toggleOverview();
        if (this._wsp._searchQuery) {
            Main.overview._overview.controls._searchController._entry.set_text(this._wsp._searchQuery);
            Main.overview.searchEntry.grab_key_focus();
        }
    }

    // ------------------------------------------------------------------

    _handleNavigationKeys(keysym, keyString) {
        const up = this._opt.get('hotkeyUp').includes(keyString) ? keysym : 0;
        const down = this._opt.get('hotkeyDown').includes(keyString) ? keysym : 0;
        const left = this._opt.get('hotkeyLeft').includes(keyString) ? keysym : 0;
        const right = this._opt.get('hotkeyRight').includes(keyString) ? keysym : 0;

        const navKeys = [
            { keys: [Clutter.KEY_Up, up], method: '_navigateUp' },
            { keys: [Clutter.KEY_Down, down], method: '_navigateDown' },
            { keys: [Clutter.KEY_Left, left], method: '_navigateLeft' },
            { keys: [Clutter.KEY_Right, right], method: '_navigateRight' },
            { keys: [Clutter.KEY_Home], method: '_navigateHome' },
            { keys: [Clutter.KEY_End], method: '_navigateEnd' },
            { keys: [Clutter.KEY_Page_Up], method: '_handlePageUp' },
            { keys: [Clutter.KEY_Page_Down], method: '_handlePageDown' },
        ];

        for (const key of navKeys) {
            if (key.keys.includes(keysym)) {
                this[key.method](keysym);
                return true;
            }
        }

        return false;
    }

    _handlePageUp() {
        if (this._ctrlPressed())
            this._actions.reorderWorkspace(-1);
        else
            this._wsp._switchWorkspace(Meta.MotionDirection.UP);
    }

    _handlePageDown() {
        if (this._ctrlPressed())
            this._actions.reorderWorkspace(+1);
        else
            this._wsp._switchWorkspace(Meta.MotionDirection.DOWN);
    }

    _navigateUp() {
        if (this._ctrlPressed() && !this._shiftPressed())
            this._wsp.moveWinToAdjacentWs(Clutter.ScrollDirection.UP);
        else if (this._ctrlPressed() && this._shiftPressed())
            this._wsp.moveWinToNewAdjacentWs(Clutter.ScrollDirection.UP);
        else if (!this._ctrlPressed() && !this._shiftPressed() && this._opt.UP_DOWN_ACTION === Enum.UpDownAction.SWITCH_WS)
            this._wsp._switchWorkspace(Meta.MotionDirection.UP);
        else if (!this._ctrlPressed() && !this._shiftPressed() && this._opt.UP_DOWN_ACTION === Enum.UpDownAction.SINGLE_APP)
            this._wsp._toggleSingleAppMode();
        else if (!this._ctrlPressed() && !this._shiftPressed() && this._opt.UP_DOWN_ACTION === Enum.UpDownAction.SINGLE_AND_SWITCHER)
            this._wsp._toggleSwitcherMode();
        else
            this._wsp._switchMonitor(Meta.DisplayDirection.UP);
    }

    _navigateDown() {
        if (this._ctrlPressed() && !this._shiftPressed())
            this._actions.moveWinToAdjacentWs(Clutter.ScrollDirection.DOWN);
        else if (this._ctrlPressed() && this._shiftPressed())
            this._actions.moveWinToNewAdjacentWs(Clutter.ScrollDirection.DOWN);
        else if (!this._ctrlPressed() && !this._shiftPressed() && this._opt.UP_DOWN_ACTION === Enum.UpDownAction.SWITCH_WS)
            this._wsp._switchWorkspace(Meta.MotionDirection.DOWN);
        else if (!this._ctrlPressed() && !this._shiftPressed() && this._opt.UP_DOWN_ACTION >= Enum.UpDownAction.SINGLE_APP)
            this._wsp._toggleSingleAppMode();
        else
            this._wsp._switchMonitor(Meta.DisplayDirection.DOWN);
    }

    _navigateLeft() {
        if (this._shiftPressed() && this._ctrlPressed())
            this._wsp._moveFavorites(-1);
        else if (this._ctrlPressed() && !this._shiftPressed())
            this._actions.moveWinToAdjacentWs(Clutter.ScrollDirection.UP);
        else if (!this._shiftPressed())
            this._wsp._select(this._wsp._previous(true));
        else
            this._wsp._switchMonitor(Meta.DisplayDirection.LEFT);
    }

    _navigateRight() {
        if (this._shiftPressed() && this._ctrlPressed())
            this._wsp._moveFavorites(+1);
        else if (this._ctrlPressed() && !this._shiftPressed())
            this._actions.moveWinToAdjacentWs(Clutter.ScrollDirection.DOWN);
        else if (!this._shiftPressed())
            this._wsp._select(this._wsp._next(true));
        else
            this._wsp._switchMonitor(Meta.DisplayDirection.RIGHT);
    }

    _navigateHome() {
        if (this._shiftPressed())
            this._actions.switchToFirstWS();
        else
            this._wsp._select(0);
    }

    _navigateEnd() {
        if (this._shiftPressed())
            this._actions.switchToLastWS();
        else
            this._wsp._select(this._wsp._items.length - 1);
    }

    // ------------------------------------------------------------------

    _handleActionKeys(keysym, keyString) {
        const actions = {
            [Clutter.KEY_Insert]:                      this._wsp._toggleSearchMode.bind(this._wsp),
            [Clutter.KEY_Delete]:                      this._handleDelKey.bind(this),
            [Clutter.KEY_space]:                       this._wsp._toggleShowPreview.bind(this._wsp),
            [Clutter.KEY_KP_0]:                        this._wsp._toggleShowPreview.bind(this._wsp),
            [Clutter.KEY_KP_Insert]:                   this._wsp._toggleShowPreview.bind(this._wsp),
            [Clutter.KEY_Return]:                      this._handleReturnKey.bind(this),
            [Clutter.KEY_Menu]:                        this._handleMenuKey.bind(this),
            [this._opt.get('hotkeySearch')]:           this._wsp._toggleSearchMode.bind(this._wsp),
            [this._opt.get('hotkeySwitchFilter')]:     this._wsp._switchFilterMode.bind(this._wsp),
            [this._opt.get('hotkeySingleApp')]:        this._wsp._toggleSingleAppMode.bind(this._wsp),
            [this._opt.get('hotkeyGroupWs')]:          this._wsp._toggleGroupByWs.bind(this._wsp),
            [this._opt.get('hotkeyCloseQuit')]:        this._actions.closeWinQuitApp.bind(this._actions),
            [this._opt.get('hotkeyCloseAllApp')]:      this._actions.closeAppWindows.bind(this._actions),
            [this._opt.get('hotkeyAbove')]:            this._wsp._toggleWinAbove.bind(this._wsp),
            [this._opt.get('hotkeySticky')]:           this._wsp._toggleWinSticky.bind(this._wsp),
            [this._opt.get('hotkeyMoveWinToMonitor')]: this._actions.moveToCurrentWS.bind(this._actions),
            [this._opt.get('hotkeyMaximize')]:         this._actions.toggleMaximizeOnCurrentMonitor.bind(this._actions),
            [this._opt.get('hotkeyFsOnNewWs')]:        this._actions.toggleFullscreenOnNewWS.bind(this._actions),
            [this._opt.get('hotkeyNewWin')]:           this._wsp._openNewWindow.bind(this._wsp),
            [this._opt.get('hotkeySwitcherMode')]:     this._wsp._toggleSwitcherMode.bind(this._wsp),
            [this._opt.get('hotkeyFavorites')]:        this._toggleFavorites.bind(this),
            [this._opt.get('hotkeyThumbnail')]:        this._handleWindowThumbnail.bind(this),
            [this._opt.get('hotkeyPrefs')]:            this._actions.openPrefsWindow.bind(this._actions),
        };

        if (actions[keysym]) {
            actions[keysym]();
            return true;
        }

        for (const [key, action] of Object.entries(actions)) {
            if (Number(key) === keysym ||
            (keyString && key.includes(keyString) && (this._opt.SHIFT_AZ_HOTKEYS ? this._shiftPressed() || this._ctrlPressed() : true))
            ) {
                action();
                return true;
            }
        }
        return false;
    }

    _handleWindowThumbnail() {
        if (this._ctrlPressed() && this._shiftPressed())
            this._actions.removeAllWindowThumbnails();
        else if (this._ctrlPressed())
            this._actions.removeLastWindowThumbnail();
        else
            this._actions.createWindowThumbnail();
    }

    _clearSearchEntry() {
        if (!this._shiftPressed() && this._wsp._searchQuery !== null) {
            this._wsp._searchQuery = '';
            this._wsp.show();
        }
    }

    _toggleFavorites() {
        this._wsp._includeFavorites = !this._wsp._includeFavorites;
        this._wsp.show();
    }

    _handleReturnKey() {
        if (this._shiftPressed())
            this._switchInputSource();
        else if (this._ctrlPressed())
            this._wsp._openNewWindow();
        else
            this._wsp._finish();
    }

    _handleDelKey() {
        if (this._opt.DELETE_KEY_CLOSE)
            this._actions.closeWinQuitApp();
        else
            this._clearSearchEntry();
    }

    _handleMenuKey() {
        if (this._wsp._showingApps)
            this._wsp._openAppIconMenu();
        else
            this._wsp._openWindowMenu();
    }

    // ///////////////////////////////////////////////////////////////////////////////
    // Keyboard layout

    // Set keyboard layout stored in AATWS settings if available and needed.
    // This function must be executed after the popup is displayed and reset before activation of selected window.

    // In GS 40-42 any popup window causes the currently active window lose focus, unlike in 3.3x and 43+.
    // This means that AATWS is actually setting input for the active window in GS 3.3x and 43+,
    // if GS is set to Set input individually for each window
    // and needs to be reset before activation of another window.
    setInput(reset = false) {
        if (reset) {
            // reset the input only if needed
            if (this._originalSource && this._originalSource.id !== this._opt.INPUT_SOURCE_ID)
                this._originalSource.activate(false);

            this._originalSource = null;

            return;
        }

        if (!this._opt.REMEMBER_INPUT || !this._opt.INPUT_SOURCE_ID)
            return;

        const inputSourceManager = Keyboard.getInputSourceManager();
        this._originalSource = inputSourceManager._currentSource;
        const inputSources = Object.values(inputSourceManager._inputSources);

        if (inputSources.length < 2)
            return;

        for (let i = 0; i < inputSources.length; i++) {
            if (inputSources[i].id === this._opt.INPUT_SOURCE_ID) {
                inputSources[i].activate(false);
                this._activeInput = this._opt.INPUT_SOURCE_ID;
                this._wsp._setSwitcherStatus();
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
        if (this._opt.REMEMBER_INPUT)
            this._opt.set('inputSourceId', activeSource.id);

        this._activeInput = activeSource.id;
        this._wsp._setSwitcherStatus();
    }

    _setInputTimeout() {
        this._timeoutIds.setInputDelay = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            20,
            () => {
                this.setInput();
                this._timeoutIds.setInputDelay = 0;
            }
        );
    }


    // /////////////////////////////////////////////////////////////////////////////////
    // Mouse

    getButtonPressAction(event) {
        const btn = event.get_button();
        let action;

        if (this._wsp._wsTmb && this.isPointerOnWsTmb())
            return null;

        const pointerOut = this.isPointerOut();

        switch (btn) {
        case Clutter.BUTTON_PRIMARY:
            /* if ((this._recentSwitchTime - Date.now() > 0) && !pointerOut) {
                action = Enum.Actions.ACTIVATE;
            } else { */
            action = pointerOut
                ? this._opt.get('switcherPopupPrimClickOut')
                : this._opt.get('switcherPopupPrimClickIn');
            // }
            break;
        case Clutter.BUTTON_SECONDARY:
            action = pointerOut
                ? this._opt.get('switcherPopupSecClickOut')
                : this._opt.get('switcherPopupSecClickIn');
            break;
        case Clutter.BUTTON_MIDDLE:
            action = pointerOut
                ? this._opt.get('switcherPopupMidClickOut')
                : this._opt.get('switcherPopupMidClickIn');
            break;
        }

        return action;
    }

    getItemBtnPressAction(event) {
        const btn = event.get_button();
        let action;
        const apps = this._wsp._showingApps;

        switch (btn) {
        case Clutter.BUTTON_PRIMARY:
            action = apps
                ? this._opt.get('appSwitcherPopupPrimClickItem')
                : this._opt.get('winSwitcherPopupPrimClickItem');
            break;
        case Clutter.BUTTON_SECONDARY:
            action = apps
                ? this._opt.get('appSwitcherPopupSecClickItem')
                : this._opt.get('winSwitcherPopupSecClickItem');
            break;
        case Clutter.BUTTON_MIDDLE:
            action = apps
                ? this._opt.get('appSwitcherPopupMidClickItem')
                : this._opt.get('winSwitcherPopupMidClickItem');
            break;
        }

        return action;
    }

    getScrollAction() {
        if (this.isPointerOnWsTmb()) {
            return this._shiftPressed()
                ? Enum.Actions.REORDER_WS
                : Enum.Actions.SWITCH_WS;
        }

        const action = this.isPointerOut()
            ? this._opt.get('switcherPopupScrollOut')
            : this._opt.get('switcherPopupScrollIn');
        return action;
    }

    getItemScrollAction(apps) {
        const action = apps
            ? this._opt.get('appSwitcherPopupScrollItem')
            : this._opt.get('winSwitcherPopupScrollItem');

        return action;
    }

    isPointerOut() {
        const [x, y] = global.get_pointer();
        const switcher = this._wsp._switcherList;
        const popupPosition = this._wsp._popupPosition;
        // margin expands the "inside" area around the popup to cover gap between the popup and the edge of screen (Top/Bottom position), plus small overlap
        const margin = this.MARGIN_BOTTOM * this.SCALE_FACTOR - 1;
        const marginTop = this.MARGIN_TOP * this.SCALE_FACTOR;

        let result = false;
        if (x < (switcher.allocation.x1 - margin) || x > (switcher.allocation.x1 + switcher.width + margin)) {
            // return true if the pointer is horizontally outside the switcher and cannot be at the top or bottom of the screen
            if (!((popupPosition === Enum.Position.TOP && y === switcher.allocation.y1 - marginTop) || (popupPosition === Enum.Position.BOTTOM && y === switcher.allocation.y2 + margin)))
                result = true;
        } else if (y < (switcher.allocation.y1 - marginTop) || y > (switcher.allocation.y2 + margin)) {
            result = true;
        }

        return result && !this.isPointerOnWsTmb(true);
    }

    isPointerOnWsTmb(includeSpaceBetween = false) {
        const wsTmb = this._wsp._wsTmb;
        if (!wsTmb)
            return false;

        const switcher = this._wsp._switcherList;
        const [x, y] = global.get_pointer();


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
}

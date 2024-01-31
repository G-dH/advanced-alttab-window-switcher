/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * Prefs
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2023
 * @license    GPL-3.0
 */

'use strict';

const { Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.src.settings;
const OptionsFactory = Me.imports.src.optionsFactory;

// gettext
const _  = Settings._;

const shellVersion   = Settings.shellVersion;

const Actions = Settings.Actions;

let opt;

function _getActionList() {
    return [
        [_('Do Nothing'),                      Actions.NONE],
        [_('Close Switcher Popup'),            Actions.HIDE],
        [_('Select Next/Previous'),            Actions.SELECT_ITEM],
        [_('Activate'),                        Actions.ACTIVATE],
        [_('Switch Workspace'),                Actions.SWITCH_WS],
        [_('Open New Window'),                 Actions.NEW_WINDOW],
        [_('Show / Preview'),                  Actions.SHOW],
        [_('Open Context Menu'),               Actions.MENU],
        [_('Switch Filter Mode'),              Actions.SWITCH_FILTER],
        [_('Toggle Single App Mode'),          Actions.SINGLE_APP],
        [_('Toggle Switcher Mode'),            Actions.SWITCHER_MODE],
        [_('Close/Quit Selected'),             Actions.CLOSE_QUIT],
        [_('Force Quit Selected App'),         Actions.KILL],
        [_('Move Selected to Current WS/Monitor'), Actions.MOVE_TO_WS],
        [_('Toggle Fullscreen on Empty WS'),   Actions.FS_ON_NEW_WS],
        [_('Sort Windows by Applications'),    Actions.GROUP_APP],
        [_('Sort Current Monitor First'),      Actions.CURRENT_MON_FIRST],
        [_('Create Window Thumbnail'),         Actions.THUMBNAIL],
        [_('Open Preferences'),                Actions.PREFS],
    ];
}

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    opt = new Settings.Options();
}

function _getPageList() {
    const itemFactory = new OptionsFactory.ItemFactory(opt);
    const options = _getOptions(itemFactory);
    const pageList = [
        {
            name: 'common',
            title: _('Common'),
            iconName: 'preferences-system-symbolic',
            optionList: _getCommonOptionList(options),
        },
        {
            name: 'windows',
            title: _('Window Switcher'),
            iconName: 'focus-windows-symbolic',
            optionList: _getWindowOptionList(options),
        },
        {
            name: 'apps',
            title: _('App Switcher'),
            iconName: 'view-app-grid-symbolic',
            optionList: _getAppOptionList(options),
        },
        {
            name: 'dock',
            title: _('Dock Mode'),
            iconName: 'user-bookmarks-symbolic',
            optionList: _getDockOptionList(options),
        },
        {
            name: 'hotkeys',
            title: _('Hotkeys'),
            iconName: 'input-keyboard-symbolic',
            optionList: _getHotkeysOptionList(itemFactory),
        },
        {
            name: 'mouse',
            title: _('Mouse'),
            iconName: 'input-mouse-symbolic',
            optionList: _getMouseOptionList(options),
        },
        {
            name: 'misc',
            title: _('Misc'),
            iconName: 'preferences-other-symbolic',
            optionList: _getMiscOptionList(options),
        },
        {
            name: 'about',
            title: _('About'),
            iconName: 'preferences-system-details-symbolic',
            optionList: getAboutOptionList(itemFactory),
        },
    ];

    return pageList;
}

function fillPreferencesWindow(window) {
    OptionsFactory.AdwPrefs.getFilledWindow(window, _getPageList());
    window.set_search_enabled(true);
    window.set_default_size(800, 800);
    window.connect('close-request', () => {
        opt.destroy();
        opt = null;
    });
}

function buildPrefsWidget() {
    const prefsWidget = OptionsFactory.LegacyPrefs.getPrefsWidget(_getPageList());
    prefsWidget.connect('realize', widget => {
        const window = widget.get_root ? widget.get_root() : widget.get_toplevel();

        const width = 800;
        const height = 800;
        window.set_default_size(width, height);

        const signal = Gtk.get_major_version() === 3 ? 'destroy' : 'close-request';
        window.connect(signal, () => {
            opt.destroy();
            opt = null;
        });
    });
    return prefsWidget;
}

function _getCommonOptionList(options) {
    const opt = options;

    const optionList = [
        opt.Behavior,
        // ---------------
        opt.Position,
        opt.DefaultMonitor,
        opt.ShowImmediately,
        opt.SearchModeDefault,
        opt.SyncFilter,
        // opt.UpDownArrowAction,
        // opt.HotkeysRequireShift,
        opt.WraparoundSelector,
        opt.HoverSelectsItem,
        opt.DelayShowingSwitcher,
        opt.InteractiveIndicators,
        // ---------------
        opt.AppearanceCommon,
        opt.WsThumbnails,
        opt.Theme,
        opt.OverlayTitle,
        opt.TooltipLabelScale,
        opt.ShowDirectActivation,
        opt.ShowStatus,
        opt.SingleAppPreviewSize,
        // ---------------
        opt.Super,
        opt.SuperKeyMode,
        opt.EnableSuper,
        opt.SuperDoublePress,
        // ---------------
        opt.Input,
        opt.RememberInput,
    ];

    return optionList;
}

function _getWindowOptionList(options) {
    const opt = options;

    const optionList = [
        opt.Controls,
        opt.ShortcutWin,
        opt.Behavior,
        opt.DefaultFilterWin,
        opt.DefaultSortingWin,
        opt.DefaultGrouping,
        opt.DistinguishMinimized,
        opt.SkipMinimized,
        opt.MinimizedLast,
        opt.IncludeModals,
        opt.SearchAllWindows,
        opt.SearchApplications,
        // ---------------
        opt.AppearanceWin,
        opt.ShowWindowTitle,
        opt.ShowWorkspaceIndex,
        opt.WindowPreviewSize,
        opt.WindowIconSize,
    ];

    return optionList;
}

function _getAppOptionList(options) {
    const opt = options;

    const optionList = [
        opt.Controls,
        opt.ShortcutApp,
        opt.Behavior,
        opt.DefaultFilterApp,
        opt.DefaultSortingApp,
        opt.RaiseFirstWinOnly,
        opt.ResultsLimit,
        opt.SearchPrefRunning,
        opt.IncludeFavorites,
        opt.IncludeShowAppsIcon,
        // ---------------
        opt.AppearanceApp,
        opt.ShowAppTitle,
        opt.ShowWinCounter,
        opt.HideWinCounterForSingleWindow,
        opt.AppIconSize,
    ];

    return optionList;
}

function _getDockOptionList(options) {
    const opt = options;

    const optionList = [
        opt.HotEdge,
        opt.HotEdgePosition,
        opt.HotEdgeFullScreen,
        opt.HotEdgeMode,
        opt.HotEdgeMonitor,
        opt.HotEdgePressure,
        opt.HotEdgeWidth,
        // ---------------
        opt.ExternalTrigger,
        opt.SingleOnActivate,
        opt.AppStableOrder,
        opt.AppIncludeFavorites,
        opt.AutomaticallyReverseOrder,
        opt.PointerOutTimeout,
        opt.ActivateOnHide,
        opt.MousePointerPosition,
        opt.AnimationTimeFactor,
        // ---------------
        opt.Dash,
        opt.ShowDash,
    ];

    return optionList;
}

function _getMiscOptionList(options) {
    const opt = options;

    const optionList = [
        opt.WindowManager,
        opt.AlwaysActivateFocused,
        // ---------------
        opt.Workspace,
        opt.ShowWsSwitcherPopup,
        // ---------------
        opt.Thumbnails,
        opt.ThumbnailScale,
    ];

    return optionList;
}

function _getMouseOptionList(options) {
    const opt = options;

    const optionList = [
        opt.Common,
        opt.PrimaryBackground,
        opt.SecondaryBackground,
        opt.MiddleBackground,
        opt.ScrollBackground,
        opt.PrimaryOutside,
        opt.SecondaryOutside,
        opt.MiddleOutside,
        opt.ScrollOutside,
        // ---------------
        opt.WindowSwitcher,
        opt.ScrollWinItem,
        opt.PrimaryWinItem,
        opt.SecondaryWinItem,
        opt.MiddleWinItem,
        // ---------------
        opt.AppSwitcher,
        opt.ScrollAppItem,
        opt.PrimaryAppItem,
        opt.SecondaryAppItem,
        opt.MiddleAppItem,
    ];

    return optionList;
}

// option item
// item[label, widget]

// ////////////////////////////////////////////////////////////////
// ////////////////////////////////////////////////////////////////
function _getOptions(itemFactory) {
    const optDict = {};
    const actionList = _getActionList();

    optDict.Behavior = itemFactory.getRowWidget(
        _('Behavior')
    );

    optDict.Position = itemFactory.getRowWidget(
        _('Placement'),
        _('Specifies the screen location for the switcher pop-up'),
        itemFactory.newComboBox(),
        'switcherPopupPosition',
        [
            [_('Top'), 1],
            [_('Center'), 2],
            [_('Bottom'), 3],
        ]
    );

    optDict.DefaultMonitor = itemFactory.getRowWidget(
        _('Default Monitor'),
        _('Determines the screen on which the switcher pop-up will be displayed'),
        itemFactory.newComboBox(),
        'switcherPopupMonitor',
        [
            [_('Primary Monitor'), 1],
            [_('Monitor with focused window'), 2],
            [_('Monitor with mouse pointer'), 3],
        ]
    );

    optDict.SyncFilter = itemFactory.getRowWidget(
        _('Synchronize Filter Mode'),
        _('Enables shared filter mode between Window and App switchers. Switching the switcher mode will no longer reset the filter mode to the default for each'),
        itemFactory.newSwitch(),
        'switcherPopupSyncFilter'
    );

    optDict.ShowImmediately = itemFactory.getRowWidget(
        _('Show Selected Window'),
        _('Instantly displays the selected window in its original size upon switcher selection. Choose between a preview clone or raising the original window including switching workspaces if needed'),
        itemFactory.newComboBox(),
        'switcherPopupPreviewSelected',
        [
            [_('Disable'), 1],
            [_('Show Preview'), 2],
            [_('Show Window'), 3],
        ]
    );

    optDict.SearchModeDefault = itemFactory.getRowWidget(
        _('Search Mode as Default'),
        _('Immediately enables type-to-search functionality upon switcher pop-up. Use hotkeys while holding down the Shift key.'),
        itemFactory.newSwitch(),
        'switcherPopupStartSearch'
    );

    optDict.WraparoundSelector = itemFactory.getRowWidget(
        _('Wraparound Selector'),
        _('Selection seamlessly cycles from the last item to the first and vice versa'),
        itemFactory.newSwitch(),
        'switcherPopupWrap'
    );

    optDict.HoverSelectsItem = itemFactory.getRowWidget(
        _('Hover to Select'),
        _('Automatically selects a switcher item when the mouse pointer hovers over it'),
        itemFactory.newSwitch(),
        'switcherPopupHoverSelect'
    );

    optDict.InteractiveIndicators = itemFactory.getRowWidget(
        _('Interactive Indicators'),
        _('Indicators respond to mouse clicks, enabling specific actions. The workspace indicator moves the window to the current workspace, the app icon and window counter toggle single app mode. "Always on Top", "Always on Visible Workspace" and "App Menu" icons appear upon hover'),
        itemFactory.newSwitch(),
        'switcherPopupInteractiveIndicators'
    );

    optDict.Content = itemFactory.getRowWidget(
        _('Content')
    );

    optDict.OverlayTitle = itemFactory.getRowWidget(
        _('Tooltip Titles'),
        _('The switcher pop-up displays the full title of the selected item as a caption, positioned above or below as needed'),
        itemFactory.newComboBox(),
        'switcherPopupTooltipTitle',
        [
            [_('Disable'), 1],
            [_('Show Above/Below Item'), 2],
            [_('Show Centered'), 3],
        ]
    );

    let tooltipScaleAdjustment = new Gtk.Adjustment({
        upper: 300,
        lower: 50,
        step_increment: 5,
        page_increment: 5,
    });

    optDict.TooltipLabelScale = itemFactory.getRowWidget(
        _('Tooltip Title Scale (%)'),
        _('Adjust font size for app/window titles.'),
        itemFactory.newSpinButton(tooltipScaleAdjustment),
        'switcherPopupTooltipLabelScale'
    );

    optDict.ShowDirectActivation = itemFactory.getRowWidget(
        _('Show Hotkeys F1-F12 for Direct Activation'),
        _('The hotkeys will work even if this option is disabled'),
        itemFactory.newSwitch(),
        'switcherPopupHotKeys'
    );

    optDict.ShowStatus = itemFactory.getRowWidget(
        _('Show Status'),
        _('Displays a label at the bottom left of the pop-up, indicating the current filter, grouping, and sorting modes'),
        itemFactory.newSwitch(),
        'switcherPopupStatus'
    );

    optDict.AppearanceCommon = itemFactory.getRowWidget(
        _('Appearance and Content')
    );

    let singlePrevSizeAdjustment = new Gtk.Adjustment({
        upper: 512,
        lower: 0,
        step_increment: 8,
        page_increment: 32,
    });

    optDict.SingleAppPreviewSize = itemFactory.getRowWidget(
        _('Single App Preview Size (px)'),
        null,
        itemFactory.newSpinButton(singlePrevSizeAdjustment),
        'singleAppPreviewSize'
    );

    let popupTimeoutAdjustment = new Gtk.Adjustment({
        upper: 400,
        lower: 0,
        step_increment: 10,
        page_increment: 100,
    });

    optDict.DelayShowingSwitcher = itemFactory.getRowWidget(
        _('Delay Switcher Display (ms)'),
        _('Introduces a delay before showing the pop-up to prevent disturbance for fast Alt+Tab users. Note that even with a delay set to 0, there may still be some lag as the switcher pop-up builds, dependent on your system and the number of items'),
        itemFactory.newSpinButton(popupTimeoutAdjustment),
        'switcherPopupTimeout'
    );

    if (shellVersion >= 42) {
        optDict.WsThumbnails = itemFactory.getRowWidget(
            _('Show Workspace Thumbnails'),
            _('AATWS displays workspace thumbnails above or below the switcher, allowing you to preview their content, drag and drop windows between workspaces and switch workspaces with the mouse. Additionally, you can reorder the current workspace using (Ctrl or Shift)+Scroll or Ctrl+Page Up/Down'),
            itemFactory.newComboBox(),
            'switcherWsThumbnails',
            [
                [_('Disable'),                0],
                [_('Show'),                   1],
                [_('Show in Dock Mode Only'), 2],
            ]
        );
    } else {
        optDict.WsThumbnails = null;
    }

    optDict.Theme = itemFactory.getRowWidget(
        _('Color Style'),
        _('The "Default" option corresponds to the current Shell theme, and "Follow System Color Scheme" switches between AATWS Dark and Light styles based on the current GNOME color style (available in GNOME 42 and higher)'),
        itemFactory.newComboBox(),
        'switcherPopupTheme',
        [
            [_('Default'),                    0],
            [_('AATWS Dark'),                 1],
            [_('AATWS Light'),                2],
            [_('Follow System Color Style'), 3],
        ]
    );

    // ----------------------------------------------

    optDict.Super = itemFactory.getRowWidget(
        _('Super (Windows) Key')
    );

    optDict.SuperKeyMode = itemFactory.getRowWidget(
        _('Super Key Action'),
        _('Press and release the Super key (default overlay-key, remappable in Gnome Tweaks) to open the App or Window switcher. The default mode preserves system behavior'),
        itemFactory.newComboBox(),
        'superKeyMode',
        [
            [_('Default'),          1],
            [_('App Switcher'),     2],
            [_('Window Switcher'),  3],
        ]
    );

    const enableSuperSwitch = itemFactory.newSwitch();
    optDict.EnableSuper = itemFactory.getRowWidget(
        _('Enable Super as Hotkey (Experimental)'),
        _('Enables closing the switcher with a Super key press and activates "Double Super Key Press" option Note: This option may cause brief stuttering in animations/videos when using Super key to open/close the switcher. This does not affect the usual Alt/Super+Tab experience'),
        enableSuperSwitch,
        'enableSuper'
    );

    const superDoublePressSwitch = itemFactory.newComboBox();
    optDict.SuperDoublePress = itemFactory.getRowWidget(
        _('Double Super Key Press (needs previous option enabled)'),
        _('Initial double press of the Super key (or key set as Window Action Key) may perform selected action.'),
        superDoublePressSwitch,
        'superDoublePressAction',
        [
            [_('Default'), 1],
            [_('Toggle Switcher Mode'), 2],
            [_('Open Activities Overview'), 3],
            [_('Open App Grid Overview'), 4],
            [_('Activate Previous Window'), 5],
        ]
    );

    superDoublePressSwitch.set_sensitive(opt.get('enableSuper'));
    enableSuperSwitch.connect('notify::active', widget => {
        superDoublePressSwitch.set_sensitive(widget.active);
    });


    optDict.HotEdge = itemFactory.getRowWidget(
        _('Hot Edge')
    );

    optDict.HotEdgePosition = itemFactory.getRowWidget(
        _('Hot Edge Position'),
        _('Hot edge activates the App or Window switcher when the mouse pointer applies pressure to the edge of the monitor'),
        itemFactory.newComboBox(),
        'hotEdgePosition',
        [
            [_('Disabled'), 0],
            [_('Top'),      1],
            [_('Bottom'),   2],
        ]
    );

    optDict.HotEdgeFullScreen = itemFactory.getRowWidget(
        _('Enable Hot Edge in Fullscreen Mode'),
        _('Disable this option if, for instance, you are playing fullscreen games where triggering the switcher popup is undesirable'),
        itemFactory.newSwitch(),
        'hotEdgeFullScreen'
    );

    optDict.HotEdgeMode = itemFactory.getRowWidget(
        _('Hot Edge Action'),
        _('Default switcher mode for Hot Edge trigger.'),
        itemFactory.newComboBox(),
        'hotEdgeMode',
        [
            [_('App Switcher'),     0],
            [_('Window Switcher'),  1],
        ]
    );

    optDict.HotEdgeMonitor = itemFactory.getRowWidget(
        _('Hot Edge Monitor'),
        _('Specifies whether the hot edge is set for the primary monitor only or for all active monitors'),
        itemFactory.newComboBox(),
        'hotEdgeMonitor',
        [
            [_('Primary'), 0],
            [_('All'),     1],
        ]
    );

    const hotPressureAdjustment = new Gtk.Adjustment({
        upper: 500,
        lower: 0,
        step_increment: 10,
        page_increment: 50,
    });

    optDict.HotEdgePressure = itemFactory.getRowWidget(
        _('Hot Edge Pressure Threshold'),
        _('Adjusts the pressure the mouse pointer needs to apply to trigger the hot edge'),
        itemFactory.newSpinButton(hotPressureAdjustment),
        'hotEdgePressure'
    );

    const hotWidthAdjustment = new Gtk.Adjustment({
        upper: 100,
        lower: 10,
        step_increment: 5,
        page_increment: 10,
    });

    optDict.HotEdgeWidth = itemFactory.getRowWidget(
        _('Hot Edge Width (%)'),
        _('Adjusts the width of the hot edge barrier as a percentage of the screen width'),
        itemFactory.newSpinButton(hotWidthAdjustment),
        'hotEdgeWidth'
    );

    optDict.Dash = itemFactory.getRowWidget(
        _('Dash')
    );

    optDict.ShowDash = itemFactory.getRowWidget(
        _('Dash Visibility'),
        _('Manages the visibility of the Dash in the Activities overview. You can disable the Dash if you are using AATWS instead'),
        itemFactory.newComboBox(),
        'showDash',
        [
            [_('Leave Unchanged'), 0],
            [_('Show'),            1],
            [_('Hide'),            2],
        ]
    );

    optDict.Input = itemFactory.getRowWidget(
        _('Keyboard Layout')
    );

    optDict.RememberInput = itemFactory.getRowWidget(
        _('Remember Keyboard'),
        _('AATWS can remember the keyboard layout you set with the Shift + Enter shortcut. Note: This option may significantly slow down window switching, as changing the input source is slow in GNOME Shell'),
        itemFactory.newSwitch(),
        'rememberInput'
    );

    // ////////////////////////////////////////////////

    // Window Switcher options
    optDict.Controls = itemFactory.getRowWidget(
        _('Controls')
    );

    optDict.ShortcutWin = itemFactory.getRowWidget(
        _('Keyboard Shortcuts'),
        _('AATWS replaces the default window switcher popups. Set keyboard shortcuts in GNOME Settings app > Keyboard > Keyboard Shortcuts > "Switch windows" and "Switch windows of an application."'),
        itemFactory.newLabel()
    );

    optDict.Behavior = itemFactory.getRowWidget(
        _('Behavior')
    );

    optDict.DefaultFilterWin = itemFactory.getRowWidget(
        _('Default Filter'),
        _('Specifies the filter for windows that should appear in the list. The filter can also be changed on the fly using a hotkey'),
        itemFactory.newComboBox(),
        'winSwitcherPopupFilter',
        [
            [_('All'),               1],
            [_('Current Workspace'), 2],
            [_('Current Monitor'),   3],
        ]
    );

    optDict.DefaultSortingWin = itemFactory.getRowWidget(
        _('Default Sorting'),
        _('Determines the order in which the list of windows should be sorted'),
        itemFactory.newComboBox(),
        'winSwitcherPopupSorting',
        [
            [_('Most Recently Used'),     1],
            [_('Stable Sequence'),        2],
            [_('Stable - Current First'), 3],
        ]
    );

    optDict.DefaultGrouping = itemFactory.getRowWidget(
        _('Default Grouping'),
        _('Groups windows in the list based on the selected key'),
        itemFactory.newComboBox(),
        'winSwitcherPopupOrder',
        [
            [_('None'),                  1],
            [_('Current Monitor First'), 2],
            [_('Applications'),          3],
            [_('Workspaces'),            4],
        ]
    );

    optDict.DistinguishMinimized = itemFactory.getRowWidget(
        _('Distinguish Minimized Windows'),
        _('Fades the front icon of a minimized window item for distinction'),
        itemFactory.newSwitch(),
        'winMarkMinimized'
    );

    const skipMinimizedBtn = itemFactory.newSwitch();
    optDict.SkipMinimized = itemFactory.getRowWidget(
        _('Skip Minimized Windows'),
        _('Excludes minimized windows from the list. Note: This option also impacts the App switcher.'),
        skipMinimizedBtn,
        'winSkipMinimized'
    );

    skipMinimizedBtn.connect('notify::active', () => {
        minimizedLastBtn.set_sensitive(!skipMinimizedBtn.active);
    });

    const minimizedLastBtn = itemFactory.newSwitch();
    minimizedLastBtn.set_sensitive(!opt.get('winSkipMinimized'));
    optDict.MinimizedLast = itemFactory.getRowWidget(
        _('Minimized Windows Last'),
        _('Places minimized windows at the end of the list, aligning with the default behavior in GNOME Shell.'),
        minimizedLastBtn,
        'winMinimizedLast'
    );

    optDict.IncludeModals = itemFactory.getRowWidget(
        _('Include Modal Windows'),
        _('Modal windows, such as dialogs, are usually attached to their parent window, and focusing on the parent window also focuses their modal window, but not always'),
        itemFactory.newSwitch(),
        'winIncludeModals'
    );

    optDict.SearchAllWindows = itemFactory.getRowWidget(
        _('Search All Windows'),
        _('Automatically switches filter mode (if possible) when no results are found for the currently selected filter mode'),
        itemFactory.newSwitch(),
        'winSwitcherPopupSearchAll'
    );

    optDict.SearchApplications = itemFactory.getRowWidget(
        _('Search Applications'),
        _('Searches for installed applications to launch new ones when no window matches the specified pattern'),
        itemFactory.newSwitch(),
        'winSwitcherPopupSearchApps'
    );

    optDict.Content = itemFactory.getRowWidget(
        _('Content')
    );

    optDict.ShowWindowTitle = itemFactory.getRowWidget(
        _('Show Window Titles'),
        _('Displays window titles (ellipsized if needed) under each window item in the switcher list'),
        itemFactory.newComboBox(),
        'winSwitcherPopupTitles',
        [
            [_('Enabled'), 1],
            [_('Disabled'), 2],
            [_('Single App Mode only'), 3],
        ]
    );

    optDict.ShowWorkspaceIndex = itemFactory.getRowWidget(
        _('Show Workspace Index'),
        _('Adds a label with the corresponding workspace index over each window thumbnail'),
        itemFactory.newSwitch(),
        'winSwitcherPopupWsIndexes'
    );

    optDict.AppearanceWin = itemFactory.getRowWidget(
        _('Appearance')
    );

    const popupSizeAdjustment = new Gtk.Adjustment({
        upper: 512,
        lower: 16,
        step_increment: 8,
        page_increment: 32,
    });

    optDict.WindowPreviewSize = itemFactory.getRowWidget(
        _('Window Preview Size (px)'),
        null,
        itemFactory.newSpinButton(popupSizeAdjustment),
        'winSwitcherPopupPreviewSize'
    );

    let popupIconSizeAdjustment = new Gtk.Adjustment({
        upper: 512,
        lower: 16,
        step_increment: 8,
        page_increment: 32,
    });

    optDict.WindowIconSize = itemFactory.getRowWidget(
        _('Window Icon Size (px)'),
        null,
        itemFactory.newSpinButton(popupIconSizeAdjustment),
        'winSwitcherPopupIconSize'
    );

    // //////////////////////////////////////////////////////////////////////

    // App Switcher options
    // group title already defined in the window section
    // optDict.Controls = itemFactory.getRowWidget(
    //    _('Controls')
    // );

    optDict.ShortcutApp = itemFactory.getRowWidget(
        _('Keyboard Shortcut'),
        _('AATWS replaces the default app switcher popup. Set keyboard shortcut in GNOME Settings app > Keyboard > Keyboard Shortcuts > "Switch applications"'),
        itemFactory.newLabel()
    );

    // optDict.Behavior = itemFactory.getRowWidget(
    //    _('Behavior')
    // );

    optDict.DefaultFilterApp = itemFactory.getRowWidget(
        _('Default Filter'),
        _('Specifies the filter for apps that should appear in the list. The filter can also be changed on the fly using a hotkey'),
        itemFactory.newComboBox(),
        'appSwitcherPopupFilter',
        [
            [_('All'),               1],
            [_('Current Workspace'), 2],
            [_('Current Monitor'),   3],
        ]
    );

    optDict.DefaultSortingApp = itemFactory.getRowWidget(
        _('Default Sorting'),
        _('Determines the order in which the list of apps should be sorted'),
        itemFactory.newComboBox(),
        'appSwitcherPopupSorting',
        [
            [_('Most Recently Used'), 1],
            [_('Stable Sequence'),    2],
        ]
    );

    optDict.RaiseFirstWinOnly = itemFactory.getRowWidget(
        _('Raise First Window Only'),
        _('When activating a running app, only its most recently used window is raised, rather than rising all app windows above windows of other apps'),
        itemFactory.newSwitch(),
        'appSwitcherPopupRaiseFirstOnly'
    );

    optDict.SearchPrefRunning = itemFactory.getRowWidget(
        _('Prioritize Running Apps'),
        _('The search engine will give priority to running applications'),
        itemFactory.newSwitch(),
        'appSwitcherPopupSearchPrefRunning'
    );

    let popupAppLimitAdjustment = new Gtk.Adjustment({
        upper: 30,
        lower: 5,
        step_increment: 1,
        page_increment: 1,
    });

    optDict.ResultsLimit = itemFactory.getRowWidget(
        _('Max Number of Search Results'),
        _('Specifies the maximum number of results that can be shown in the switcher'),
        itemFactory.newSpinButton(popupAppLimitAdjustment),
        'appSwitcherPopupResultsLimit'
    );

    optDict.Content = itemFactory.getRowWidget(
        _('Content')
    );

    optDict.ShowAppTitle = itemFactory.getRowWidget(
        _('Show App Names'),
        _('Displays the name of the application under each app icon in the list'),
        itemFactory.newSwitch(),
        'appSwitcherPopupTitles'
    );

    optDict.IncludeFavorites = itemFactory.getRowWidget(
        _('Include Favorite (Pinned) Apps'),
        _('Include favorite apps pinned to Dash, even when not running, allowing you to use the switcher as an app launcher'),
        itemFactory.newSwitch(),
        'appSwitcherPopupFavoriteApps'
    );

    optDict.IncludeShowAppsIcon = itemFactory.getRowWidget(
        _('Include Show Apps Icon'),
        _('Adds a button to access application grid'),
        itemFactory.newSwitch(),
        'appSwitcherPopupIncludeShowAppsIcon'
    );

    const showWinCounterSwitch = itemFactory.newSwitch();
    optDict.ShowWinCounter = itemFactory.getRowWidget(
        _('Show Window Counter'),
        _('Adds a label with the number of windows opened by each app corresponding to the current filter mode.'),
        showWinCounterSwitch,
        'appSwitcherPopupWinCounter'
    );

    const hideWinCounterForSingleWindowSwitch = itemFactory.newSwitch();
    optDict.HideWinCounterForSingleWindow = itemFactory.getRowWidget(
        _('Hide Window Counter For Single-Window Apps'),
        _('Hides the number of windows of an app if there is just a single window open for that app.'),
        hideWinCounterForSingleWindowSwitch,
        'appSwitcherPopupHideWinCounterForSingleWindow'
    );

    hideWinCounterForSingleWindowSwitch.set_sensitive(opt.get('appSwitcherPopupWinCounter'));
    showWinCounterSwitch.connect('notify::active', widget => {
        hideWinCounterForSingleWindowSwitch.set_sensitive(widget.active);
    });

    optDict.AppearanceApp = itemFactory.getRowWidget(
        _('Appearance')
    );

    let popupAppIconSizeAdjustment = new Gtk.Adjustment({
        upper: 512,
        lower: 16,
        step_increment: 8,
        page_increment: 32,
    });

    optDict.AppIconSize = itemFactory.getRowWidget(
        _('App Icon Size (px)'),
        null,
        itemFactory.newSpinButton(popupAppIconSizeAdjustment),
        'appSwitcherPopupIconSize'
    );


    // //////////////////////////////////////////////////////////////////////////////////////////////

    optDict.ExternalTrigger = itemFactory.getRowWidget(
        _('Options for the mouse triggered switcher (using Hot Edge or CHC-E extension)')
    );

    optDict.SingleOnActivate = itemFactory.getRowWidget(
        _('Show App Windows Instead of Direct Activation'),
        _('Choose between immediate activation of the clicked app (activated by a mouse button set to Activate Item) or switch to the window list to access other available windows (based on the current filter setting)'),
        itemFactory.newComboBox(),
        'appSwitcherPopupShowWinsOnActivate',
        [
            [_('Disable'), 0],
            [_('Focused Apps'), 1],
            [_('Focused Multi-Window Apps'), 2],
        ]
    );

    optDict.AppIncludeFavorites = itemFactory.getRowWidget(
        _('Force App Switcher Include Favorites (Pinned)'),
        _('Include favorite apps pinned to Dash to the App switcher regardless the App switcher settings.'),
        itemFactory.newSwitch(),
        'switcherPopupExtAppFavorites'
    );

    optDict.AppStableOrder = itemFactory.getRowWidget(
        _('Force App Switcher Stable Sequence'),
        _('When the app switcher is triggered using a mouse, the default app order can be overridden to behave more like a dock. Pinned (favorite) apps (if included) maintain the order they have in the Dash, and other open apps keep the order in which they were launched'),
        itemFactory.newSwitch(),
        'switcherPopupExtAppStable'
    );

    optDict.AutomaticallyReverseOrder = itemFactory.getRowWidget(
        _('Automatically Reverse List Order'),
        _('Displays switcher items from right to left if it brings the mouse pointer closer to the first item'),
        itemFactory.newSwitch(),
        'switcherPopupReverseAuto'
    );

    let popupPointerTimeoutAdjustment = new Gtk.Adjustment({
        upper: 60000,
        lower: 100,
        step_increment: 100,
        page_increment: 1000,
    });

    optDict.PointerOutTimeout = itemFactory.getRowWidget(
        _('Pointer Out Timeout (ms)'),
        _('If the switcher is activated by the mouse, the pop-up closes after this period of inactivity if the mouse pointer is outside the pop-up.'),
        itemFactory.newSpinButton(popupPointerTimeoutAdjustment),
        'switcherPopupPointerTimeout'
    );

    optDict.ActivateOnHide = itemFactory.getRowWidget(
        _('Activate Selected Item on Hide'),
        _('When you move mouse pointer outside the switcher pop-up and "Pointer out timeout" expires, the selected item will be activated before the pop-up hides.'),
        itemFactory.newSwitch(),
        'switcherPopupActivateOnHide'
    );

    optDict.MousePointerPosition = itemFactory.getRowWidget(
        _('Pop-up at Mouse Pointer Position'),
        _('Applies only to external triggers like CHC-E extension. If the switcher was triggered using a mouse, it will be placed at the position of the mouse pointer'),
        itemFactory.newSwitch(),
        'switcherPopupPointer'
    );

    let animationFactorAdjustment = new Gtk.Adjustment({
        upper: 200,
        lower: 0,
        step_increment: 10,
        page_increment: 100,
    });

    optDict.AnimationTimeFactor = itemFactory.getRowWidget(
        _('Animation Speed (%)'),
        _('Adjusts speed of an show/hide animation.'),
        itemFactory.newSpinButton(animationFactorAdjustment),
        'animationTimeFactor'
    );

    optDict.WindowManager = itemFactory.getRowWidget(
        _('Window Manager')
    );

    optDict.AlwaysActivateFocused = itemFactory.getRowWidget(
        _('Always Activate Focused Window'),
        _('For GNOME Shell version < 43, this is a workaround for the window manager. It aims to prevent situations where the focused window is not activated, causing it not to update its position in the window switcher list. This can occur when you minimize a window, the window manager focuses the next window in the stack but leaves it inactive until the user interacts with the window'),
        itemFactory.newSwitch(),
        'wmAlwaysActivateFocused'
    );

    optDict.Workspace = itemFactory.getRowWidget(
        _('Workspace Manager')
    );

    optDict.ShowWsSwitcherPopup = itemFactory.getRowWidget(
        _('Show Workspace Switcher Pop-up'),
        _('Displays the workspace switcher pop-up while switching workspaces'),
        itemFactory.newSwitch(),
        'wsShowSwitcherPopup'
    );

    optDict.Thumbnails = itemFactory.getRowWidget(
        _('DND Window Thumbnails')
    );

    let tmbScaleAdjustment = new Gtk.Adjustment({
        lower: 5,
        upper: 50,
        step_increment: 1,
        page_increment: 10,
    }
    );

    optDict.ThumbnailScale = itemFactory.getRowWidget(
        _('Thumbnail Height Scale (%)'),
        _('Adjusts the default height of the thumbnail relative to the screen height'),
        itemFactory.newSpinButton(tmbScaleAdjustment),
        'winThumbnailScale'
    );

    // /////////////////////////////////////////////////////////////////////

    optDict.Common = itemFactory.getRowWidget(
        _('Common')
    );

    optDict.PrimaryBackground = itemFactory.getRowWidget(
        _('Primary Click on switcher Background'),
        _('Action triggered by a click of the primary (usually left) mouse button on the switcher pop-up background'),
        itemFactory.newComboBox(),
        'switcherPopupPrimClickIn',
        actionList
    );

    optDict.SecondaryBackground = itemFactory.getRowWidget(
        _('Secondary Click on switcher Background'),
        _('Action triggered by a click of the secondary (usually right) mouse button on the switcher pop-up background'),
        itemFactory.newComboBox(),
        'switcherPopupSecClickIn',
        actionList
    );

    optDict.MiddleBackground = itemFactory.getRowWidget(
        _('Middle Click on switcher Background'),
        _('Action triggered by a click of the middle mouse button on the switcher pop-up background'),
        itemFactory.newComboBox(),
        'switcherPopupMidClickIn',
        actionList
    );

    optDict.ScrollBackground = itemFactory.getRowWidget(
        _('Scroll over switcher Background'),
        _('Action triggered by scrolling over the switcher pop-up, but not over the switcher item'),
        itemFactory.newComboBox(),
        'switcherPopupScrollIn',
        actionList
    );

    optDict.PrimaryOutside = itemFactory.getRowWidget(
        _('Primary Click Outside switcher'),
        _('Action triggered by a click of the primary (usually left) mouse button outside the switcher pop-up'),
        itemFactory.newComboBox(),
        'switcherPopupPrimClickOut',
        actionList
    );

    optDict.SecondaryOutside = itemFactory.getRowWidget(
        _('Secondary Click Outside switcher'),
        _('Action triggered by a click of the secondary (usually right) mouse button outside the switcher pop-up'),
        itemFactory.newComboBox(),
        'switcherPopupSecClickOut',
        actionList
    );

    optDict.MiddleOutside = itemFactory.getRowWidget(
        _('Middle Click Outside switcher'),
        _('Action triggered by a click of the middle mouse button outside the switcher pop-up'),
        itemFactory.newComboBox(),
        'switcherPopupMidClickOut',
        actionList
    );

    optDict.ScrollOutside = itemFactory.getRowWidget(
        _('Scroll Outside switcher'),
        _('Action triggered by scrolling outside of the switcher pop-up'),
        itemFactory.newComboBox(),
        'switcherPopupScrollOut',
        actionList
    );

    // ////////////////////////////////////////////////////////////////////////////////

    optDict.WindowSwitcher = itemFactory.getRowWidget(
        _('Window Switcher')
    );

    optDict.ScrollWinItem = itemFactory.getRowWidget(
        _('Scroll Over Item'),
        _('Action triggered by scrolling over any switcher item (window icon)'),
        itemFactory.newComboBox(),
        'winSwitcherPopupScrollItem',
        actionList
    );

    let winActionList = [...actionList];
    // winActionList.splice(6,1);
    // winActionList.splice(1,1);

    optDict.PrimaryWinItem = itemFactory.getRowWidget(
        _('Primary Click on Item'),
        _('Action triggered by a click of the primary (usually left) mouse button on any switcher item (window icon)'),
        itemFactory.newComboBox(),
        'winSwitcherPopupPrimClickItem',
        winActionList
    );

    optDict.SecondaryWinItem = itemFactory.getRowWidget(
        _('Secondary Click on Item'),
        _('Action triggered by a click of the secondary (usually right) mouse button on any switcher item (window icon)'),
        itemFactory.newComboBox(),
        'winSwitcherPopupSecClickItem',
        winActionList
    );

    optDict.MiddleWinItem = itemFactory.getRowWidget(
        _('Middle Click on Item'),
        _('Action triggered by a click of the middle mouse button on any switcher item (window icon)'),
        itemFactory.newComboBox(),
        'winSwitcherPopupMidClickItem',
        winActionList
    );

    // ///////////////////////////////////////////////////////////////////////////////////

    const  appActionList = [...actionList];
    /* actionList.splice(6,1);
    actionList.splice(1,1);*/

    optDict.AppSwitcher = itemFactory.getRowWidget(
        _('App Switcher')
    );

    optDict.ScrollAppItem = itemFactory.getRowWidget(
        _('Scroll Over Item'),
        _('Action triggered by scrolling over any switcher item (window icon)'),
        itemFactory.newComboBox(),
        'appSwitcherPopupScrollItem',
        appActionList
    );

    // appActionList.splice(6,1);
    // appActionList.splice(1,1);
    optDict.PrimaryAppItem = itemFactory.getRowWidget(
        _('Primary Click on Item'),
        _('Action triggered by a click of the primary (usually left) mouse button on any switcher item (app icon)'),
        itemFactory.newComboBox(),
        'appSwitcherPopupPrimClickItem',
        appActionList
    );

    optDict.SecondaryAppItem = itemFactory.getRowWidget(
        _('Secondary Click on Item'),
        _('Action triggered by a click of the secondary (usually right) mouse button on any switcher item (app icon)'),
        itemFactory.newComboBox(),
        'appSwitcherPopupSecClickItem',
        appActionList
    );

    optDict.MiddleAppItem = itemFactory.getRowWidget(
        _('Middle Click on Item'),
        _('Action triggered by a click of the middle mouse button on any switcher item (app icon)'),
        itemFactory.newComboBox(),
        'appSwitcherPopupMidClickItem',
        appActionList
    );

    return optDict;
}

function _getHotkeysOptionList(itemFactory) {
    let optionList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]


    optionList.push(itemFactory.getRowWidget(
        _('Custom hotkeys (you can assign up to 2 characters (keys) to each action)'),
        "You can enter up to two hotkeys for each action, the second one is primarily dedicated to include non [a-zA-Z] characters with Shift pressed.\n\
Clear entry to disable the action.\n\
All hotkeys work directly or with Shift key pressed, if it's set in Preferences or if the Search mode is turned on."
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Shift for Action Hotkeys'),
        _('Single-key action hotkeys, excluding navigation and filter switching, now require holding down the Shift key'),
        itemFactory.newSwitch(),
        'switcherPopupShiftHotkeys'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Filter mode'),
        _('Switches the window/app filter mode - ALL / WS / MONITOR (the Monitor mode is skipped if single monitor is used or if the secondary monitor is empty).'),
        itemFactory.newEntry(),
        'hotkeySwitchFilter'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Search Mode'),
        _('In the search mode, you can enter multiple patterns separated by a space and in arbitrary order to search windows and apps by window titles, app names, app generic names, description, categories, keywords, and app executables. This allows you to find most editor apps by typing "edit", games by typing "game", and so on. You can even search for sections in the GNOME Settings app'),
        itemFactory.newEntry(),
        'hotkeySearch'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Sort Windows by Workspace'),
        _('Sorts windows by workspace, if Filter Mode is set to ALL.'),
        itemFactory.newEntry(),
        'hotkeyGroupWs'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Show Only Windows of Selected App'),
        _('Single App mode - list only the windows of the selected application.'),
        itemFactory.newEntry(),
        'hotkeySingleApp'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Close Window / Quit Application'),
        _('Closes the selected window or quits application, depending on the current Switcher Mode.'),
        itemFactory.newEntry(),
        'hotkeyCloseQuit'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Close All Windows of Selected App'),
        _('Closes all windows in the list that belong to the same application as the selected window/application.'),
        itemFactory.newEntry(),
        'hotkeyCloseAllApp'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Open New Window'),
        _('Opens a new window of the selected application if the application supports it. You can also use default shortcut Ctrl+Enter'),
        itemFactory.newEntry(),
        'hotkeyNewWin'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Move Window/App to Current Workspace/Monitor'),
        _('Moves the selected window or windows of selected application to the current workspace and monitor.\
The current monitor is the one where the switcher pop-up is located, or where the mouse pointer is currently located if the switcher was triggered by a mouse from the Custom Hot Corners - Extended extension.'),
        itemFactory.newEntry(),
        'hotkeyMoveWinToMonitor'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Always on Top'),
        _('Selected window will be raised to stay above all other windows, even if it lose focus. This state is indicated by an icon over the window preview.'),
        itemFactory.newEntry(),
        'hotkeyAbove'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Always on Visible Workspace'),
        _('Window will be visible on all workspaces. This state is indicated by an icon over the window preview.'),
        itemFactory.newEntry(),
        'hotkeySticky'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Fullscreen on New Workspace'),
        _('Moves the selected window to the new empty workspace next to its current workspace and switches the window to the fullscreen mode.\
Next use of this hotkey on the same window moves the window back to its original workspace (if exists) and turns off the fullscreen mode.'),
        itemFactory.newEntry(),
        'hotkeyFsOnNewWs'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Maximize on Current Workspace/Monitor'),
        _('Selected window will be maximized on the current workspace and monitor.\
The current monitor is the one where the switcher pop-up is located, or where the mouse pointer is currently positioned if the switcher was triggered by a mouse.'),
        itemFactory.newEntry(),
        'hotkeyMaximize'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Switcher Mode (Windows/Apps)'),
        _('Toggles between Windows and Applications modes'),
        itemFactory.newEntry(),
        'hotkeySwitcherMode'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Apps Mode: Toggle Include Favorites (Pinned)'),
        _('Allows to show/hide favorite applications pinned to dash in the App switcher list'),
        itemFactory.newEntry(),
        'hotkeyFavorites'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Create Window Thumbnail'),
        _('Creates a thumbnail preview of the selected window and places it at the bottom right of the current monitor. \
You can move the thumbnail anywhere on the screen using a mouse drag & drop and you can make as many thumbnails as you want.\n\
To remove lastly created thumbnail, use this hotkey while pressing Ctrl key, or click on the close button inside thumbnail.\n\
To remove all created thumbnails, use this hotkey while pressing Shift and Ctrl keys.\n\
Thumbnail controls:\n\
    Double click:    \t\t activates the source window\n\
    Primary click:     \t\t toggles scroll wheel function (resize / source)\n\
    Secondary click:    \t\t window preview\n\
    Scroll wheel:       \t\t resizes or changes the source window\n\
    Ctrl + Scroll wheel:  \t changes source window or resize\n\
    Shift + Scroll wheel: \t adjusts opacity'),
        itemFactory.newEntry(),
        'hotkeyThumbnail'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Open Preferences'),
        _('Opens AATWS settings window.'),
        itemFactory.newEntry(),
        'hotkeyPrefs'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Left'),
        _('Has the same functionality as arrow Left key. Selects previous item, if Search mode is off.'),
        itemFactory.newEntry(),
        'hotkeyLeft'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Down'),
        _('Has the same functionality as arrow Down key. Switches to next workspace, if Search mode is off.'),
        itemFactory.newEntry(),
        'hotkeyDown'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Up'),
        _('Has the same functionality as arrow Up key. Switches to previous workspace, if Search mode is off.'),
        itemFactory.newEntry(),
        'hotkeyUp'
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Right'),
        _('Has the same functionality as arrow Right key. Selects next item, if Search mode is off.'),
        itemFactory.newEntry(),
        'hotkeyRight'
    )
    );

    // Fixed Hotkeys ///////////////////////////////////////////////
    // instead of settings variables include strings with predefined hotkeys
    optionList.push(itemFactory.getRowWidget(
        _('Fixed Hotkeys')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Up/Down Keys Action'),
        _('Choose what Up/Down arrow keys should do.'),
        itemFactory.newComboBox(),
        'switcherPopupUpDownAction',
        [
            [_('Nothing'), 1],
            [_('Switch Workspace'), 2],
            [_('Toggle Single App Mode'), 3],
            [_('Switcher Mode/Single App Mode'), 4],
        ]
    )
    );

    /* optionList.push(itemFactory.getRowWidget(
        _('Switch Filter Mode'),
        _('Switches the window filter mode - ALL / WS / MONITOR (the Monitor mode is skipped if single monitor is used or if the secondary monitor is empty).'),
        itemFactory.newEntry(),
        _('Ctrl + Super')
    )
    );*/

    optionList.push(itemFactory.getRowWidget(
        _('Select Previous/Next Item'),
        '',
        itemFactory.newEntry(),
        _('Left/Right Arrow Keys')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Window Mode: Iterate over Applications'),
        _('Switcher is in the Window mode: first press of the hotkey sorts windows by applications, each subsequent key press selects first window of the next app. Shift key changes direction.'),
        itemFactory.newEntry(),
        _('`/~ (key above Tab)')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('App Mode: Switch to Single App Switcher'),
        _('Switcher is in the App mode: first press of the hotkey switches to Single App mode, each subsequent key press selects next window and Tab key switches back to the App view.'),
        itemFactory.newEntry(),
        _('`/~ (key above Tab)')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Toggle Switcher Mode'),
        _('Switch between Apps and Windows Modes.'),
        itemFactory.newEntry(),
        _('Ctrl + `/~')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Toggle Search Mode On/Off'),
        _('See the customizable hotkey above for details.'),
        itemFactory.newEntry(),
        _('Insert')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Clear Search Entry'),
        _('Clears typed pattern when the switcher is in Search mode.'),
        itemFactory.newEntry(),
        _('Del')
    )
    );

    /* optionList.push(itemFactory.getRowWidget(
        _('Force Quit'),
        _('Sends kill -9 signal to the selected application or application of selected window.'),
        itemFactory.newEntry(),
        _('Ctrl + Del')
    )
    );*/

    optionList.push(itemFactory.getRowWidget(
        _('Toggle Preview Selected Window'),
        _('Toggles preview of selected window On/Off.'),
        itemFactory.newEntry(),
        _('Space, NumKey 0')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Move Switcher to Adjacent Monitor'),
        '',
        itemFactory.newEntry(),
        _('Shift + Left/Right/Up/Down')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Move Switcher to Next Monitor'),
        _('Order is given by the Shell'),
        itemFactory.newEntry(),
        _('Ctrl + Tab')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Move Window/App to Adjacent Workspace'),
        _('Moves the selected window or windows of selected application to the adjacent workspace and monitor.'),
        itemFactory.newEntry(),
        _('Ctrl + UP/Left/Down/Right')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Move Window/App to New Workspace'),
        _('Moves the selected window or windows of selected application to the newly created workspace in front of or behind the current workspace.'),
        itemFactory.newEntry(),
        _('Ctrl + Shift + Up/Down')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Reorder Current Workspace'),
        _('Move the current workspace by one position left or right (up or down on GNOME < 40)'),
        itemFactory.newEntry(),
        _('Ctrl + PageUp/PageDown')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Reorder Favorite App'),
        _('In App Mode with Favorites Apps enabled you can change the position of selected Favorite app. This change is system-wide.\n\
If apps are ordered by MRU, first pres of the hotkey reorders apps by Favorites'),
        itemFactory.newEntry(),
        _('Ctrl + Shift + Left/Right')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Toggle Activities Overview'),
        _('Closes the switcher and toggles Activities Overview.'),
        itemFactory.newEntry(),
        _('Shift + Super')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Toggle App Grid Overview'),
        _('Closes the switcher and toggles App Grid Overview.'),
        itemFactory.newEntry(),
        _('Ctrl + Shift + Super')
    )
    );

    optionList.push(itemFactory.getRowWidget(
        _('Switch Keyboard Layout'),
        _('Switches to the next input source in the list. Current layout is indicated on the top panel.'),
        itemFactory.newEntry(),
        'Shift + Enter/Return'
    )
    );

    return optionList;
}

function getAboutOptionList(itemFactory) {
    const optionList = [];
    // const itemFactory = new OptionsFactory.ItemFactory();

    optionList.push(itemFactory.getRowWidget(
        Me.metadata.name
    ));

    const versionName = Me.metadata['version-name'] ? Me.metadata['version-name'] : '';
    let version = Me.metadata['version'] ? Me.metadata['version'] : '';
    version = versionName && version ? `/${version}` : version;
    const versionStr = `${versionName}${version}`;
    optionList.push(itemFactory.getRowWidget(
        _('Version'),
        null,
        itemFactory.newLabel(versionStr)
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Reset all options'),
        _('Set all options to default values.'),
        itemFactory.newOptionsResetButton()
    ));


    optionList.push(itemFactory.getRowWidget(
        _('Links')
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Homepage'),
        _('Source code and more info about this extension'),
        itemFactory.newLinkButton('https://github.com/G-dH/advanced-alttab-window-switcher')
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Changelog'),
        _("See what's changed."),
        itemFactory.newLinkButton('https://github.com/G-dH/advanced-alttab-window-switcher/blob/main/CHANGELOG.md')
    ));

    optionList.push(itemFactory.getRowWidget(
        _('GNOME Extensions'),
        _('Rate and comment the extension on GNOME Extensions site.'),
        itemFactory.newLinkButton('https://extensions.gnome.org/extension/4412')
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Report a bug or suggest new feature'),
        null,
        itemFactory.newLinkButton('https://github.com/G-dH/advanced-alttab-window-switcher/issues')
    ));

    optionList.push(itemFactory.getRowWidget(
        _('Buy Me a Coffee'),
        _('Enjoying AATWS? Consider supporting it by buying me a coffee!'),
        itemFactory.newLinkButton('https://buymeacoffee.com/georgdh')
    ));

    return optionList;
}

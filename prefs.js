'use strict';

const { Gtk, GLib, GObject } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;

let   mscOptions;
let   optionsList;

// gettext
const _  = Settings._;

const Actions = Settings.Actions;

const actionList = [
    [_('Do Nothing'),                      Actions.NONE],
    [_('Select Next Item'),                Actions.SELECT_ITEM],
    [_('Activate Selected'),               Actions.ACTIVATE],
    [_('Show Selected'),                   Actions.SHOW],
    [_('Open New Window'),                 Actions.NEW_WINDOW],
    [_('Open Context Menu'),               Actions.MENU],
    [_('Close/Quit Selected'),             Actions.CLOSE_QUIT],
    [_('Force Quit Selected App'),         Actions.KILL],
    [_('Move Selected to Current WS'),     Actions.MOVE_TO_WS],
    [_('Fullscreen Selected on Empty WS'), Actions.FS_ON_NEW_WS],
    [_('Switch Filter Mode'),              Actions.SWITCH_FILTER],
    [_('Toggle Single App Mode'),          Actions.SINGLE_APP],
    [_('Switch Workspace'),                Actions.SWITCH_WS],
    [_('Toggle Switcher Mode'),            Actions.SWITCHER_MODE],
    [_('Group by Applications'),           Actions.GROUP_APP],
    [_('Current Monitor First'),           Actions.CURRENT_MON_FIRST],
    [_('Create Window Thumbnail'),         Actions.THUMBNAIL],
    [_('Hide Switcher Popup'),             Actions.HIDE],
    [_('Open Preferences'),                Actions.PREFS],
];

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    mscOptions = new Settings.MscOptions();
}

function buildPrefsWidget() {
    /*let notebook = new Gtk.Notebook({
        tab_pos: Gtk.PositionType.LEFT,
        visible: true,
    });*/

    const optionsPage = new Gtk.Notebook({
        tab_pos: Gtk.PositionType.TOP,
        visible: true,
    });


    const commonOptionsPage   = new OptionsPageAATWS(_getCommonOptionsList());
    const windowOptionsPage   = new OptionsPageAATWS(_getWindowOptionsList());
    const appOptionsPage      = new OptionsPageAATWS(_getAppOptionsList());
    const hotkeysOptionPage   = new OptionsPageAATWS(_getHotkeysOptionsList());
    /*const helpPage            = new HelpPageAATWS();

    notebook.append_page(optionsPage, new Gtk.Label({
        label: _('Options'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    notebook.append_page(helpPage, new Gtk.Label({
        label: _('Help'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    // notebook.get_nth_page(0).buildPage();
    // notebook.set_current_page(0);
    /* notebook.connect('switch-page', (notebook, page, index) => {
            page.buildPage();
    });*/

    optionsPage.append_page(commonOptionsPage, new Gtk.Label({
        label: _('Common'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    optionsPage.append_page(windowOptionsPage, new Gtk.Label({
        label: _('Window Switcher'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    optionsPage.append_page(appOptionsPage, new Gtk.Label({
        label: _('App Switcher'),
        halign: Gtk.Align.START,
        visible: true,
    }));

    optionsPage.append_page(hotkeysOptionPage, new Gtk.Label({
        label: _('Hotkeys'),
        halign: Gtk.Align.START,
        visible: true,
    }))

    //return notebook;
    return optionsPage;
}

const OptionsPageAATWS = GObject.registerClass(
class OptionsPageAATWS extends Gtk.ScrolledWindow {
    _init(optionList, constructProperties = {
        hscrollbar_policy: Gtk.PolicyType.NEVER,
        vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        vexpand: true,
        hexpand: true,
    }) {
        super._init(constructProperties);

        this.optionList = optionList;
        this._alreadyBuilt = false;
        this.buildPage();
    }

    buildPage() {
        if (this._alreadyBuilt)
            return;

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 10,
            homogeneous: false,
            margin_start: 12,
            margin_end: 20,
            margin_top: 12,
            margin_bottom: 12,
            visible: true,
        });

        let frame;
        let frameBox;
        for (let item of this.optionList) {
            if (!item[0][1]) {
                let lbl = new Gtk.Label({visible: true});
                lbl.set_markup(item[0][0]);
                if (item[1])
                    lbl.set_tooltip_text(item[1]);
                frame = new Gtk.Frame({
                    label_widget: lbl,
                    margin_start: 10,
                    visible: true,
                });
                frameBox = new Gtk.ListBox({
                    selection_mode: null,
                    visible: true,
                });
                mainBox[mainBox.add ? 'add' : 'append'](frame);
                frame[frame.add ? 'add' : 'set_child'](frameBox);
                continue;
            }
            let box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                margin_start: 4,
                margin_end: 4,
                margin_top: 4,
                margin_bottom: 4,
                hexpand: true,
                spacing: 20,
                visible: true,
            });
            for (let i of item[0])
                box[box.add ? 'add' : 'append'](i);
            if (item.length === 2)
                box.set_tooltip_text(item[1]);
            frameBox[frameBox.add ? 'add' : 'append'](box);
        }
        this[this.add ? 'add' : 'set_child'](mainBox);
        this.show_all && this.show_all();
        this._alreadyBuilt = true;
    }
});

function _newGtkSwitch() {
    let sw = new Gtk.Switch({
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
        visible: true,
    });
    sw.is_switch = true;
    return sw;
}

function _newSpinButton(adjustment) {
    let spinButton = new Gtk.SpinButton({
        halign: Gtk.Align.END,
        hexpand: true,
        xalign: 0.5,
        visible: true,
    });
    spinButton.set_adjustment(adjustment);
    spinButton.is_spinbutton = true;
    return spinButton;
}

function _newComboBox() {
    const model = new Gtk.ListStore();
    model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_INT]);
    const comboBox = new Gtk.ComboBox({
        model,
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
        visible: true,
    });
    const renderer = new Gtk.CellRendererText();
    comboBox.pack_start(renderer, true);
    comboBox.add_attribute(renderer, 'text', 0);
    comboBox.is_combo_box = true;
    return comboBox;
}

function _newGtkEntry() {
    const entry = new Gtk.Entry({
        width_chars: 3,
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
        visible: true,
        xalign: 0.5,
    });
    entry.is_entry = true;
    return entry;
}

function _optionsItem(text, tooltip, widget, variable, options = []) {
    let item = [[]];
    let label;
    if (widget) {
        label = new Gtk.Label({
            halign: Gtk.Align.START,
            visible: true,
        });
        label.set_markup(text);
    } else {
        label = text;
    }
    item[0].push(label);
    if (widget)
        item[0].push(widget);
    if (tooltip)
        item.push(tooltip);

    if (widget && widget.is_switch) {
        widget.active = mscOptions[variable];
        widget.connect('notify::active', () => {
            mscOptions[variable] = widget.active;
        });
    } else if (widget && widget.is_spinbutton) {
        widget.value = mscOptions[variable];
        widget.timeout_id = null;
        widget.connect('value-changed', () => {
            widget.update();
            if (widget.timeout_id)
                GLib.Source.remove(widget.timeout_id);

            widget.timeout_id = GLib.timeout_add(
                GLib.PRIORITY_DEFAULT,
                500,
                () => {
                    mscOptions[variable] = widget.value;
                    widget.timeout_id = null;
                    return 0;
                }
            );
        });
    } else if (widget && widget.is_combo_box) {
        let model = widget.get_model();
        for (const [label, value] of options) {
            let iter;
            model.set(iter = model.append(), [0, 1], [label, value]);
            if (value === mscOptions[variable])
                widget.set_active_iter(iter);
        }
        widget.connect('changed', () => {
            const [success, iter] = widget.get_active_iter();
            if (!success)
                return;

            mscOptions[variable] = model.get_value(iter, 1);
        });
    } else if (widget && widget.is_entry) {
        if (variable.startsWith('hotkey')) {
            widget.connect('changed', (entry) => {
                if (entry._doNotEdit)
                    return;
                entry._doNotEdit = true;
                let text = entry.get_text();
                let txt = '';
                for (let i=0; i < text.length; i++) {
                    //if (/[a-zA-Z0-9]|/.test(text[i])) {
                    let char = text[i].toUpperCase();
                    if (!txt.includes(char))
                        txt += char;
                    //}
                }
                txt = txt.slice(0, 2);
                entry.set_text(txt);
                entry._doNotEdit = false;
                mscOptions[variable] = txt;
            });
            widget.set_text(mscOptions[variable]);
        } else {
            widget.width_chars = 25;
            widget.set_text(variable);
            widget.editable = false;
        }
    }

    return item;
}

/* function _makeSmall(label) {
    return `<small>${label}</small>`;
} */

function _makeTitle(label) {
    return `<b>${label}</b>`;
}

function _getCommonOptionsList() {
    optionsList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Behavior:')),
        )
    );

    optionsList.push(
        _optionsItem(
            _('Position'),
            null,
            _newComboBox(),
            'switcherPopupPosition',
               [[_('Top'),    1],
                [_('Center'), 2],
                [_('Bottom'), 3]]
        )
    );

    optionsList.push(
        _optionsItem(
            _('Default Monitor'),
            null,
            _newComboBox(),
            'switcherPopupMonitor',
               [[_('Current'), 1],
                [_('Primary'), 2]]
        )
    );

    optionsList.push(
        _optionsItem(
            _('Show selected window/app immediately'),
            _("Bring the window/app to the front (and switch a workspace if needed) immediately after it's selected."),
            _newGtkSwitch(),
            'switcherPopupShowImmediately'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Search mode as default'),
            _('Type to search immediately after the switcher popup shows up. Hotkeys can be used while holding down the Shift key.'),
            _newGtkSwitch(),
            'switcherPopupStartSearch'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Action hotkeys require Shift'),
            _('A-Z hotkeys, excuding those for navigation and filter switching, will require Shift key pressed to work. Very useful when you start to type without switching to Type to Search mode.'),
            _newGtkSwitch(),
            'switcherPopupShiftHotkeys'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Wraparound selector'),
            _('Whether the selection should continue from the last item to the first one and vice versa.'),
            _newGtkSwitch(),
            'switcherPopupWrap'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Mouse hover selects item'),
            _('Whether hovering the mouse pointer over a switcher item selects the item. If the switcher is triggered by a mouse, the mouseover selection is always active.'),
            _newGtkSwitch(),
            'switcherPopupHoverSelect'
        )
    );

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Appearance:')),
        )
    );

    optionsList.push(
        _optionsItem(
            _('Show hotkeys F1-F12 for direct activation'),
            _('The hotkeys will work independently on this option.'),
            _newGtkSwitch(),
            'switcherPopupHotKeys'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Show status'),
            _('Whether the label indicating filter, grouping and sorting modes should be displayed at the bottom left of the popup.'),
            _newGtkSwitch(),
            'switcherPopupStatus'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Overlay Title'),
            _('Whether the item title label shoud be displayed with bigger font in the overlay label above (or below if needed) the switcher popup.'),
            _newGtkSwitch(),
            'switcherPopupOverlayTitle'
        )
    );

    /*actionList.splice(6,1);
    actionList.splice(1,1);*/

    let singlePrevSizeAdjustment = new Gtk.Adjustment({
        upper: 512,
        lower: 16,
        step_increment: 8,
        page_increment: 32,
    });

    optionsList.push(
        _optionsItem(
            _('Single app preview size (px)'),
            null,
            _newSpinButton(singlePrevSizeAdjustment),
            'singleAppPreviewSize'
        )
    );

    let popupTimeoutAdjustment = new Gtk.Adjustment({
        upper: 400,
        lower: 10,
        step_increment: 10,
        page_increment: 100,
    });

    optionsList.push(
        _optionsItem(
            _('Delay showing switcher (ms)'),
            _("Delay showing the popup so that fast Alt+Tab users aren't disturbed by the popup briefly flashing."),
            _newSpinButton(popupTimeoutAdjustment),
            'switcherPopupTimeout'
        )
    );

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Mouse control:')),
        )
    );

    optionsList.push(
        _optionsItem(
            _('Primary Click on switcher background'),
            _('Action to be triggered by a click of the primary (usualy left) mouse button on the switcher popup background'),
            _newComboBox(),
            'switcherPopupPrimClickIn',
            actionList
        )
    );

    optionsList.push(
        _optionsItem(
            _('Secondary Click on switcher background'),
            _('Action to be triggered by a click of the secondary (usualy right) mouse button on the switcher popup background'),
            _newComboBox(),
            'switcherPopupSecClickIn',
            actionList
        )
    );

    optionsList.push(
        _optionsItem(
            _('Middle Click on switcher background'),
            _('Action to be triggered by a click of the middle mouse button on the switcher popup background'),
            _newComboBox(),
            'switcherPopupMidClickIn',
            actionList
        )
    );

    optionsList.push(
        _optionsItem(
            _('Scroll over switcher background'),
            _('Action to be triggered by scrolling over the switcher popup, but not over the switcher item'),
            _newComboBox(),
            'switcherPopupScrollIn',
            actionList
        )
    );

    optionsList.push(
        _optionsItem(
            _('Primary Click outside switcher'),
            _('Action to be triggered by a click of the primary (usualy left) mouse button outside the switcher popup'),
            _newComboBox(),
            'switcherPopupPrimClickOut',
            actionList
        )
    );

    optionsList.push(
        _optionsItem(
            _('Secondary Click outside switcher'),
            _('Action to be triggered by a click of the secondary (usualy right) mouse button outside the switcher popup'),
            _newComboBox(),
            'switcherPopupSecClickOut',
            actionList
        )
    );

    optionsList.push(
        _optionsItem(
            _('Middle Click outside switcher'),
            _('Action to be triggered by a click of the middle mouse button outside the switcher popup'),
            _newComboBox(),
            'switcherPopupMidClickOut',
            actionList
        )
    );

    optionsList.push(
        _optionsItem(
            _('Scroll outside switcher popup'),
            _('Action to be triggered by scrolling outside of the switcher popup'),
            _newComboBox(),
            'switcherPopupScrollOut',
            actionList
        )
    );

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Workspace switcher:')),
        )
    );

    optionsList.push(
        _optionsItem(
            _('Wraparound'),
            _('Whether the switcher should continue from the last workspace to the first one and vice versa.'),
            _newGtkSwitch(),
            'wsSwitchWrap'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Ignore last (empty) workspace'),
            null,
            _newGtkSwitch(),
            'wsSwitchIgnoreLast'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Show workspace indicator'),
            null,
            _newGtkSwitch(),
            'wsSwitchIndicator'
        )
    );


    optionsList.push(
        _optionsItem(
            _makeTitle(_('DND Window Thumbnails:')),
            `${_('Window thumbnails are overlay clones of windows, can be dragged and dropped by mouse anywhere on the screen.')}\n${
                _('Thumbnail control:')}\n    ${
                _('Double click:    \t\tactivate source window')}\n    ${
                _('Primary click:   \t\ttoggle scroll wheel function (resize / source)')}\n    ${
                _('Secondary click: \t\tremove thumbnail')}\n    ${
                _('Middle click:    \t\tclose source window')}\n    ${
                _('Scroll wheel:    \t\tresize or change source window')}\n    ${
                _('Ctrl + Scroll wheel: \tchange source window or resize')}\n    ${
                _('Shift + Scroll wheel: \tadjust opacity')}\n    `
            ,
            null
        )
    );

    let tmbScaleAdjustment = new Gtk.Adjustment({
        lower: 5,
        upper: 50,
        step_increment: 1,
        page_increment: 10,
    }
    );

    optionsList.push(
        _optionsItem(
            _('Thumbnail height scale (%)'),
            _('Height of the thumbnail relative to the screen height'),
            _newSpinButton(tmbScaleAdjustment),
            'winThumbnailScale'
        )
    );

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Options for external trigger:')),
        )
    );

    optionsList.push(
        _optionsItem(
            _('Pop-up at mouse pointer position if triggered by mouse'),
            _('If variable KEYBOARD_TRIGGERED is set false, then this option is reflected.'),
            _newGtkSwitch(),
            'switcherPopupPointer'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Automatically Reverse Items Order'),
            _('List switcher items from right to left if this helps the mouse pointer be closer to the first item.'),
            _newGtkSwitch(),
            'switcherPopupReverseAuto'
        )
    );

    let popupPointerTimeoutAdjustment = new Gtk.Adjustment({
        upper: 60000,
        lower: 100,
        step_increment: 100,
        page_increment: 1000,
    });


    optionsList.push(
        _optionsItem(
            _('Pointer out timeout (ms)'),
            _('If the switcher is activated by the mouse, the popup closes after this period of inactivity if the mouse pointer is outside the popup.'),
            _newSpinButton(popupPointerTimeoutAdjustment),
            'switcherPopupPointerTimeout'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Activate selected item on hide'),
            _('When you move mouse pointer outside the switcher popup and "Pointer out timeout" expires, selected item will be activated before popup hides.'),
            _newGtkSwitch(),
            'switcherPopupActivateOnHide'
        )
    );

    return optionsList;
}
// ////////////////////////////////////////////////

function _getWindowOptionsList() {
    optionsList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Behavior:')),
        )
    );

    optionsList.push(
        _optionsItem(
            _('Default Filter'),
            null,
            _newComboBox(),
            'winSwitcherPopupFilter',
            [[_('All Windows'),       1],
                [_('Current Workspace'), 2],
                [_('Current Monitor'),   3]]
        )
    );

    optionsList.push(
        _optionsItem(
            _('Default Sorting'),
            null,
            _newComboBox(),
            'winSwitcherPopupSorting',
            [
                [_('Most Recently Used'),     1],
                [_('Stable Sequence'),        2],
                [_('Stable - Current First'), 3],
            ]
        )
    );

    optionsList.push(
        _optionsItem(
            _('Default Grouping'),
            null,
            _newComboBox(),
            'winSwitcherPopupOrder',
            [
                [_('None'),                  1],
                [_('Current Monitor First'), 2],
                [_('Applications'),          3],
                [_('Workspaces'),            4],
            ]
        )
    );

    optionsList.push(
        _optionsItem(
            _('Skip Minimized Windows'),
            null,
            _newGtkSwitch(),
            'winSkipMinimized'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Search All Windows'),
            _('Automaticaly switch filter mode (if possible) when no search results for the currently selected filter mode.'),
            _newGtkSwitch(),
            'winSwitcherPopupSearchAll'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Search Applications'),
            _('Search installed applications to launch new when no window matches the searched pattern.'),
            _newGtkSwitch(),
            'winSwitcherPopupSearchApps'
        )
    );

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Appearance:')),
        )
    );

    optionsList.push(
        _optionsItem(
            _('Show Window Titles under each window item'),
            _('Whether window titles should be displayed under each window item in the switcher list.'),
            _newComboBox(),
            'winSwitcherPopupTitles',
               [[_('Enabled'), 1],
                [_('Disabled'), 2],
                [_('Single App Mode only'), 3]],
        )
    );

    optionsList.push(
        _optionsItem(
            _('Show Workspace Index on each window item'),
            null,
            _newGtkSwitch(),
            'winSwitcherPopupWsIndexes'
        )
    );

    let popupSizeAdjustment = new Gtk.Adjustment({
        upper: 512,
        lower: 16,
        step_increment: 8,
        page_increment: 32,
    });

    optionsList.push(
        _optionsItem(
            _('Window preview size (px)'),
            null,
            _newSpinButton(popupSizeAdjustment),
            'winSwitcherPopupPreviewSize'
        )
    );

    let popupIconSizeAdjustment = new Gtk.Adjustment({
        upper: 512,
        lower: 16,
        step_increment: 8,
        page_increment: 32,
    });

    optionsList.push(
        _optionsItem(
            _('Window icon size (px)'),
            null,
            _newSpinButton(popupIconSizeAdjustment),
            'winSwitcherPopupIconSize'
        )
    );

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Mouse control:')),
        )
    );

    optionsList.push(
        _optionsItem(
            _('Scroll over Item'),
            _('Action to be triggered by scrolling over any switcher item (window icon)'),
            _newComboBox(),
            'winSwitcherPopupScrollItem',
            actionList
        )
    );

    let winActionList = [...actionList];
    /*winActionList.splice(6,1);
    winActionList.splice(1,1);*/
    optionsList.push(
        _optionsItem(
            _('Primary Click on Item'),
            _('Action to be triggered by a click of the primary (usualy left) mouse button on any switcher item (window icon)'),
            _newComboBox(),
            'winSwitcherPopupPrimClickItem',
            winActionList
        )
    );

    optionsList.push(
        _optionsItem(
            _('Secondary Click on Item'),
            _('Action to be triggered by a click of the secondary (usualy right) mouse button on any switcher item (window icon)'),
            _newComboBox(),
            'winSwitcherPopupSecClickItem',
            winActionList
        )
    );

    optionsList.push(
        _optionsItem(
            _('Middle Click on Item'),
            _('Action to be triggered by a click of the middle mouse button on any switcher item (window icon)'),
            _newComboBox(),
            'winSwitcherPopupMidClickItem',
            winActionList
        )
    );

    return optionsList;
}
// //////////////////////////////////////////////////////////////////////

function _getAppOptionsList() {
    optionsList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Behavior:')),
        )
    );

    optionsList.push(
        _optionsItem(
            _('Default Filter'),
            null,
            _newComboBox(),
            'appSwitcherPopupFilter',
            [
                [_('All Windows'),       1],
                [_('Current Workspace'), 2],
                [_('Current Monitor'),   3],
            ]
        )
    );

    optionsList.push(
        _optionsItem(
            _('Default Sorting'),
            null,
            _newComboBox(),
            'appSwitcherPopupSorting',
            [
                [_('Most Recently Used'), 1],
                [_('Stable Sequence'),    2],
            ]
        )
    );

    optionsList.push(
        _optionsItem(
            _('Include Favorite apps'),
            _('List Dash favorite apps even when not runnig so you can use the switcher as a app launcher.'),
            _newGtkSwitch(),
            'appSwitcherPopupFavoriteApps'
        )
    );

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Appearance:')),
        )
    );

    let appActionList = [...actionList];

    let popupAppIconSizeAdjustment = new Gtk.Adjustment({
        upper: 512,
        lower: 16,
        step_increment: 8,
        page_increment: 32,
    });

    optionsList.push(
        _optionsItem(
            _('App icon size (px)'),
            null,
            _newSpinButton(popupAppIconSizeAdjustment),
            'appSwitcherPopupIconSize'
        )
    );

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Mouse control:')),
        )
    );

    optionsList.push(
        _optionsItem(
            _('Scroll over Item'),
            _('Action to be triggered by scrolling over any switcher item (window icon)'),
            _newComboBox(),
            'appSwitcherPopupScrollItem',
            appActionList
        )
    );

    // appActionList.splice(6,1);
    // appActionList.splice(1,1);
    optionsList.push(
        _optionsItem(
            _('Primary Click on Item'),
            _('Action to be triggered by a click of the primary (usualy left) mouse button on any switcher item (app icon)'),
            _newComboBox(),
            'appSwitcherPopupPrimClickItem',
            appActionList
        )
    );

    optionsList.push(
        _optionsItem(
            _('Secondary Click on Item'),
            _('Action to be triggered by a click of the secondary (usualy right) mouse button on any switcher item (app icon)'),
            _newComboBox(),
            'appSwitcherPopupSecClickItem',
            appActionList
        )
    );

    optionsList.push(
        _optionsItem(
            _('Middle Click on Item'),
            _('Action to be triggered by a click of the middle mouse button on any switcher item (app icon)'),
            _newComboBox(),
            'appSwitcherPopupMidClickItem',
            appActionList
        )
    );

    return optionsList;
}

function _getHotkeysOptionsList() {
    let optionsList = [];
    // options item format:
    // [text, tooltip, widget, settings-variable, options for combo]

    optionsList.push(
        _optionsItem(
            _makeTitle(_('Hotkeys configuration:')),
            "You can enter up to two hotkeys for each action, the second one is primarily dedicated to include non [a-zA-Z] keys with Shift pressed.\n\
Delete hotkey to disable the action.\n\
All hotkeys work directly or with Shift key pressed, if it's set in Preferences or if the Search mode is turned on."
        )
    );

    optionsList.push(
        _optionsItem(
            _('Switch Filtering Mode'),
            _('Switches the window filter mode - ALL / WS / MONITOR (the Monitor mode is skipped if single monitor is used or if the secondary monitor is empty).'),
            _newGtkEntry(),
            'hotkeySwitchFilter'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Toggle Search Mode On/Off'),
            _("You can enter multiple patterns separated by a space and in arbitrary order to search windows/apps by titles, app names, app generic names and app executables. Generic names usually contain a basic app description so you can find most of editor apps by typing an 'edit', image viewers by typing 'image' and so on."),
            _newGtkEntry(),
            'hotkeySearch'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Toggle Sort by Workspace'),
            _('Toggles sorting by workspace, when Filter Mode is set to ALL.'),
            _newGtkEntry(),
            'hotkeyGroupWs'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Toggle Show only Windows of Selected App'),
            _('Toggles Single App mode - list only the windows of the selected application.'),
            _newGtkEntry(),
            'hotkeySingleApp'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Close Window / Quit Application'),
            _('Closes the selected window or quits application, depending on the current Switcher Mode.'),
            _newGtkEntry(),
            'hotkeyCloseQuit'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Close all Windows of Selected app'),
            _('Closes all windows in the list that belong to the same application as the selected window/application.'),
            _newGtkEntry(),
            'hotkeyCloseAllApp'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Open New Window'),
            _('Opens a new window of the selected application if the apllication supports it. You can also use default shortcut Ctrl+Enter'),
            _newGtkEntry(),
            'hotkeyNewWin'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Move Window to current Workspace/Monitor'),
            _('Moves the selected window or windows of selected application to the current workspace and monitor.\
The current monitor is the one where the switcher popup is located, or where the mouse pointer is currently located if the switcher was triggered by a mouse from the Custom Hot Corners - Extended extension.'),
            _newGtkEntry(),
            'hotkeyMoveWinToMonitor'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Toggle "Always on Top"'),
            _("Toggles window 'Always on Top'. Also switches to the window workspace and rise the window.\
This state is indicated by the front icon on top instead of the bottom.\
If you press the 'A' key twice, it's actually equivalent to the one press of hotkey for 'Show selected window'"),
            _newGtkEntry(),
            'hotkeyAbove'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Toggle "Always on Visible Workspace"'),
            _(''),
            _newGtkEntry(),
            'hotkeySticky'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Fullscreen on New Workspace'),
            _('Moves the selected window to the new empty workspace next to its current workspace and switches the window to the fullscreen mode.\
Next use of this hotkey on the same window moves the window back to its original workspace (if exists) and turns off the fullscreen mode.'),
            _newGtkEntry(),
            'hotkeyFsOnNewWs'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Toggle Maximize on Current Workspce/Monitor'),
            _('Toggles full maximization of the selected window on the current workspace and monitor.\
The current monitor is the one where the switcher popup is located, or where the mouse pointer is currently located if the switcher was triggered by a mouse from the Custom Hot Corners - Extended extension.'),
            _newGtkEntry(),
            'hotkeyMaximize'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Toggle Switcher Mode (Win/App)'),
            _('Toggles between Windows and Applications modes'),
            _newGtkEntry(),
            'hotkeySwitcherMode'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Create Window Thumbnail'),
            _('Creates a thumbnail preview of the selected window and places it at the bottom right of the current monitor.\n\
You can move the thumbnail anywhere on the screen using a mouse and you can make as many thumbnails as you want.\n\
Thumbnail controls:\n\
    Double click:    \t\tactivates the source window\n\
    Primary click:   \t\ttoggles scroll wheel function (resize / source)\n\
    Secondary click: \t\tremoves the thumbnail\n\
    Middle click:    \t\tcloses the source window\n\
    Scroll wheel:    \t\tresizes or changes the source window\n\
    Ctrl + Scroll wheel: \tchange source window or resize\n\
    Shift + Scroll wheel: \tadjust opacity\n\
    Ctrl + Primary click: \tToggles display the app icon instead of the window preview'),
            _newGtkEntry(),
            'hotkeyThumbnail'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Open Preferences'),
            _('Opens AATWS preferences window.'),
            _newGtkEntry(),
            'hotkeyPrefs'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Left'),
            _('Navigate Left. Adds option to default Arrow and Page navigation keys.'),
            _newGtkEntry(),
            'hotkeyLeft'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Down'),
            _('Navigate Down. Adds option to default Arrow and Page navigation keys.'),
            _newGtkEntry(),
            'hotkeyDown'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Up'),
            _('Navigate Up. Adds option to default Arrow and Page navigation keys.'),
            _newGtkEntry(),
            'hotkeyUp'
        )
    );

    optionsList.push(
        _optionsItem(
            _('Right'),
            _('Navigate Right. Adds option to default Arrow and Page navigation keys.'),
            _newGtkEntry(),
            'hotkeyRight'
        )
    );

    // Fixed Hotkeys ///////////////////////////////////////////////
    optionsList.push(
        _optionsItem(
            _makeTitle(_('Fixed Hotkeys')),
            '',
            null,
        )
    );

    optionsList.push(
        _optionsItem(
            _('Window Mode: Iterate over aplications'),
            _('Switcher is in the Window mode: first press of the hotkey sorts windows by applications, each subsequent key press selects first window of the next app. Shift key changes direction.'),
            _newGtkEntry(),
            _(';/~ (the key above Tab)')
        )
    );

    optionsList.push(
        _optionsItem(
            _('App Mode: Switch to Single app switcher'),
            _('Switcher is in the App mode: first press of the hotkey switches to Single App mode, each subsequent key press selects next window and Tab key switches back to the App view.'),
            _newGtkEntry(),
            _(';/~ (the key above Tab)')
        )
    );

    optionsList.push(
        _optionsItem(
            _('Force Quit'),
            _('Sends kill -9 signal to the selected aplication or application of selected window'),
            _newGtkEntry(),
            _('Ctrl + Del')
        )
    );

    optionsList.push(
        _optionsItem(
            _('Show Selected Window'),
            _('Rises selected window and switches to the window\'s workspace if needed.'),
            _newGtkEntry(),
            _('Space, NumKey 0')
        )
    );

    optionsList.push(
        _optionsItem(
            _('Move Switcher to adjacent Monitor'),
            '',
            _newGtkEntry(),
            _('Ctrl + Left/Right/Up/Down')
        )
    );

    optionsList.push(
        _optionsItem(
            _('Move Switcher to next Monitor'),
            _('Order is given by the Shell'),
            _newGtkEntry(),
            _('Ctrl + Tab')
        )
    );

    optionsList.push(
        _optionsItem(
            _('Reorder current Workspace'),
            _('Move the current workspace by one position left or right (up or down on GNOME < 40)'),
            _newGtkEntry(),
            _('Ctrl + PageUp/PageDown')
        )
    );

    optionsList.push(
        _optionsItem(
            _('Reorder Favorite App'),
            _('In App Mode with Favorites Apps enabled you can change the possition of selected Favorite app. This change is system-wide.\n\
If apps are ordered by MRU, first pres of the hotkey reorders apps by Favorites'),
            _newGtkEntry(),
            _('Ctrl+Shift + Left/Right')
        )
    );

    return optionsList;
}

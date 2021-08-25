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
const {Gtk, Gdk, GLib, GObject} = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.settings;
let   mscOptions;


// gettext
const _  = Settings._;

function init() {
    ExtensionUtils.initTranslations(Me.metadata['gettext-domain']);
    mscOptions = new Settings.MscOptions();
}

function buildPrefsWidget() {
    let notebook = new Gtk.Notebook({
        tab_pos: Gtk.PositionType.LEFT,
        visible: true
    });
    
    const optionsPage = new WsOptionsPage();
    optionsPage.buildPage();
    notebook.append_page(optionsPage , new Gtk.Label({ label: _('Options'),
                                                       halign: Gtk.Align.START,
                                                       visible: true
                                                    })
    );

    //notebook.get_nth_page(0).buildPage();
    //notebook.set_current_page(0);
    /*notebook.connect('switch-page', (notebook, page, index) => {
            page.buildPage();
    });*/

    return notebook;
}

const WsOptionsPage = GObject.registerClass(
class WsOptionsPage extends Gtk.ScrolledWindow {

    _init(constructProperties = {   hscrollbar_policy: Gtk.PolicyType.NEVER,
                                    vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                                    vexpand : true,
                                    hexpand : true
                                }) {
        super._init(constructProperties);

        this._alreadyBuilt = false;
    }

    buildPage() {
        //if (this._alreadyBuilt) return false;
        const mainBox = new Gtk.Box({     orientation: Gtk.Orientation.VERTICAL,
                                    spacing:       10,
                                    homogeneous:   false,
                                    margin_start:  12,
                                    margin_end:    20,
                                    margin_top:    12,
                                    margin_bottom: 12,
                                    visible:       true    })

        let optionsList = [];
        // options item format:
        // [text, tooltip, widget, settings-variable, options for combo]
    
        optionsList.push(
            _optionsItem(
                _makeTitle(_('Window Switcher pop-up:')),
                null,
                null
            )
        );

        optionsList.push(
            _optionsItem(
                _('Show workspace index of each window'),
                null,
                _newGtkSwitch(),
                'winSwitcherPopupWsIndexes'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Show hotkeys F1-F12 for direct window activation'),
                _('The hotkeys will work independently on this option.'),
                _newGtkSwitch(),
                'winSwitcherPopupHotKeys'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Switcher position'),
                null,
                _newComboBox(),
                'winSwitcherPopupPosition',
                [   [_('Top'),    1],
                    [_('Center'), 2],
                    [_('Bottom'), 3]
                ]
            )
        );

        optionsList.push(
            _optionsItem(
                _('Default Sorting'),
                null,
                _newComboBox(),
                'winSwitcherPopupWinSorting',
                [   [_('Most Recently Used'),     1],
                    [_('Stable Sequence'),        2],
                    [_('Stable - Current First'), 3]
                ]
            )
        );

        optionsList.push(
            _optionsItem(
                _('Default Grouping'),
                null,
                _newComboBox(),
                'winSwitcherPopupWinOrder',
                [   [_('None'),                  1],
                    [_('Current Monitor First'), 2],
                    [_('Applications'),          3],
                    [_('Workspaces'),            4],
                ]
            )
        );

        optionsList.push(
            _optionsItem(
                _('Default Filter'),
                null,
                _newComboBox(),
                'winSwitcherPopupWinFilter',
                [   [_('All Windows'),       1],
                    [_('Current Workspace'), 2],
                    [_('Current Monitor'),   3]
                ]
            )
        );

        optionsList.push(
            _optionsItem(
                _('Skip minimized windows'),
                null,
                _newGtkSwitch(),
                'winSkipMinimized'
            )
        );

        let popupSizeAdjustment = new Gtk.Adjustment({
                upper:            512,
                lower:             16,
                step_increment:     8,
                page_increment:    32 });

        optionsList.push(
            _optionsItem(
                _('Pop-up window preview size (px)'),
                null,
                _newSpinButton(popupSizeAdjustment),
                'winSwitcherPopupSize'
            )
        );

        let popupIconSizeAdjustment = new Gtk.Adjustment({
                upper:            512,
                lower:             16,
                step_increment:     8,
                page_increment:    32 });

        optionsList.push(
            _optionsItem(
                _('Pop-up window icon size (px)'),
                null,
                _newSpinButton(popupIconSizeAdjustment),
                'winSwitcherPopupIconSize'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Wraparound'),
                _('Whether the selection should continue from the last item to the first and vice versa.'),
                _newGtkSwitch(),
                'winSwitcherPopupWrap'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Show selected window immediately'),
                _("Switch to window workspace and bring the window to the front immediately after it's selected. This action doesn't activate the window."),
                _newGtkSwitch(),
                'winSwitcherPopupShowImmediately'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Start in Search mode'),
                _('Type to search immediately after the switcher popup shows up. Hotkeys can be used while holding down the Shift key.'),
                _newGtkSwitch(),
                'winSwitcherPopupStartSearch'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Search All'),
                _('Automaticaly switch filter mode (if possible) when no search results for currently selected filter mode.'),
                _newGtkSwitch(),
                'winSwitcherPopupSearchAll'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Search Applications'),
                _('Search installed applications to launch new when no window match the searched pattern.'),
                _newGtkSwitch(),
                'winSwitcherPopupSearchApps'
            )
        );

        optionsList.push(
            _optionsItem(
                _('Action hotkeys require Shift'),
                _("A-Z hotkeys, excuding those for navigation and filter switching, will require Shift key pressed to work. Very useful when you start to type without switching to Type to Search mode."),
                _newGtkSwitch(),
                'winSwitcherPopupShiftHotkeys'
            )
        );

        let popupTimeoutAdjustment = new Gtk.Adjustment({
                upper:            400,
                lower:             10,
                step_increment:    10,
                page_increment:   100 });

        optionsList.push(
            _optionsItem(
                _('Show up timeout (ms)'),
                _("Delay showing the popup so that fast Alt+Tab users aren't disturbed by the popup briefly flashing."),
                _newSpinButton(popupTimeoutAdjustment),
                'winSwitcherPopupTimeout'
            )
        );


        optionsList.push(
            _optionsItem(
                _makeTitle(_('Workspace switcher:')),
                null,
                null
            )
        );
    
        optionsList.push(
            _optionsItem(
                _('Wraparound'),
                _('Whether the switcher should continue from the last workspace to the first and vice versa.'),
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
                _('Window thumbnails are overlay clones of windows, can be dragged and dropped by mouse anywhere on the screen.') + '\n'
                + _('Thumbnail control:') + '\n    '
                + _('Double click:    \t\tactivate source window') +  '\n    '
                + _('Primary click:   \t\ttoggle scroll wheel function (resize / source)') + '\n    '
                + _('Secondary click: \t\tremove thumbnail') + '\n    '
                + _('Middle click:    \t\tclose source window') + '\n    '
                + _('Scroll wheel:    \t\tresize or change source window') +  '\n    '
                + _('Ctrl + Scroll wheel: \tchange source window or resize') +  '\n    '
                + _('Shift + Scroll wheel: \tadjust opacity') +  '\n    '
                ,
                null
            )
        );

        let tmbScaleAdjustment = new Gtk.Adjustment({
                lower:           5,
                upper:          50,
                step_increment:  1,
                page_increment: 10 
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
                null,
                null
            )
        );

        optionsList.push(
            _optionsItem(
                _('Pop-up at mouse pointer position when triggered by mouse'),
                _('This option is for external trigger that can set internal variable KEYBOARD_TRIGGERED to false -> Custom Hot Corners - Extended'),
                _newGtkSwitch(),
                'winSwitcherPopupPointer'
            )
        );

        let popupPointerTimeoutAdjustment = new Gtk.Adjustment({
                upper:          60000,
                lower:            100,
                step_increment:   100,
                page_increment:  1000 });


        optionsList.push(
            _optionsItem(
                _('Pointer out timeout (ms)'),
                _('When the switcher is activated by a mouse, close the popup after this time of inactivity when mouse pointer is outside the popup.'),
                _newSpinButton(popupPointerTimeoutAdjustment),
                'winSwitcherPopupPointerTimeout'
            )
        );


        let frame;
        let frameBox;
        for (let item of optionsList) {
            if (!item[0][1]) {
                let lbl = new Gtk.Label({visible: true});
                    lbl.set_markup(item[0][0]);
                    if (item[1])
                        lbl.set_tooltip_text(item[1]);
                frame = new Gtk.Frame({
                    label_widget: lbl,
                    visible: true
                });
                frameBox = new Gtk.ListBox({
                    selection_mode: null,
                    can_focus: false,
                    visible: true
                });
                mainBox[mainBox.add?'add':'append'](frame);
                frame[frame.add?'add':'set_child'](frameBox);
                continue;
            }
            let box = new Gtk.Box({
                can_focus: false,
                orientation: Gtk.Orientation.HORIZONTAL,
                margin_start: 4,
                margin_end:   4,
                margin_top:   4,
                margin_bottom:4,
                hexpand: true,
                spacing: 20,
                visible: true
            });
            for (let i of item[0]) {
                box[box.add?'add':'append'](i);
            }
            if (item.length === 2) box.set_tooltip_text(item[1]);

            frameBox[frameBox.add?'add':'append'](box);
        }
        this[this.add? 'add' : 'set_child'](mainBox);
        this.show_all && this.show_all();
        this._alreadyBuilt = true;
    }
});



function _newGtkSwitch() {
    let sw = new Gtk.Switch({
        halign: Gtk.Align.END,
        valign: Gtk.Align.CENTER,
        hexpand: true,
        visible: true
    });
    sw.is_switch = true;
    return sw;
}

function _newSpinButton(adjustment) {
    let spinButton = new Gtk.SpinButton({
            halign:  Gtk.Align.END,
            hexpand: true,
            xalign:  0.5,
            visible: true
    });
    spinButton.set_adjustment(adjustment);
    spinButton.is_spinbutton = true;
    return spinButton;
}

function _newComboBox() {
        const model = new Gtk.ListStore();
        const Columns = { LABEL: 0, VALUE: 1 };
        model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_INT]);
        const comboBox = new Gtk.ComboBox({ model: model,
                                            halign: Gtk.Align.END,
                                            valign: Gtk.Align.CENTER,
                                            hexpand: true,
                                            visible: true
        });
        const renderer = new Gtk.CellRendererText();
        comboBox.pack_start(renderer, true);
        comboBox.add_attribute(renderer, 'text', 0);
        comboBox.is_combo_box = true;
        return comboBox;
    }

function _optionsItem(text, tooltip, widget, variable, options=[]) {
    let item = [[],];
    let label;
    if (widget) {
        label = new Gtk.Label({
                    halign: Gtk.Align.START,
                    visible: true
        });
        label.set_markup(text);
    } else label = text;
    item[0].push(label);
    if (widget) item[0].push(widget);
    if (tooltip) item.push(tooltip);

    if (widget && widget.is_switch) {
        widget.active = mscOptions[variable];
        widget.connect('notify::active', () => {
                    mscOptions[variable] = widget.active;
        });
    }

    else if (widget && widget.is_spinbutton) {
        widget.value = mscOptions[variable];
        widget.timeout_id = null;
        widget.connect('value-changed', () => {
            widget.update();
            if (widget.timeout_id) {
                GLib.Source.remove(widget.timeout_id);
            }
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
    }

    else if (widget && widget.is_combo_box) {
        let model = widget.get_model();
        for (const [label, value] of options) {
            let iter;
            model.set((iter = model.append()), [0, 1], [label, value]);
            if (value === mscOptions[variable]) {
                widget.set_active_iter(iter);
            }
        }
        widget.connect('changed', (item) => {
            const [success, iter] = widget.get_active_iter();
            if (!success) return;

            mscOptions[variable] = model.get_value(iter, 1);
        });
    }

    return item;
}

function _makeSmall(label) {
  return '<small>'+label+'</small>';
}
function _makeTitle(label) {
  return '<b>'+label+'</b>';
}

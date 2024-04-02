/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * OptionsFactory
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

const { Gtk, Gio, GObject } = imports.gi;

const Adw = imports.gi.Adw;

var ItemFactory = class ItemFactory {
    constructor(opt) {
        this._opt = opt;
        this._settings = opt._gSettings;
    }

    getRowWidget(text, caption, widget, variable, options = []) {
        let item = [];
        let label;
        if (widget) {
            label = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
                halign: Gtk.Align.START,
                valign: Gtk.Align.CENTER,
            });
            const option = new Gtk.Label({
                halign: Gtk.Align.START,
            });
            option.set_text(text);
            label.append(option);

            if (caption) {
                const captionLabel = new Gtk.Label({
                    halign: Gtk.Align.START,
                    wrap: true,
                    /* width_chars: 80,*/
                    xalign: 0,
                });
                const context = captionLabel.get_style_context();
                context.add_class('dim-label');
                context.add_class('caption');
                captionLabel.set_text(caption);
                label.append(captionLabel);
            }
            label._title = text;
        } else {
            label = text;
        }
        item.push(label);
        item.push(widget);

        let key;

        if (variable && this._opt.options[variable]) {
            const opt = this._opt.options[variable];
            key = opt[1];
        }

        if (widget) {
            if (widget._isSwitch)
                this._connectSwitch(widget, key, variable);
            else if (widget._isSpinbutton || widget._isScale)
                this._connectSpinButton(widget, key, variable);
            /* else if (widget._isComboBox)
                this._connectComboBox(widget, key, variable, options);*/
            else if (widget._isEntry)
                this._connectEntry(widget, key, variable);
            else if (widget._isDropDown)
                this._connectDropDown(widget, key, variable, options);
        }

        return item;
    }

    _connectSwitch(widget, key /* variable */) {
        this._settings.bind(key, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    _connectSpinButton(widget, key /* variable */) {
        this._settings.bind(key, widget.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
    }

    /* _connectComboBox(widget, key, variable, options) {
        let model = widget.get_model();
        widget._comboMap = {};
        for (const [label, value] of options) {
            let iter;
            model.set(iter = model.append(), [0, 1], [label, value]);
            if (value === this._opt.get(variable))
                widget.set_active_iter(iter);

            widget._comboMap[value] = iter;
        }
        this._opt.connect(`changed::${key}`, () => {
            widget.set_active_iter(widget._comboMap[this._opt.get(variable, true)]);
        });
        widget.connect('changed', () => {
            const [success, iter] = widget.get_active_iter();

            if (!success)
                return;

            this._opt.set(variable, model.get_value(iter, 1));
        });
    }*/

    _connectDropDown(widget, key, variable, options) {
        const model = widget.get_model();
        const currentValue = this._opt.get(variable);
        for (let i = 0; i < options.length; i++) {
            const text = options[i][0];
            const id = options[i][1];
            model.append(new DropDownItem({ text, id }));
            if (id === currentValue)
                widget.set_selected(i);
        }

        const factory = new Gtk.SignalListItemFactory();
        factory.connect('setup', (fact, listItem) => {
            const label = new Gtk.Label({ xalign: 0 });
            listItem.set_child(label);
        });
        factory.connect('bind', (fact, listItem) => {
            const label = listItem.get_child();
            const item = listItem.get_item();
            label.set_text(item.text);
        });

        widget.connect('notify::selected-item', dropDown => {
            const item = dropDown.get_selected_item();
            this._opt.set(variable, item.id);
        });

        this._opt.connect(`changed::${key}`, () => {
            const newId = this._opt.get(variable, true);
            for (let i = 0; i < options.length; i++) {
                const id = options[i][1];
                if (id === newId)
                    widget.set_selected(i);
            }
        });

        widget.set_factory(factory);
    }

    _connectEntry(widget, key, variable) {
        if (variable.startsWith('hotkey')) {
            this._settings.bind(key, widget, 'text', Gio.SettingsBindFlags.GET);
            widget.connect('changed', entry => {
                if (entry._doNotEdit)
                    return;

                entry._doNotEdit = true;
                let text = entry.get_text();
                let txt = '';
                for (let i = 0; i < text.length; i++) {
                    // if (/[a-zA-Z0-9]|/.test(text[i])) {
                    let char = text[i].toUpperCase();
                    if (!txt.includes(char))
                        txt += char;

                    // }
                }
                txt = txt.slice(0, 2);
                entry.set_text(txt);
                entry._doNotEdit = false;
                this._opt.set(variable, txt);
            });

            widget.set_icon_from_icon_name(Gtk.EntryIconPosition.SECONDARY, 'edit-clear-symbolic');
            widget.set_icon_activatable(Gtk.EntryIconPosition.SECONDARY, true);
            widget.connect('icon-press', e => {
                if (e.get_text() === '')
                    e.set_text(this._settings.getDefault(variable));
                else
                    e.set_text('');
            });
        } else {
            widget.width_chars = 25;
            widget.set_text(variable);
            widget.editable = false;
            widget.can_focus = false;
        }
    }

    newSwitch() {
        let sw = new Gtk.Switch({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        sw._isSwitch = true;
        return sw;
    }

    newSpinButton(adjustment) {
        let spinButton = new Gtk.SpinButton({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            vexpand: false,
            xalign: 0.5,
        });
        spinButton.set_adjustment(adjustment);
        spinButton._isSpinbutton = true;
        return spinButton;
    }

    newScale(adjustment) {
        const scale = new Gtk.Scale({
            orientation: Gtk.Orientation.HORIZONTAL,
            draw_value:  true,
            has_origin:  false,
            value_pos:   Gtk.PositionType.LEFT,
            digits:      0,
            halign:      Gtk.Align.END,
            valign:      Gtk.Align.CENTER,
            hexpand:     true,
            vexpand:     false,
        });
        scale.set_size_request(300, -1);
        scale.set_adjustment(adjustment);
        scale._isScale = true;
        return scale;
    }

    /* newComboBox() {
        const model = new Gtk.ListStore();
        model.set_column_types([GObject.TYPE_STRING, GObject.TYPE_INT]);
        const comboBox = new Gtk.ComboBox({
            model,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        const renderer = new Gtk.CellRendererText();
        comboBox.pack_start(renderer, true);
        comboBox.add_attribute(renderer, 'text', 0);
        comboBox._isComboBox = true;
        return comboBox;
    }*/

    newDropDown() {
        const dropDown = new Gtk.DropDown({
            model: new Gio.ListStore({
                item_type: DropDownItem,
            }),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        dropDown._isDropDown = true;
        return dropDown;
    }

    newEntry() {
        const entry = new Gtk.Entry({
            width_chars: 6,
            max_width_chars: 5,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
            xalign: 0.5,
        });
        entry._isEntry = true;
        return entry;
    }

    newLabel(text = '') {
        const label = new Gtk.Label({
            label: text,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        label._activatable = false;
        return label;
    }

    newLinkButton(uri) {
        const linkBtn = new Gtk.LinkButton({
            label: '',
            uri,
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });
        return linkBtn;
    }

    newOptionsResetButton() {
        const btn = new Gtk.Button({
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });

        const context = btn.get_style_context();
        context.add_class('destructive-action');
        btn.icon_name = 'view-refresh-symbolic';
        btn.connect('clicked', () => {
            const settings = this._settings;
            settings.list_keys().forEach(
                key => settings.reset(key)
            );
        });
        btn._activatable = false;
        return btn;
    }
};

const DropDownItem = GObject.registerClass({
    GTypeName: `DropdownItem${Math.floor(Math.random() * 1000)}`,
    Properties: {
        'text': GObject.ParamSpec.string(
            'text',
            'Text',
            'DropDown item text',
            GObject.ParamFlags.READWRITE,
            ''
        ),
        'id': GObject.ParamSpec.int(
            'id',
            'Id',
            'Item id stored in settings',
            GObject.ParamFlags.READWRITE,
            0, 100, 0
        ),
    },
}, class DropDownItem extends GObject.Object {
    get text() {
        return this._text;
    }

    set text(text) {
        this._text = text;
    }

    get id() {
        return this._id;
    }

    set id(id) {
        this._id = id;
    }
}
);

var AdwPrefs = class {
    static getFilledWindow(window, pages) {
        for (let page of pages) {
            const title = page.title;
            const iconName = page.iconName;
            const optionList = page.optionList;

            window.add(
                this._getAdwPage(optionList, {
                    title,
                    iconName,
                })
            );
        }
        return window;
    }

    static _getAdwPage(optionList, pageProperties = {}) {
        pageProperties.width_request = 840;
        const page = new Adw.PreferencesPage(pageProperties);
        let group;
        for (let item of optionList) {
            if (!item)
                continue;
            // label can be plain text for Section Title
            // or GtkBox for Option
            const option = item[0];
            const widget = item[1];
            if (!widget) {
                if (group)
                    page.add(group);

                group = new Adw.PreferencesGroup({
                    title: option,
                    hexpand: true,
                    width_request: 700,
                });
                continue;
            }

            const row = new Adw.ActionRow({
                title: option._title,
            });

            const grid = new Gtk.Grid({
                column_homogeneous: false,
                column_spacing: 20,
                margin_start: 8,
                margin_end: 8,
                margin_top: 8,
                margin_bottom: 8,
                hexpand: true,
            });
            /* for (let i of item) {
                box.append(i);*/
            grid.attach(option, 0, 0, 1, 1);
            if (widget)
                grid.attach(widget, 1, 0, 1, 1);

            row.set_child(grid);
            if (widget._activatable === false)
                row.activatable = false;
            else
                row.activatable_widget = widget;

            group.add(row);
        }
        page.add(group);
        return page;
    }
};

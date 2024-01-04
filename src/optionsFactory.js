/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * optionsFactory
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2023
 * @license    GPL-3.0
 */

'use strict';

const { Gtk, GLib, Gio, GObject } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = ExtensionUtils.getCurrentExtension();
const Settings       = Me.imports.src.settings;

// gettext
const _  = Settings._;

const shellVersion   = Settings.shellVersion;

// libadwaita is available starting with GNOME Shell 42.
let Adw = null;
try {
    Adw = imports.gi.Adw;
} catch (e) {}

// conversion of Gtk3 / Gtk4 widgets add methods
const append = shellVersion < 40 ? 'add' : 'append';
const set_child = shellVersion < 40 ? 'add' : 'set_child';

function _newImageFromIconName(name, size = null) {
    const args = shellVersion >= 40 ? [name] : [name, size];
    return Gtk.Image.new_from_icon_name(...args);
}

var ItemFactory = class ItemFactory {
    constructor(opt) {
        this._opt = opt;
        this._settings = opt._gsettings;
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
            label[append](option);

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
                label[append](captionLabel);
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
            else if (widget._isSpinbutton)
                this._connectSpinButton(widget, key, variable);
            else if (widget._isComboBox)
                this._connectComboBox(widget, key, variable, options);
            else if (widget._isEntry)
                this._connectEntry(widget, key, variable);
            /* else if (widget._isDropDown)
                this._connectDropDown(widget, key, variable, options);*/
        }

        return item;
    }

    _connectSwitch(widget, key /* variable */) {
        this._settings.bind(key, widget, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    _connectSpinButton(widget, key /* variable */) {
        this._settings.bind(key, widget.adjustment, 'value', Gio.SettingsBindFlags.DEFAULT);
    }

    _connectComboBox(widget, key, variable, options) {
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
    }

    /* _connectDropDown(widget, key, variable, options) {
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
    }*/

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

    newComboBox() {
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
    }

    /* newDropDown() {
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
    }*/

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
            label: shellVersion < 42 ? 'Link' : '',
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

        if (shellVersion >= 40)
            btn.icon_name = 'view-refresh-symbolic';
        else
            btn.add(Gtk.Image.new_from_icon_name('view-refresh-symbolic', Gtk.IconSize.BUTTON));


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

/* const DropDownItem = GObject.registerClass({
    GTypeName: 'DropdownItem',
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
);*/

var AdwPrefs = class {
    static getFilledWindow(window, pages) {
        for (let page of pages) {
            const title = page.title;
            const icon_name = page.iconName;
            const optionList = page.optionList;

            window.add(
                this._getAdwPage(optionList, {
                    title,
                    icon_name,
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
                box[append](i);*/
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

var LegacyPrefs = class {
    static getPrefsWidget(pages) {
        const prefsWidget = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
        });
        const stack = new Gtk.Stack({
            hexpand: true,
        });
        const stackSwitcher = new Gtk.StackSwitcher({
            halign: Gtk.Align.CENTER,
            hexpand: true,
        });
        if (shellVersion < 40)
            stackSwitcher.homogeneous = true;
        const context = stackSwitcher.get_style_context();
        context.add_class('caption');

        stackSwitcher.set_stack(stack);
        stack.set_transition_duration(300);
        stack.set_transition_type(Gtk.StackTransitionType.SLIDE_LEFT_RIGHT);

        const pageProperties = {
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vexpand: true,
            hexpand: true,
            visible: true,
        };

        const pagesBtns = [];

        for (let page of pages) {
            const name = page.name;
            const title = page.title;
            const iconName = page.iconName;
            const optionList = page.optionList;

            stack.add_named(this._getLegacyPage(optionList, pageProperties), name);
            pagesBtns.push(
                [new Gtk.Label({ label: title }), _newImageFromIconName(iconName, Gtk.IconSize.BUTTON)]
            );
        }

        let stBtn = stackSwitcher.get_first_child ? stackSwitcher.get_first_child() : null;
        for (let i = 0; i < pagesBtns.length; i++) {
            const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 6, visible: true });
            const icon = pagesBtns[i][1];
            icon.margin_start = 30;
            icon.margin_end = 30;
            box[append](icon);
            box[append](pagesBtns[i][0]);
            if (stackSwitcher.get_children) {
                stBtn = stackSwitcher.get_children()[i];
                stBtn.add(box);
            } else {
                stBtn.set_child(box);
                stBtn.visible = true;
                stBtn = stBtn.get_next_sibling();
            }
        }

        if (stack.show_all)
            stack.show_all();
        if (stackSwitcher.show_all)
            stackSwitcher.show_all();

        prefsWidget[append](stack);
        prefsWidget.connect('realize', widget => {
            const window = widget.get_root ? widget.get_root() : widget.get_toplevel();
            const headerbar = window.get_titlebar();
            if (shellVersion >= 40)
                headerbar.title_widget = stackSwitcher;
            else
                headerbar.custom_title = stackSwitcher;
        });

        if (prefsWidget.show_all)
            prefsWidget.show_all();

        return prefsWidget;
    }

    static _getLegacyPage(optionList, pageProperties) {
        const page = new Gtk.ScrolledWindow(pageProperties);
        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 5,
            homogeneous: false,
            margin_start: 30,
            margin_end: 30,
            margin_top: 12,
            margin_bottom: 12,
        });

        const context = page.get_style_context();
        context.add_class('background');

        let frame;
        let frameBox;
        for (let item of optionList) {
            if (!item)
                continue;
            // label can be plain text for Section Title
            // or GtkBox for Option
            const option = item[0];
            const widget = item[1];

            if (!widget) {
                const lbl = new Gtk.Label({
                    label: option,
                    xalign: 0,
                    margin_bottom: 4,
                });

                const context = lbl.get_style_context();
                context.add_class('heading');

                mainBox[append](lbl);

                frame = new Gtk.Frame({
                    margin_bottom: 16,
                });

                frameBox = new Gtk.ListBox({
                    selection_mode: null,
                });

                mainBox[append](frame);
                frame[set_child](frameBox);
                continue;
            }

            const grid = new Gtk.Grid({
                column_homogeneous: false,
                column_spacing: 20,
                margin_start: 8,
                margin_end: 8,
                margin_top: 8,
                margin_bottom: 8,
                hexpand: true,
            });

            grid.attach(option, 0, 0, 5, 1);

            if (widget)
                grid.attach(widget, 5, 0, 2, 1);

            frameBox[append](grid);
        }
        page[set_child](mainBox);

        return page;
    }
};

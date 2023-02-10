/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * CaptionLabel
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2022
 * @license    GPL-3.0
 */

'use strict';

const { GObject, St, Clutter } = imports.gi;

const Main            = imports.ui.main;

const ExtensionUtils  = imports.misc.extensionUtils;
const Me              = ExtensionUtils.getCurrentExtension();
const Settings        = Me.imports.settings;

const shellVersion    = parseFloat(imports.misc.config.PACKAGE_VERSION);


var CaptionLabel = GObject.registerClass(
class CaptionLabel extends St.BoxLayout {
    _init(params, options) {
        this._search = params.name === 'search-label';
        this._options = options;

        super._init({
            style_class: this._options.colorStyle.CAPTION_LABEL,
            vertical: !this._search, // horizontal orientation for search label, vertical for title caption
            style: `font-size: ${params.fontSize}em;` // border-radius: 12px; padding: 6px; background-color: rgba(0, 0, 0, ${bgOpacity});`,
        });

        this._label = new St.Label({
            name: params.name,
            text: params.text,
            reactive: false,
            y_align: Clutter.ActorAlign.CENTER
        });

        if (this._search) {
            this.addSearchIcon();
            this._label.add_style_class_name('search-label');
        }

        this.add_child(this._label);

        this.update(params);
    }

    update(params) {
        this._label.name = params.name;
        this._label.text = params.text;
        if (!this._search)
            this.addDetails(params.description);
        this._yOffset = params.yOffset;
        this.show();
    }

    setText(text) {
        this._label.text = text;
    }

    addDetails(details) {
        if (details && !this._descriptionLabel) {
            this._descriptionLabel = new St.Label({
                style_class: 'title-description',
                style: `font-size: 0.7em;` // font size is relative to parent style
            });
            this.add_child(this._descriptionLabel);
        } else if (!details && this._descriptionLabel && !this._descriptionLabel._removed) {
            this.remove_child(this._descriptionLabel);
            this._descriptionLabel._removed = true;
        } else if (details && this._descriptionLabel && this._descriptionLabel._removed) {
            this.add_child(this._descriptionLabel);
            this._descriptionLabel._removed = false;
        }

        if (this._descriptionLabel && details)
            this._descriptionLabel.text = details;
    }

    addSearchIcon() {
        const icon = new St.Icon({
            icon_name: 'edit-find-symbolic',
            style_class: `search-icon`
        });
        this.add_child(icon);
    }

    _destroy() {
        //Main.layoutManager.removeChrome(this);
        super.destroy();
    }
});

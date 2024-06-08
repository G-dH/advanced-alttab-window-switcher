/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * CaptionLabel
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';

import * as Enum from './enum.js';
import { ListProvider } from './listProvider.js';
const _match = ListProvider.prototype._match;


export function showSearchCaption(text, wsp, opt) {
    const margin = 20;
    let offset = wsp._itemCaption
        ? wsp._itemCaption.height + margin
        : margin;
    offset += wsp._wsTmb && wsp._popupPosition !== Enum.Position.CENTER ? wsp._wsTmb.height : 0;

    const fontSize = opt.CAPTIONS_SCALE * 2;
    const params = {
        name: 'search-label',
        text,
        fontSize,
        yOffset: offset,
        monitorIndex: wsp._monitorIndex,
    };
    if (!wsp._searchCaption) {
        wsp._searchCaption = new CaptionLabel(params, opt);
        wsp.add_child(wsp._searchCaption);
    } else {
        wsp._searchCaption.update(params);
    }
}

export function showTitleCaption(wsp, opt) {
    let selected = wsp._items[wsp._selectedIndex];

    //              for better compatibility with the Tiling Assistant extension
    if (!selected || (!selected._isWindow && !selected.titleLabel))
        return;

    let title;
    let details = '';

    if (selected._isWindow) {
        title = selected.window.get_title();
        const appName = selected.app.get_name();
        details = appName === title ? '' : appName;
    } else {
        title = selected.titleLabel.get_text();
        // if searching apps add more info to the caption
        if (selected._appDetails?.generic_name && !_match(title, selected._appDetails.generic_name))
            details += `${selected._appDetails.generic_name}`;

        if (selected._appDetails?.description && !_match(title, selected._appDetails.description))
            details += `${details ? '\n' : ''}${selected._appDetails.description}`;
    }

    const fontSize = opt.CAPTIONS_SCALE;

    const params = {
        name: 'item-label',
        text: title,
        description: details,
        fontSize,
        yOffset: 0,
    };

    if (!wsp._itemCaption) {
        wsp._itemCaption = new CaptionLabel(params, opt);
        wsp.add_child(wsp._itemCaption);
    } else {
        wsp._itemCaption.update(params);
    }

    if (wsp._inAnimation)
        wsp._itemCaption.opacity = 0;
    else
        wsp._itemCaption.opacity = 255;

    wsp._itemCaption.connect('destroy', () => {
        wsp._itemCaption = null;
    });

    // The parent's allocate() is called automatically if the child's geometry has changed,
    // but the caption position is updated in the parent's allocate()
    wsp.emit('queue-relayout');
}


export const CaptionLabel = GObject.registerClass({
    GTypeName: `CaptionLabel${Math.floor(Math.random() * 1000)}`,
}, class CaptionLabel extends St.BoxLayout {
    _init(params, opt) {
        this._search = params.name === 'search-label';

        super._init({
            style_class: opt.colorStyle.CAPTION_LABEL,
            vertical: !this._search, // horizontal orientation for search label, vertical for title caption
            style: `font-size: ${params.fontSize}em;`,
        });

        this._label = new St.Label({
            name: params.name,
            text: params.text,
            reactive: false,
            y_align: Clutter.ActorAlign.CENTER,
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
            style_class: 'search-icon',
        });
        this.add_child(icon);
    }

    _destroy() {
        // Main.layoutManager.removeChrome(this);
        super.destroy();
    }
});

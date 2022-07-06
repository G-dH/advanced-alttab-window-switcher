/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * WinTmb
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2022
 * @license    GPL-3.0
 */

'use strict';

const { GObject, Clutter, St, Meta, Shell } = imports.gi;

const Main         = imports.ui.main;
const DND          = imports.ui.dnd;
const AltTab       = imports.ui.altTab;
const Graphene     = imports.gi.Graphene;
const shellVersion = parseFloat(imports.misc.config.PACKAGE_VERSION);

const SCROLL_ICON_OPACITY = 240;
const DRAG_OPACITY = 200;
const CLOSE_BTN_OPACITY = 240;

var   WindowThumbnail = GObject.registerClass(
class WindowThumbnail extends St.BoxLayout {
    _init(metaWin, parent, args) {
        this._hoverShowsPreview = false;
        this._customOpacity = 255;
        this._initTmbHeight = args.height;
        this._minimumHeight = Math.floor(5 / 100 * global.display.get_monitor_geometry(global.display.get_current_monitor()).height);
        this._scrollTimeout = 100;
        this._positionOffset = args.thumbnailsOnScreen;
        this._reverseTmbWheelFunc = false;
        this._click_count = 1;
        this._prevBtnPressTime = 0;
        this._parent = parent;
        this.w = metaWin;
        super._init({visible: true, reactive: true, can_focus: true, track_hover: true});
        this.connect('button-release-event', this._onBtnReleased.bind(this));
        this.connect('scroll-event', this._onScrollEvent.bind(this));
        //this.connect('motion-event', this._onMouseMove.bind(this)); // may be useful in the future..

        this._delegate = this;
        this._draggable = DND.makeDraggable(this, {dragActorOpacity: DRAG_OPACITY});
        this._draggable.connect('drag-end', this._end_drag.bind(this));
        this._draggable.connect('drag-cancelled', this._end_drag.bind(this));
        this._draggable._animateDragEnd = (eventTime) => {
            this._draggable._animationInProgress = true;
            this._draggable._onAnimationComplete(this._draggable._dragActor, eventTime);
            this.opacity = this._customOpacity;
        };

        this.clone = new Clutter.Clone({reactive: true});
        Main.layoutManager.addChrome(this);

        this.window = this.w.get_compositor_private();

        this.clone.set_source(this.window);

        this._tmb = new St.Widget({layout_manager: new Clutter.BinLayout()});
        this.add_child(this._tmb);

        this._bin = new St.Bin();
        this._bin.set_child(this.clone);
        this._tmb.add_child(this._bin);
        this._addCloseButton();
        this._addScrollModeIcon();

        this.connect('enter-event', () => {
            global.display.set_cursor(Meta.Cursor.POINTING_HAND);
            this._closeButton.opacity = CLOSE_BTN_OPACITY;
            this._scrollModeBin.opacity = SCROLL_ICON_OPACITY;
            if (this._hoverShowsPreview) {
                this._closeButton.opacity = 50;
                this._showWindowPreview(false, true);
            }
        });

        this.connect('leave-event', () => {
            global.display.set_cursor(Meta.Cursor.DEFAULT);
            this._closeButton.opacity = 0;
            this._scrollModeBin.opacity = 0;
            if (this._winPreview) {
                this._destroyWindowPreview();
            }
        });

        this._setSize(true);
        this.set_position(...this._getInitialPosition());
        this.show();
        this.window_id = this.w.get_id();
        this.tmbRedrawDirection = true;

        // remove thumbnail content and hide thumbnail if its window is destroyed
        this.windowConnect = this.window.connect('destroy', () => {
            if (this)
                this._remove();
        });
    }

    _getInitialPosition() {
        const offset = 20;
        let monitor = Main.layoutManager.monitors[global.display.get_current_monitor()];
        let x = Math.min(monitor.x + monitor.width  - (this.window.width  * this.scale) - offset);
        let y = Math.min(monitor.y + monitor.height - (this.window.height * this.scale) - offset - ((this._positionOffset * this._initTmbHeight) % (monitor.height - this._initTmbHeight)));
        return [x, y];
    }

    _setSize(resetScale = false) {
        if (resetScale)
            this.scale = Math.min(1.0, this._initTmbHeight / this.window.height);

        const width = this.window.width * this.scale;
        const height = this.window.height * this.scale;
        this._bin.width = width;
        this._bin.height = height;
        this.width = width;
        this.height = height;
        if (this.icon) {
            this.icon.scale_x = this.scale;
            this.icon.scale_y = this.scale;
        }

        // when the scale of this. actor change, this.clone resize accordingly,
        // but the reactive area of the actor doesn't change until the actor is redrawn
        // this updates the actor's input region area:
        Main.layoutManager._queueUpdateRegions();
    }

    /*_onMouseMove(actor, event) {
        let [pos_x, pos_y] = event.get_coords();
        let state = event.get_state();
        if (this._ctrlPressed(state)) {
        }
    }*/

    _onBtnReleased(actor, event) {
        // Clutter.Event.click_count property in no longer available, since GS42
        if ((event.get_time() - this._prevBtnPressTime) < Clutter.Settings.get_default().double_click_time) {
            this._click_count +=1;
        } else {
            this._click_count = 1;
        }
        this._prevBtnPressTime = event.get_time();

        if (this._click_count === 2 && event.get_button() === Clutter.BUTTON_PRIMARY) {
            this.w.activate(global.get_current_time());
        }

        const button = event.get_button();
        const state = event.get_state();
        switch (button) {
        case Clutter.BUTTON_PRIMARY:
            if (this._ctrlPressed(state)) {
                this._switchView();
                this._setSize();
            } else {
                this._reverseTmbWheelFunc = !this._reverseTmbWheelFunc;
                this._scrollModeBin.set_child(this._reverseTmbWheelFunc ? this._scrollModeSourceIcon : this._scrollModeResizeIcon);
            }
            return Clutter.EVENT_STOP;
        case Clutter.BUTTON_SECONDARY:
            if (this._ctrlPressed(state)) {
                this._remove();
            } else {
                this._hoverShowsPreview = !this._hoverShowsPreview;
                this._showWindowPreview();
            }
            return Clutter.EVENT_STOP;
        case Clutter.BUTTON_MIDDLE:
            if (this._ctrlPressed(state))
                this.w.delete(global.get_current_time());
            else
                this._switchView();
            return Clutter.EVENT_STOP;
        default:
            return Clutter.EVENT_PROPAGATE;
        }
    }

    _onScrollEvent(actor, event) {
        let direction = event.get_scroll_direction();
        if (direction === 4)
            return;
        if (this._actionTimeoutActive())
            return;
        let state = event.get_state();
        switch (direction) {
        case Clutter.ScrollDirection.UP:
            if (this._shiftPressed(state)) {
                this.opacity = Math.min(255, this.opacity + 24);
                this._customOpacity = this.opacity;
            }
            else if (this._reverseTmbWheelFunc !== this._ctrlPressed(state))
                this._switchSourceWin(-1);
            else if (this._reverseTmbWheelFunc === this._ctrlPressed(state))
                this.scale = Math.max(0.05, this.scale - 0.025);
            break;
        case Clutter.ScrollDirection.DOWN:
            if (this._shiftPressed(state)) {
                this.opacity = Math.max(48, this.opacity - 24);
                this._customOpacity = this.opacity;
            }
            else if (this._reverseTmbWheelFunc !== this._ctrlPressed(state))
                this._switchSourceWin(+1);
            else if (this._reverseTmbWheelFunc === this._ctrlPressed(state))
                this.scale = Math.min(1, this.scale + 0.025);
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }
        this._setSize();
        return Clutter.EVENT_STOP;
    }

    _remove() {
        if (this.clone) {
            this.window.disconnect(this.windowConnect);
            this.clone.set_source(null);
        }
        if (this._winPreview) {
            this._destroyWindowPreview();
        }
        this._parent.windowThumbnails.splice(this._parent.windowThumbnails.indexOf(this), 1);
        this.destroy();
    }

    _end_drag() {
        this.set_position(this._draggable._dragOffsetX + this._draggable._dragX, this._draggable._dragOffsetY + this._draggable._dragY);
        this._setSize();
    }

    _ctrlPressed(state) {
        return (state & Clutter.ModifierType.CONTROL_MASK) !== 0;
    }

    _shiftPressed(state) {
        return (state & Clutter.ModifierType.SHIFT_MASK) !== 0;
    }

    _switchSourceWin(direction) {
        this._switchView(this.clone);

        let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL, null);
        windows = windows.filter(w => !(w.skip_taskbar || w.minimized));
        let idx = -1;
        for (let i = 0; i < windows.length; i++) {
            if (windows[i] === this.w) {
                idx = i + direction;
                break;
            }
        }
        idx = idx >= windows.length ? 0 : idx;
        idx = idx < 0 ? windows.length - 1 : idx;
        let w = windows[idx];
        let win = w.get_compositor_private();
        this.clone.set_source(win);
        this.window.disconnect(this.windowConnect);
        // the new thumbnail should be the same height as the previous one
        this.scale = (this.scale * this.window.height) / win.height;
        this.window = win;
        this.windowConnect = this.window.connect('destroy', () => {
            if (this)
                this._remove();
        });
        this.w = w;

        //this._setIcon();
        if (this._winPreview) {
            this._showWindowPreview(true);
        }
    }

    _actionTimeoutActive() {
        const timeout = this._reverseTmbWheelFunc ? this._scrollTimeout : this._scrollTimeout / 4;
        if (!this._lastActionTime || Date.now() - this._lastActionTime > timeout) {
            this._lastActionTime = Date.now();
            return false;
        }
        return true;
    }

    _setIcon() {
        let tracker = Shell.WindowTracker.get_default();
        let app = tracker.get_window_app(this.w);
        let icon = app
            ? app.create_icon_texture(this.height)
            : new St.Icon({icon_name: 'icon-missing', icon_size: this.height});
        icon.x_expand = icon.y_expand = true;
        if (this.icon)
            this.icon.destroy();
        this.icon = icon;
    }

    _switchView(clone = false) {
        if (clone) {
            this._bin.set_child(this.clone);
        }
    }

    _addCloseButton() {
        const closeButton = new St.Button({
            opacity: 0,
            style_class: 'window-close',
            child: new St.Icon({ icon_name: shellVersion < 40 ? 'window-close-symbolic' : 'preview-close-symbolic' }),
            x_align: Clutter.ActorAlign.END,
            y_align: Clutter.ActorAlign.START,
            x_expand: true,
            y_expand: true,
        });

        closeButton.connect('clicked', () => {
            this._remove();
            return Clutter.EVENT_STOP;
        });

        this._closeButton = closeButton;
        this._tmb.add_child(this._closeButton);
    }

    _addScrollModeIcon() {
        this._scrollModeBin = new St.Bin({
            x_expand: true,
            y_expand: true
        });
        this._scrollModeResizeIcon = new St.Icon({
            icon_name: 'view-fullscreen-symbolic',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            x_expand: true,
            y_expand: true,
            opacity: SCROLL_ICON_OPACITY,
            style_class: 'icon-dropshadow',
            scale_x: 0.5,
            scale_y: 0.5
        });
        this._scrollModeSourceIcon = new St.Icon({
            icon_name: 'media-skip-forward-symbolic',
            x_align: Clutter.ActorAlign.CENTER,
            y_align: Clutter.ActorAlign.END,
            x_expand: true,
            y_expand: true,
            opacity: SCROLL_ICON_OPACITY,
            style_class: 'icon-dropshadow',
            scale_x: 0.5,
            scale_y: 0.5
        });
        this._scrollModeBin.set_child(this._scrollModeResizeIcon);
        this._tmb.add_child(this._scrollModeBin);
        this._scrollModeBin.opacity = 0;
    }

    _showWindowPreview(update = false, dontDestroy = false) {
        if (this._winPreview && !dontDestroy) {
            this._destroyWindowPreview();
            this._previewCreationTime = 0;
            this._closeButton.opacity = CLOSE_BTN_OPACITY;
            if (!update)
                return;
        }

        if (!this._winPreview) {
            this._winPreview = new AltTab.CyclerHighlight();
            global.window_group.add_actor(this._winPreview);
            [this._winPreview._xPointer, this._winPreview._yPointer] = global.get_pointer();
        }

        if (!update) {
            this._winPreview.opacity = 0;
            this._winPreview.ease({
                opacity: 255,
                duration: 70,
                mode: Clutter.AnimationMode.LINEAR,
                /*onComplete: () => {
                    this._closeButton.opacity = 50;
                },*/
            });

            this.ease({
                opacity: Math.min(50, this._customOpacity),
                duration: 70,
                mode: Clutter.AnimationMode.LINEAR,
                onComplete: () => {
                }
            });
        } else {
            this._winPreview.opacity = 255;
        }
        this._winPreview.window = this.w;
        this._winPreview._window = this.w;
        global.window_group.set_child_above_sibling(this._winPreview, null);
    }

    _destroyWindowPreview() {
        if (this._winPreview) {
            this._winPreview.ease({
            opacity: 0,
            duration: 100,
            mode: Clutter.AnimationMode.LINEAR,
            onComplete: () => {
                this._winPreview.destroy();
                this._winPreview = null;
                this.opacity = this._customOpacity;
            }
        });
        }
    }
});

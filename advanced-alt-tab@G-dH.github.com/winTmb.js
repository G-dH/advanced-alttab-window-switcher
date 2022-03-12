'use strict';

const { GObject, GLib, Clutter, St, Meta, Shell } = imports.gi;

const Main                   = imports.ui.main;
const DND                    = imports.ui.dnd;

function _ctrlPressed(state) {
    return (state & Clutter.ModifierType.CONTROL_MASK) != 0;
}

function _shiftPressed(state) {
    return (state & Clutter.ModifierType.SHIFT_MASK) != 0;
}

var   WindowThumbnail = GObject.registerClass(
class WindowThumbnail extends St.Bin {
    _init(metaWin, parent, args) {
        this._initTmbHeight = args.height;
        this._minimumHeight = Math.floor(5 / 100 * global.display.get_monitor_geometry(global.display.get_current_monitor()).height);
        this._actionTimeoutId = null;
        this._scrollTimeout = args.actionTimeout;
        this._positionOffset = args.thumbnailsOnScreen;
        this._reverseTmbWheelFunc = false;
        this._click_count = 1;
        this._prevBtnPressTime = 0;
        this._tmbCollector = global.stage.windowThumbnails;
        this.w = metaWin;
        super._init({visible: true, reactive: true, can_focus: true, track_hover: true});
        this.connect('button-release-event', this._onBtnReleased.bind(this));
        this.connect('button-press-event', this._onBtnPressed.bind(this));
        this.connect('scroll-event', this._onScrollEvent.bind(this));
        // this.connect('motion-event', this._onMouseMove.bind(this)); // may be useful in the future..

        this._delegate = this;
        this._draggable = DND.makeDraggable(this, {dragActorOpacity: 200});

        this.saved_snap_back_animation_time = DND.SNAP_BACK_ANIMATION_TIME;

        this._draggable.connect('drag-end', this._end_drag.bind(this));
        this._draggable.connect('drag-cancelled', this._end_drag.bind(this));

        this.clone = new Clutter.Clone({reactive: true});
        Main.layoutManager.addChrome(this);

        this.window = this.w.get_compositor_private();

        this.clone.set_source(this.window);
        this._setSize(true);
        this.set_child(this.clone);

        this.set_position(...this._getInitialPosition());
        this.show();
        this.window_id = this.w.get_id();
        this.tmbRedrawDirection = true;

        // remove thumbnail content and hide thumbnail if its window is destroyed
        this.windowConnect = this.window.connect('destroy', () => {
            if (this)
                this._remove();
        });
        this.conS = Main.overview.connect('showing', () => {
            this.hide();
        });
        this.conH = Main.overview.connect('hiding',  () => {
            this.show();
        });
        this._setIcon();
    }

    _getInitialPosition() {
        // let pointer = {};
        // [pointer.x, pointer.y,] = global.get_pointer();
        const offset = 20;
        let monitor = Main.layoutManager.monitors[global.display.get_current_monitor()];
        let x = Math.min(monitor.x + monitor.width  - (this.window.width  * this.scale) - offset);
        let y = Math.min(monitor.y + monitor.height - (this.window.height * this.scale) - offset - ((this._positionOffset * this._initTmbHeight) % (monitor.height - this._initTmbHeight)));
        return [x, y];
    }

    _setSize(resetScale = false) {
        if (resetScale)
            // this.scale = Math.min(1.0, this.max_width / this.window.width, this.max_height / this.window.height);
            this.scale = Math.min(1.0, this._initTmbHeight / this.window.height);
        // when this.clone source window resize, this.clone and this. actor resize accordingly
        this.scale_x = this.scale;
        this.scale_y = this.scale;
        // when scale of this. actor change, this.clone resize accordingly,
        // but the reactive area of the actor doesn't change until the actor is redrawn
        // don't know how to do it better..
        this.set_position(this.x, this.y + (this.tmbRedrawDirection ? 1 : -1));
        // switch direction of the move for each resize
        this.tmbRedrawDirection = !this.tmbRedrawDirection;
    }

    /* _onMouseMove(actor, event) {
        let [pos_x, pos_y] = event.get_coords();
        let state = event.get_state();
        if (_ctrlPressed(state)) {
        }
    } */

    _onBtnPressed(actor, event) {
        // Clutter.Event.click_count property in no longer available, since GS42
        //let doubleclick = event.get_click_count() === 2;
        if ((event.get_time() - this._prevBtnPressTime) < Clutter.Settings.get_default().double_click_time) {
            this._click_count +=1;
        } else {
            this._click_count = 1;
        }
        this._prevBtnPressTime = event.get_time();

        if (this._click_count === 2) {
            this.w.activate(global.get_current_time());
        }
    }

    _onBtnReleased(actor, event) {
        let button = event.get_button();
        switch (button) {
        case Clutter.BUTTON_PRIMARY:
            if (_ctrlPressed(event.get_state()))
                this._switchView();
            else
                this._reverseTmbWheelFunc = !this._reverseTmbWheelFunc;
            return Clutter.EVENT_STOP;
            break;
        case Clutter.BUTTON_SECONDARY:
            // if (_ctrlPressed(state))
            this._remove();
            return Clutter.EVENT_STOP;
            break;
        case Clutter.BUTTON_MIDDLE:
            // if (_ctrlPressed(state))
            this.w.delete(global.get_current_time());
            return Clutter.EVENT_STOP;
            break;
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
            if (_shiftPressed(state))
                this.opacity = Math.min(255, this.opacity + 24);
            else if (this._reverseTmbWheelFunc !== _ctrlPressed(state))
                this._switchSourceWin(-1);
            else if (this._reverseTmbWheelFunc === _ctrlPressed(state))
                this.scale = Math.max(0.05, this.scale - 0.025);
            break;
        case Clutter.ScrollDirection.DOWN:
            if (_shiftPressed(state))
                this.opacity = Math.max(48, this.opacity - 24);
            else if (this._reverseTmbWheelFunc !== _ctrlPressed(state))
                this._switchSourceWin(+1);
            else if (this._reverseTmbWheelFunc === _ctrlPressed(state))
                this.scale = Math.min(1, this.scale + 0.025);
            break;
        default:
            return Clutter.EVENT_PROPAGATE;
        }
        this._setSize();
        // this.scale = Math.min(1.0, this.max_width / this.width, this.max_height / this.height);
        return Clutter.EVENT_STOP;
    }

    _remove() {
        if (this.clone) {
            this.window.disconnect(this.windowConnect);
            this.clone.set_source(null);
        }
        this._tmbCollector.splice(this._tmbCollector.indexOf(this), 1);
        Main.overview.disconnect(this.conH);
        Main.overview.disconnect(this.conS);
        this.destroy();
    }

    _end_drag() {
        this.set_position(this._draggable._dragOffsetX + this._draggable._dragX, this._draggable._dragOffsetY + this._draggable._dragY);
        DND.SNAP_BACK_ANIMATION_TIME = 0;
        this.timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 0, () => {
            DND.SNAP_BACK_ANIMATION_TIME = this.saved_snap_back_animation_time;
        });
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

        this._setIcon();
    }

    _actionTimeoutActive() {
        if (this._actionTimeoutId)
            return true;
        this._actionTimeoutId = GLib.timeout_add(
            GLib.PRIORITY_DEFAULT,
            // timeout for resizing should be shorter than for window switching
            this._reverseTmbWheelFunc ? this._scrollTimeout : this._scrollTimeout / 2,
            this._removeActionTimeout.bind(this)
        );
        return false;
    }

    _removeActionTimeout() {
        if (this._actionTimeoutId)
            GLib.Source.remove(this._actionTimeoutId);

        this._actionTimeoutId = null;
        return false;
    }

    _setIcon() {
        let tracker = Shell.WindowTracker.get_default();
        let app = tracker.get_window_app(this.w);
        let icon = app
            ? app.create_icon_texture(this.height)
            : new St.Icon({icon_name: 'icon-missing', icon_size: this.height});
        icon.x_expand = icon.y_expand = false;
        if (this.icon)
            this.icon.destroy();
        this.icon = icon;
    }

    _switchView(clone = false) {
        if (clone) {
            this.set_child(this.clone);
        } else {
            this.set_child(this.get_child() === this.clone
                ? this.icon
                : this.clone
            );
        }
    }
});

/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * Util
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

const { Clutter, Gio, GLib, GObject, Meta, St, Shell } = imports.gi;

const Main            = imports.ui.main;

const Gi = imports._gi;


var Overrides = class {
    constructor() {
        this._overrides = {};
    }

    addOverride(name, prototype, overrideList) {
        const backup = this.overrideProto(prototype, overrideList, name);
        // don't update originals when override's just refreshing, keep initial content
        let originals = this._overrides[name]?.originals;
        if (!originals)
            originals = backup;
        this._overrides[name] = {
            originals,
            prototype,
        };
    }

    removeOverride(name) {
        const override = this._overrides[name];
        if (!override)
            return false;

        this.overrideProto(override.prototype, override.originals);
        delete this._overrides[name];
        return true;
    }

    removeAll() {
        for (let name in this._overrides) {
            this.removeOverride(name);
            delete this._overrides[name];
        }
    }

    hookVfunc(proto, symbol, func) {
        proto[Gi.hook_up_vfunc_symbol](symbol, func);
    }

    overrideProto(proto, overrides, name) {
        const backup = {};
        const originals = this._overrides[name]?.originals;
        for (let symbol in overrides) {
            if (symbol.startsWith('after_')) {
                const actualSymbol = symbol.slice('after_'.length);
                let fn;
                if (originals && originals[actualSymbol])
                    fn = originals[actualSymbol];
                else
                    fn = proto[actualSymbol];
                const afterFn = overrides[symbol];
                proto[actualSymbol] = function (...args) {
                    args = Array.prototype.slice.call(args);
                    const res = fn.apply(this, args);
                    afterFn.apply(this, args);
                    return res;
                };
                backup[actualSymbol] = fn;
            } else {
                backup[symbol] = proto[symbol];
                if (symbol.startsWith('vfunc'))
                    this.hookVfunc(proto[Gi.gobject_prototype_symbol], symbol.slice(6), overrides[symbol]);
                else if (overrides[symbol] !== null)
                    proto[symbol] = overrides[symbol];
            }
        }
        return backup;
    }
};

function getEnabledExtensions(pattern = '') {
    // extensionManager is unreliable on startup (not all extensions were loaded)
    // but gsettings key can contain removed extensions...
    // therefore we have to look into filesystem, what's really installed
    const extensionFiles = [...collectFromDatadirs('extensions', true)];
    const installed = extensionFiles.map(({ info }) => {
        let fileType = info.get_file_type();
        if (fileType !== Gio.FileType.DIRECTORY)
            return null;
        const uuid = info.get_name();
        return uuid;
    }).filter(uuid => uuid !== null && uuid.includes(pattern));

    let extensions = [];

    const enabled = global.settings.get_strv('enabled-extensions');
    const disabled = global.settings.get_strv('disabled-extensions');

    extensions = installed.filter(ext =>
        enabled.includes(ext) && !disabled.includes(ext)
    );
    return extensions;
}

function* collectFromDatadirs(subdir, includeUserDir) {
    let dataDirs = GLib.get_system_data_dirs();
    if (includeUserDir)
        dataDirs.unshift(GLib.get_user_data_dir());

    for (let i = 0; i < dataDirs.length; i++) {
        let path = GLib.build_filenamev([dataDirs[i], 'gnome-shell', subdir]);
        let dir = Gio.File.new_for_path(path);

        let fileEnum;
        try {
            fileEnum = dir.enumerate_children('standard::name,standard::type',
                Gio.FileQueryInfoFlags.NONE, null);
        } catch (e) {
            fileEnum = null;
        }
        if (fileEnum !== null) {
            let info;
            while ((info = fileEnum.next_file(null)))
                yield { dir: fileEnum.get_child(info), info };
        }
    }
}

function translateScrollToMotion(direction) {
    return direction === Clutter.ScrollDirection.UP
        ? Meta.MotionDirection.UP
        : Meta.MotionDirection.DOWN;
}

function shiftPressed(state, ignoredModifiers = 0) {
    if (state === undefined)
        state = global.get_pointer()[2];
    // ignore the key if used as a modifier for the switcher shortcut
    return !!(state & Clutter.ModifierType.SHIFT_MASK) && !(ignoredModifiers & Clutter.ModifierType.SHIFT_MASK);
}

function ctrlPressed(state, ignoredModifiers = 0) {
    if (state === undefined)
        state = global.get_pointer()[2];
    // ignore the key if used as a modifier for the switcher shortcut
    return !!(state & Clutter.ModifierType.CONTROL_MASK) && !(ignoredModifiers & Clutter.ModifierType.CONTROL_MASK);
}

function getWindows(workspace, modals = false) {
    // We ignore skip-taskbar windows in switchers, but if they are attached
    // to their parent, their position in the MRU list may be more appropriate
    // than the parent; so start with the complete list ...
    let windows = global.display.get_tab_list(Meta.TabList.NORMAL_ALL,
        workspace);
    // ... map windows to their parent where appropriate, or leave it if the user wants to list modal windows too...
    return windows.map(w => {
        return w.is_attached_dialog() && !modals ? w.get_transient_for() : w;
    // ... and filter out skip-taskbar windows and duplicates
    // ... (if modal windows (attached_dialogs) haven't been removed in map function, leave them in the list)
    }).filter((w, i, a) => (!w.skip_taskbar && a.indexOf(w) === i) || w.is_attached_dialog());
}

function getWindowApp(metaWindow) {
    if (!metaWindow)
        return null;
    let tracker = Shell.WindowTracker.get_default();
    return tracker.get_window_app(metaWindow);
}

function getCurrentMonitorGeometry() {
    return global.display.get_monitor_geometry(global.display.get_current_monitor());
}

function getCurrentMonitorIndex() {
    const ws = global.workspaceManager.get_active_workspace();
    let windows = getWindows(ws);
    const monIndex = windows.length > 0 ? windows[0].get_monitor()
        : global.display.get_current_monitor();
    return monIndex;
}

function getMonitorByIndex(monitorIndex) {
    let monitors = Main.layoutManager.monitors;
    for (let monitor of monitors) {
        if (monitor.index === monitorIndex)
            return monitor;
    }

    return -1;
}

function isWsOrientationHorizontal() {
    if (global.workspace_manager.layout_rows === -1)
        return false;
    return true;
}

function translateDirectionToHorizontal(direction) {
    if (isWsOrientationHorizontal()) {
        if (direction === Meta.MotionDirection.UP)
            direction = Meta.MotionDirection.LEFT;
        else
            direction = Meta.MotionDirection.RIGHT;
    }
    return direction;
}

function getScrollDirection(event) {
    // scroll wheel provides two types of direction information:
    // 1. Clutter.ScrollDirection.DOWN / Clutter.ScrollDirection.UP
    // 2. Clutter.ScrollDirection.SMOOTH + event.get_scroll_delta()
    // first SMOOTH event returns 0 delta,
    //  so we need to always read event.direction
    //  since mouse without smooth scrolling provides exactly one SMOOTH event on one wheel rotation click
    // on the other hand, under X11, one wheel rotation click sometimes doesn't send direction event, only several SMOOTH events
    // so we also need to convert the delta to direction
    let direction = event.get_scroll_direction();

    if (direction === Clutter.ScrollDirection.SMOOTH) {
        let [, delta] = event.get_scroll_delta();

        if (!delta)
            return null;

        direction = delta > 0 ? Clutter.ScrollDirection.DOWN : Clutter.ScrollDirection.UP;
    }

    return direction;
}

var WindowPreview = GObject.registerClass({
    GTypeName: `WindowPreview${Math.floor(Math.random() * 1000)}`,
}, class WindowPreview extends St.Widget {
    _init() {
        super._init({ layout_manager: new Clutter.BinLayout() });
        this._window = null;

        this._clone = new Clutter.Clone();
        this.add_child(this._clone);

        this._highlight = new St.Widget({ style_class: 'cycler-highlight' });
        this.add_child(this._highlight);

        let coordinate = Clutter.BindCoordinate.ALL;
        let constraint = new Clutter.BindConstraint({ coordinate });
        this._clone.bind_property('source', constraint, 'source', 0);

        this.add_constraint(constraint);

        this.connect('destroy', this._onDestroy.bind(this));
    }

    set window(w) {
        if (this._window === w)
            return;

        this._window?.disconnectObject(this);

        this._window = w;

        if (this._clone.source)
            this._clone.source.sync_visibility();

        const windowActor = this._window?.get_compositor_private() ?? null;

        if (windowActor)
            windowActor.hide();

        this._clone.source = windowActor;

        if (this._window) {
            this._onSizeChanged();
            this._window.connectObject('size-changed',
                this._onSizeChanged.bind(this), this);
        } else {
            this._highlight.set_size(0, 0);
            this._highlight.hide();
        }
    }

    _onSizeChanged() {
        const bufferRect = this._window.get_buffer_rect();
        const rect = this._window.get_frame_rect();
        this._highlight.set_size(rect.width, rect.height);
        this._highlight.set_position(
            rect.x - bufferRect.x,
            rect.y - bufferRect.y);
        this._highlight.show();
    }

    _onDestroy() {
        this.window = null;
    }
});

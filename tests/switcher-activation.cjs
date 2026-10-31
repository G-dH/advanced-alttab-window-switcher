const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run the popup's actual release and timeout handlers without a GNOME session.
const source = fs.readFileSync('src/windowSwitcherPopup.js', 'utf8')
    .replace(/^import .*;$/gm, '').replace(/^export /gm, '');
const opt = { REQUIRE_ENTER: true, NO_MODS_TIMEOUT: 5000 };
let modifiers = 0;
let timerCallback;
let timerId = 0;
const removedTimers = [];
const context = vm.createContext({
    global: { get_pointer: () => [0, 0, modifiers] },
    Clutter: { EVENT_STOP: true },
    GLib: {
        timeout_add(priority, interval, callback) {
            timerCallback = callback;
            return ++timerId;
        },
        source_remove: id => removedTimers.push(id),
        SOURCE_REMOVE: false,
        SOURCE_CONTINUE: true,
    },
});
vm.runInContext(`${source}\nglobalThis.Popup = WindowSwitcherPopup; globalThis.init = init;`, context);
context.init({ opt, _: text => text });

function popup(keyboard = true) {
    const signals = {};
    const instance = Object.assign(Object.create(context.Popup), {
        _keyboardTriggered: keyboard,
        _modifierMask: 8,
        _firstRun: true,
        _selectedIndex: 0,
        _noModsTimeoutId: 0,
        _dashMode: !keyboard,
        _inputHandler: { isPointerOut: () => true },
        finished: 0,
        dismissed: 0,
        _finish() { this.finished++; },
        fadeAndDestroy() { this.dismissed++; },
        connect(name, handler) { signals[name] = handler; },
    });
    instance._connectKeyHandler();
    instance.release = () => signals['key-release-event']();
    return instance;
}

for (const mask of [8, 64]) { // Alt and Super, including release before the grab.
    for (const held of [0, mask]) {
        modifiers = held;
        const instance = popup();
        assert.equal(instance._resetNoModsTimeoutOrFinish('', mask), false);
        instance._firstRun = false;
        modifiers = 0;
        instance.release();
        instance._resetNoModsTimeoutOrFinish('', mask); // Search rebuilds the popup.
        instance.release();
        assert.equal(instance.finished, 0, 'modifier release leaves the popup open');
        assert.equal(instance.dismissed, 0);
        assert.equal(instance._noModsTimeoutId, 0, 'keyboard popup has no dismissal timer');
        instance._selectedIndex = -1;
        instance.release();
        assert.equal(instance.dismissed, 0, 'an empty search stays open for editing');
    }
}

const instance = popup();
instance._noModsTimeoutId = 99;
instance._resetNoModsTimeout();
assert.ok(removedTimers.includes(99), 'any existing keyboard timeout is removed');
assert.equal(instance._noModsTimeoutId, 0);

const mouse = popup(false);
mouse._resetNoModsTimeoutOrFinish('', 0);
assert.ok(mouse._noModsTimeoutId, 'mouse-triggered popup retains its timeout');
timerCallback();
assert.equal(mouse.dismissed, 1, 'mouse-triggered popup can still dismiss on timeout');

opt.REQUIRE_ENTER = false;
modifiers = 8;
const classic = popup();
classic._resetNoModsTimeoutOrFinish('', 8);
modifiers = 0;
classic.release();
assert.equal(classic.finished, 1, 'disabling the option restores activation on Alt release');
classic._firstRun = false;
assert.equal(classic._resetNoModsTimeoutOrFinish('', 8), true);
assert.equal(classic.finished, 2, 'classic mode retains the early-release race check');

console.log('Switcher activation tests passed');

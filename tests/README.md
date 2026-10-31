# Switcher activation checks

Run from the repository root with Node.js:

```sh
node tests/switcher-activation.cjs
```

The suite exercises the popup's release and timeout handlers with GNOME
dependencies stubbed. It checks Alt/Super release, release before the keyboard
grab, search updates, empty results, mouse timeouts, and activation on release
when the option is disabled.

For manual verification in GNOME:

1. Leave the new option disabled and confirm Alt+Tab activates on Alt release.
2. Enable **Keep Switcher Open After Modifier Release** and **Search Mode as
   Default** in Behavior preferences. Press Alt+Tab and release Alt. Type a search,
   including a query with no matches, and confirm the popup stays open.
3. Cycle with Tab and Shift+Tab, activate with Enter, and dismiss with Esc.
   Confirm mouse activation and other activation shortcuts still work.
4. Disable **Search Mode as Default** while leaving the new option enabled.
   Confirm releasing Alt still leaves the popup open and Insert enables search.
5. If configured, check a Super shortcut and mouse-triggered switchers. Mouse
   timeouts should behave as before.

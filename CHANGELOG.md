## Changelog

### v13 (not yet released on e.g.o.)
**Fixed**
- reverse ordered switcher list wider than the display has the first item out of the display
- red dot indicator of running app ignores app filter mode
- app description not localized

**Changed**
- Space (KP_0) key toggles `Show Selected Window` `Preview` mode On/Off instead of one time preview

### v12
**Added:**
- option `Tooltip Label Scale` allows to adjust tooltip labels size.
- option `Prioritize Running Apps` for serch in applications.
- window title tooltip shows app name
- updated metadata to support GNOME Shell 42

**Fixed**
- pushModal function - AATWS chrashes when grabing input not successful

**Improved**
- own tooltip label style replaced with the system `dash-label` style with fixed radius, to better fit the current Shell theme.

### v11:
**Added:**
- actions `Move Window/App to New Workspace` with `Ctrl + Shift + Up/Down` shortcut.
- option `Minimized Windows at the End` of the list (default in GNOME Shell is `true`).
- `Super Key Mode` option can override default Super key functionality of GNOME Shell and instead of Activities AATWS opens App or Window Switcher. Unfortunately, when AATWS switcher is up and grabed input, the Super key press/release event cannot be catched by the AATWS unless you simultaneously press and hold any other modifier key, so I've added `Shift + Super` shortcut to toggle Activities overview and `Ctrl + Shift + Super` shortcut to toggle App Grid view.
- app switcher now search also in `comment`, `keywords` and `category` properties of app `.desktop` file, so it's easier to find application if you don't remember its name.
- when searching apps, the tooltip title (if enabled) of selected application adds its `generic_name` (if differ from name), which usually contains generic type of application, and also adds `comment`, which contains app description.
- option for app switcher `Raise First Window Only` - on app activation raise only its most recently used window instead of all app windows.
- option `Show Selected Window` now has two options - `Show Preview` and `Show Window`
- `Show Window` hotkey no longer raises a real window but shows a preview instead, which dowsn't alter the current window stack.
- option `Max Number of Search Results` in App Switcher

**Other Changes**
- tooltips replaced by captions directly under each option

### v10:

**Added:**
- Configurable hotkeys
- Option `Hover Selects item` - allows to disable select item by hovering mouse.
**Improved:**
- Search prefers words and titles starting with entered string
**Fixed:**
- `Fullscreen Selected on Empty WS` action - restore window on removed workspace crashes GS.
- Unaccessible items if `Show selected window/app imediately` is enabled and the switcher popup is wider than screen.
- Filter not shared between `Window` and `App` modes before the filter is switched.
- Global variables mess
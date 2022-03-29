## Changelog

### v13 (not yet released)
**Added:**
- Each window preview in the switcher list reveals the `Close Window` button on mouse hover to easily close the window.
- Option `Up/Down Keys Action` allows to choose what action will be assigned to the arrow keys Up and Down - `Nothing`, `Switch Workspace`, `Toggle Single App Mode` or `Down:Single App, Up:Switcher Mode`.
- Option `Always Activate Focused Window` - hack for the window manager that should avoid situations when the focused window is not activated and therefore does not update its position in the window switcher list. That may happen if you minimize a window, wm focuses the next window in the stack, but leaves it inactive until the user interacts with the window.
- Adwaita prefs window support for GNOME Shell 42
- Overlay (Super_L in default) key press can now close the popup and initial double-press of the key can be set to user defined action - Open Activities Overview, Open App Grid, Activate Previous Window, Toggle Switcher Mode (App/Windows). It's an experimental option, hack that I'm using to unblock the Overlay key signal events in the modal state leads to brief graphics stuttering when AATWS pops up and out, which can be annoying if you work with video or any moving content.
- App search results add information about whether the application was installed as Flatpak or Snap, and the commandline app property is searched instead of the executable propetry, so you can find all Snap or Flatpack applications by entering a specific pattern.

**Fixed:**
- Reverse ordered switcher list wider than the display has the first item out of the display.
- Red dot indicator of running app ignores app filter mode.
- App description not localized.
- Mouse buttons and scroll wheel events for the switcher item not read from the whole highlited area.
- Double click on DND window thumbnail doesn't work for GNOME Shell 42

**Other changes**
- Space/KP_0 keys toggle `Show Selected Window` `Preview` mode On/Off instead of one time preview.
- Added Mouse page to preferences window
- Removed workspace switcher options as they can be controlled using the `Workspace Switcher Manager` extension.
- Preferences window now supports new GNOME 42 Adwaita toolkit and also Gtk3 and Gtk4 versions of prefs windows were refactored to get visually closer to the Adwaita version.

### v12
**Added:**
- Option `Tooltip Label Scale` allows to adjust tooltip labels size.
- Option `Prioritize Running Apps` for serch in applications.
- Window title tooltip shows app name.
- Updated metadata to support GNOME Shell 42.

**Fixed:**
- PushModal function - AATWS chrashes when grabing input not successful.

**Other changes:**
- Own tooltip label style replaced with the system `dash-label` style with fixed radius, to better fit the current Shell theme.

### v11:
**Added:**
- Actions `Move Window/App to New Workspace` with `Ctrl + Shift + Up/Down` shortcut.
- Option `Minimized Windows at the End` of the list (default in GNOME Shell is `true`).
- `Super Key Mode` option can override default Super key functionality of GNOME Shell and instead of Activities AATWS opens App or Window Switcher. Unfortunately, when AATWS switcher is up and grabed input, the Super key press/release event cannot be catched by the AATWS unless you simultaneously press and hold any other modifier key, so I've added `Shift + Super` shortcut to toggle Activities overview and `Ctrl + Shift + Super` shortcut to toggle App Grid view.
- App switcher now search also in `comment`, `keywords` and `category` properties of app `.desktop` file, so it's easier to find application if you don't remember its name.
- When searching apps, the tooltip title (if enabled) of selected application adds its `generic_name` (if differ from name), which usually contains generic type of application, and also adds `comment`, which contains app description.
- Option for app switcher `Raise First Window Only` - on app activation raise only its most recently used window instead of all app windows.
- Option `Show Selected Window` now has two options - `Show Preview` and `Show Window`
- `Show Window` hotkey no longer raises a real window but shows a preview instead, which dowsn't alter the current window stack.
- Option `Max Number of Search Results` in App Switcher

**Other Changes:**
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
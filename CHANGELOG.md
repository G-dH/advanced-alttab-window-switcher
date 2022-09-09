## Changelog

### v19/20 2022-09-09
**Added**
- Top and bottom hot edge options allows to trigger *AATWS* popup using a mouse without *Custom Hot Corners - Extended*.
- Option `Interactive Indicators` and new window menu allows more effective navigation using a mouse without the need to configure and remember actions on mouse buttons.
- Light and Dark color themes that can follow system wide Dark mode setting on GS 42+ and dark Gtk theme setting on older versions.
- About page in preferences window with `Reset all options` button and links to the project related sites.

**Fixed**
- Mouse pointer overshoot scrolling in GS40+ doesn't work. It's a GS 40+ regression.
- App window counter includes `skip_taskbar` windows.

**Changed**
- Default mouse buttons configuration.

### v18 2022-07-06
**Fixed**
- Show Apps icon cannot be activated

### v17 2022-07-06
**Added:**
- Hotkey to toggle `Include Favorite Apps` - select `Show Apps Icon` and press the key above Tab (group switcher shortcut).

**Fixed:**
- DND Window thumbnails - scroll action works only once; when source windo closes, thumbnail isn't destroyed completely.


### v16 2022-07-06
**Added:**
- App Switcher Option: `Include Show Apps Icon` - allows you to toggle Overview's App Grid from AATWS.
- App Switcher Option: `Show App Windows Before Activation` - if you click on icon with multiple windows, the switcher toggles to the single app mmode to show you the windows instead of activation of the most recently used window.
- External/Mouse trigger option: `Force App Switcher Include Favorites` - App switcher can include favorite apps only if triggered using a mouse (from Custom Hot Corners - Extended).
- Updated DND Window Thumbnail with overlay close button and scroll function indicator and also full-sized window preview on hover.

**Fixed:**
- backward navigation don't work for some keayboard shortcuts.
- Closing AATWS using Esc key sends Esc release event to the focused window which may react to it. Now AATWS closes on release of the Esc key instead of press to avoid this issue.


### v15
**Added:**
- Option `Synchronize Filter Mode` allows to keep the current window flter mode when switcheng between Window and App modes of the switcher, which was the default behavior until now. If disabled, the switcher will change the window filter mode to the respective default each time the switcher mode is changed.
- Returned requested option `Show Workspace Switcher Pop-up`.
- Option `Monitor with current window` aded to `Default Monitor` menu.
- Option `Hide Window Counter For Single-Window Apps` as complementary to the option `Show Window Counter` (PR [#27](https://github.com/G-dH/advanced-alttab-window-switcher/pull/27))

**Other changes:**
- Single app mode now includes windows whose parent applications do not match the ID but have the same name. It helps to, for example, isolate all windows of Virtual Box machines, preferences windows spawned by the Extensions app and other.
- Always On Top state of the window is now indicated by the icon instead of elevated front (app) icon.
- Action on hotkey `Shift+Super` changed back to Toggle Activities overview.
- Updated style of running app dot ndicator.
- Removed running app dot indicator if favorite apps are not included in the app switcher.  
- Preferences window code refactored.
- Activation of Preferences window from AATWS can now close blocking preferences window of another extension and also move its own already existing window to the current workspace.
- Performance optimizations

**Fixed:**
- Scroll to select item doesn't work
- Option `Always Activate Focused Window` breaks WS switching in Overview
- Allocation warnings in GNOME 42

### v14 (13 rejected due to formal issues)
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
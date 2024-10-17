## Changelog
### v47.1
**Fixed:**
- Conflict with *Tiling assistant* extension (#124)


### v47.0/v46.3 (2024-10-11 e.g.o)
**Fixed**
- Switcher not showing if window has no title (#123)

**Added:**
- GNOME 47 support
- *Switch Filter Mode Permanently* hotkey option
- *Press Tab Again to Switch Filter* option
- *Delete Key to Close* hotkey option
- *Show Favorite Apps When No Window Open* option

**Other Changes:**
- Refactored codebase for improved readability and maintainability 


### v46.2 (2024-05-30) v44.11 (not released yet)
**Added:**
- Option *Follow System Color Style - Inverted* allows automatic switching between Dark and Light ATAWS color styles, opposite to the system's Dark mode setting

**Fixed:**
- Option *Show Hotkeys F1-F12 for Direct Activation* crashes AATWS on GNOME 46 (#102)
- Missing "running" indicator
- Scroll actions only work for one direction
- Various exceptions filling the system log
- Improved sorting of window search results - add app name comparison

**Other Changes:**
- Set switcher popup `offscreen_redirect` property to ALWAYS for better performance
- In the Settings window, spin buttons has been replaced with scales
- Refactored parts of the code


### v46.1 (2024-03-13) v44.10 (not released)
**Added:**
- Support for GNOME 46.rc

**Fixed:**
- The switcher position can end up out of the screen if main panel is vertical (#92)
- The switcher won't close when something triggers overview while it's open (#93)
- Conflicts with Tiling Assistant extension (#90)
- Sorting of the window list ignores application names if they are not part of the window title
- Space only show window preview if Shift is pressed

**Other Changes:**
- Dropped support for GNOME 3.36 - 41 (still available but no longer being developed)
- Removed winTmb module for window thumbnails, AATWS can now use the new standalone WTMB extension
- Automatic switching filter in case the switcher shows only one item that matches the current filter setting now take effect only if you press Tab (or your shortcut) key once again
- Removed custom popup border radius and padding so it follows the current GNOME Shell theme


### v46.0, v44.9 (2024-01-29)

**Added**
- Support for GNOME 46.alpha
- Automatically switch filter in case the switcher shows only one item that matches the current filter setting and you press your shortcut key (typically Tab) once again. Allows for quicker switching to a window on another monitor/workspace, if you set the filter mode to current monitor/workspace.

**Fixed**
- Initial selection for search results is always set to the first item, even if the item refers to the current window. In this case the second item will be selected in the window switcher mode.
- Using hotkey to toggle search mode should activate the search even if it's already active by default, because it also allows user to release modifier key for more comfortable typing
- Option "Show Workspace Switcher Pop-up" doesn't take effect immediately


### v45.5 (2023-12-17) v44.7 (2023-12-17)
**Fixed:**
- Title labels and workspace thumbnails stay invisible when search is activated before the slide-in animation completes


### v45.4 (2023-12-17) v44.6 (2023-12-17)
**Fixed:**
- Access to destroyed actors exceptions - typo in previous fix


### v45.3 (2023-12-15) v44.5 (2023-12-15)
**Fixed:**
- Access to destroyed actors exceptions


### v44.4 (2023-12-13)
**Fixed:**
- Duplicated option


### v45.2 (2023-12-12) v44.3 (2023-12-12)
**Added:**
- Single item in the filtered list automatically switches filter mode so you can directly switch to an app/window outside of the current filter scope
- Option *Animation speed (%)* allows adjusting speed of showing and hiding the switcher if used in Dock mode or triggered using the Super key

**Fixed:**
- Search entry position in Dock mode
- Ctrl used as a modifier key for the shortcut that triggers the switcher conflicts with the built-in hotkeys. Solution - if the shortcut includes Ctrl and/or Shift, internal hotkeys based on these keys won't function.

**Changed:**
- Animations when the switcher is triggered as a dock using a mouse or by the overly-key (Super/Win)
- Versioning changed to `latest supported GNOME major version`.`extension revision`
- Option descriptions in the Settings window have been updated


### v27.45 (2023-11-11)
**Added:**
- Support for GNOME Shell 45

**Fixed**
- Initial selection when all windows minimized (no active window) is SECOND instead of FIRST


### v25/26 (2023-05-08)
**Fixed:**
- App switcher icons ignore mouse clicks in GNOME 44
- Backward select does't work for non-Tab shortcuts


### v23/24 (2023-03-30)
**Added:**
- Option `Enable Hot Edge in Fullscreen Mode` allows to control whether the hot edge trigger will be active when the focused window is in the full-screen mode.
- Option `Show Workspace Thumbnails` allows to display workspace thumbnails above/below the switcher popup for a better navigation and control over workspaces. I also allows drag an drop windows between workspaces
- Dock related options moved to the new `Dock Mode` page in the Settings window.

**Fixed:**
- Some modifier keys are unsupported
- Option *Always Activate Focused Window* unnecessary and causing issues in GNOME 43+


### v22 (2022-12-01)
**Added:**
- App switcher hotkey to toggle `Include Favorite Apps`.
- VSCodium window titles - ws/folder name in the title label moves to the front to be visible if the title is ellipsized.
- Link to `CHANGELOG.md` on `About` tab in `Settings` window.

**Fixed:**
- Improved workaround for releasing grabbed keyboard input, fixed incorrect pop if pushModal unsuccessful.
- Initial selection after toggle `Switcher Mode`.

**Changed:**
- Style - thicker top color border indicating Filter Mode.
- Refactored `_initialSelection()`.


### v21 2022-11-23 (e.g.o)
**Added**
- Shortcut `Shift + Enter` for switching input source (keyboard layout).
- Option `Remember Keyboard` - if active, the input set using the shortcut will be activated every time AATWS is displayed.
- Option `Dash Visibility` allows you to hide Dash in the Activities overview, in case you only use AATWS.
- Options `Hot Edge Pressure Threshold` and `Hot Edge Width`.

**Fixed**
- `Show Hotkeys F1-F12 for Direct Activation` option crashes AATWS.
- App activation in mouse mouse mode not working when no window opened.
- Option `Always Activate Focused Window` affects wm focus-mode auto-rise-delay.
- Super key set to AATWS by default.
- Double-selection causing title captions allocation errors.
- Initial delay doesn't subtract AATWS build time.
- Screen scale factor affects popup margins and bottom padding non-linearly.
- Margins when AATWS triggered from CHC-E extension.
- Unable to grab input and show the switcher popup if Virtual Box Machine window has focus.

**Changed**
- Disabled focused item indicator (I actually don't like it).
- Style - background padding reduction, thicker left/right color border indicating Filter Mode.


### v20/19 2022-09-09
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
- DND Window thumbnails - scroll action works only once; when source window closes, thumbnail isn't destroyed completely.


### v16 2022-07-06
**Added:**
- App Switcher Option: `Include Show Apps Icon` - allows you to toggle Overview's App Grid from AATWS.
- App Switcher Option: `Show App Windows Before Activation` - if you click on icon with multiple windows, the switcher toggles to the single app mode to show you the windows instead of activation of the most recently used window.
- External/Mouse trigger option: `Force App Switcher Include Favorites` - App switcher can include favorite apps only if triggered using a mouse (from Custom Hot Corners - Extended).
- Updated DND Window Thumbnail with overlay close button and scroll function indicator and also full-sized window preview on hover.

**Fixed:**
- backward navigation don't work for some keyboard shortcuts.
- Closing AATWS using Esc key sends Esc release event to the focused window which may react to it. Now AATWS closes on release of the Esc key instead of press to avoid this issue.


### v15
**Added:**
- Option `Synchronize Filter Mode` allows to keep the current window filter mode when switching between Window and App modes of the switcher, which was the default behavior until now. If disabled, the switcher will change the window filter mode to the respective default each time the switcher mode is changed.
- Returned requested option `Show Workspace Switcher Pop-up`.
- Option `Monitor with current window` added to `Default Monitor` menu.
- Option `Hide Window Counter For Single-Window Apps` as complementary to the option `Show Window Counter` (PR [#27](https://github.com/G-dH/advanced-alttab-window-switcher/pull/27))

**Other changes:**
- Single app mode now includes windows whose parent applications do not match the ID but have the same name. It helps to, for example, isolate all windows of Virtual Box machines, preferences windows spawned by the Extensions app and other.
- Always On Top state of the window is now indicated by the icon instead of elevated front (app) icon.
- Action on hotkey `Shift+Super` changed back to Toggle Activities overview.
- Updated style of running app dot indicator.
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
- Adwaita preferences window support for GNOME Shell 42
- Overlay (Super_L in default) key press can now close the popup and initial double-press of the key can be set to user defined action - Open Activities Overview, Open App Grid, Activate Previous Window, Toggle Switcher Mode (App/Windows). It's an experimental option, hack that I'm using to unblock the Overlay key signal events in the modal state leads to brief graphics stuttering when AATWS pops up and out, which can be annoying if you work with video or any moving content.
- App search results add information about whether the application was installed as Flatpak or Snap, and the command line app property is searched instead of the executable property, so you can find all Snap or Flatpack applications by entering a specific pattern.

**Fixed:**
- Reverse ordered switcher list wider than the display has the first item out of the display.
- Red dot indicator of running app ignores app filter mode.
- App description not localized.
- Mouse buttons and scroll wheel events for the switcher item not read from the whole highlighted area.
- Double click on DND window thumbnail doesn't work for GNOME Shell 42

**Other changes**
- Space/KP_0 keys toggle `Show Selected Window` `Preview` mode On/Off instead of one time preview.
- Added Mouse page to preferences window
- Removed workspace switcher options as they can be controlled using the `Workspace Switcher Manager` extension.
- Preferences window now supports new GNOME 42 Adwaita toolkit and also Gtk3 and Gtk4 versions of preferences windows were refactored to get visually closer to the Adwaita version.

### v12
**Added:**
- Option `Tooltip Label Scale` allows to adjust tooltip labels size.
- Option `Prioritize Running Apps` for search in applications.
- Window title tooltip shows app name.
- Updated metadata to support GNOME Shell 42.

**Fixed:**
- PushModal function - AATWS crashes when grabbing input not successful.

**Other changes:**
- Own tooltip label style replaced with the system `dash-label` style with fixed radius, to better fit the current Shell theme.

### v11:
**Added:**
- Actions `Move Window/App to New Workspace` with `Ctrl + Shift + Up/Down` shortcut.
- Option `Minimized Windows at the End` of the list (default in GNOME Shell is `true`).
- `Super Key Mode` option can override default Super key functionality of GNOME Shell and instead of Activities AATWS opens App or Window Switcher. Unfortunately, when AATWS switcher is up and grabbed input, the Super key press/release event cannot be caught by the AATWS unless you simultaneously press and hold any other modifier key, so I've added `Shift + Super` shortcut to toggle Activities overview and `Ctrl + Shift + Super` shortcut to toggle App Grid view.
- App switcher now search also in `comment`, `keywords` and `category` properties of app `.desktop` file, so it's easier to find application if you don't remember its name.
- When searching apps, the tooltip title (if enabled) of selected application adds its `generic_name` (if differ from name), which usually contains generic type of application, and also adds `comment`, which contains app description.
- Option for app switcher `Raise First Window Only` - on app activation raise only its most recently used window instead of all app windows.
- Option `Show Selected Window` now has two options - `Show Preview` and `Show Window`
- `Show Window` hotkey no longer raises a real window but shows a preview instead, which doesn't alter the current window stack.
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
- Unaccessible items if `Show selected window/app immediately` is enabled and the switcher popup is wider than screen.
- Filter not shared between `Window` and `App` modes before the filter is switched.
- Global variables mess

# AATWS - Advanced Alt-Tab Window Switcher (ESM branch)
An extension for GNOME Shell that replaces its following built-in switchers:

- **Switch windows**
- **Switch applications**
- **Switch windows of an application**

**Keyboard shortcuts for these switchers can be set in *GNOME Settings > Keyboard Shortcuts*.**

*AATWS - Advanced Alt-Tab Window Switcher* offers effective and highly customizable navigation between windows, workspaces, monitors and also window control. With the built-in *type to search* feature you don't even need to see what's in the switcher list to find your window or app instantly. App Switcher has also built-in app launcher and can find application even if you don't exactly know its name. AATWS also offers activation using a mouse by hitting a top or bottom hot edge and can serve as an app launcher and replacement for dash or dock.

[<img alt="" height="100" src="https://raw.githubusercontent.com/andyholmes/gnome-shell-extensions-badge/master/get-it-on-ego.svg?sanitize=true">](https://extensions.gnome.org/extension/4412/advanced-alttab-window-switcher/)

![Window Switcher Popup](screenshots/screenshot.png)

## Features:
- Supports GNOME Shell 45 
- Filters (all/workspace/monitor), sorting, grouping options, most of them switchable *on the fly*
- Type to search - windows, apps, settings. Search can automatically switch current filter mode if needed
- Hotkeys allow to control switcher and windows, including relocations
- Workspace navigation
- Navigation between monitors
- Full-size window previews
- Size adjustments
- Can replace dash/dock
- Application launcher, app switcher can include favorite apps and *Show Apps* icon
- Optional Super key activation
- Configurable overlay indicators, optionally interactive to help with mouse control
- Mouse control, including optional top or bottom hot edge for switcher activation
- Configurable mouse buttons and scroll wheel
- Supported by the *Custom Hot Corners - Extended* extension
- Workspace Thumbnails option allows better navigation between workspaces


### Hotkeys
[A-Z] hotkeys can be customized in AATWS Preferences window, for each customizable action can be set up to two hotkeys for case you need to cover a non [a-zA-Z] keystroke with and without Shift modifier. You can disable any customizable hotkey by deleting its entry. Some core hotkeys cannot be customized nor disabled.

**Default configuration:**

| Hotkey | Description |
|------|---------------------------------|
|`H/L, Left/Right arrows`|  - Window selection|
|`J/K, Up/Down, PgUp/Down`| - Workspace selection|
|`Ctrl+[PgUp/Down]`|        - Reorder the current workspace - changes the workspace index -1/+1.|
|`Shift+Arrow keys`|      - Move the switcher popup to the adjacent monitor in corresponding direction.|
|`Ctrl+Tab`|                - Move the switcher popup to the next monitor, order is given by the Shell, Shift key changes direction.|
|`Space, KP_0/KP_Ins`|      - Toggle `Shows selected window` `Preview` mode on/off.|
|`Q, Ctrl+Super`|                       - Switch the window `Filter` mode - `ALL / WS / MONITOR` (the Monitor mode is skipped if single monitor is used or if the secondary monitor is empty).|
|`;/~ (the key above Tab)`| - In the Window mode - sort windows by application, each subsequent key press selects the first window of the next app.<br>-In the Application mode - iterate over windows of the selected application, Tab switches back to apps.|
|`G`|                       - Toggle `Sort windows by workspace`, if `Filter` mode is set to `ALL`.|
|`1/+/!`|                   - Toggle `Single App` mode - shows only windows of the selected application.|
|`E/Insert`|                - Toggle the `Type to Search` mode. If the search mode is activated by the hotkey, you can release the Alt key and the popup will not close. Selected item then must be activated using the `Enter` key, or you can close the popup without item activation using the Esc. `Del` key clears the entry.
|`W`|                       - `Close` the selected window or `Quit` selected application.|
|`Ctrl+W`|                  - Close the application of the selected window.|
|`Shift+Del`|               - Force Close - sends a `kill -9` signal to the application of selected window or to the selected application.|
|`C`|                       - Close all windows in the list that belong to the same application as the selected window.|
|`A`|                       - Toggle window `Always on Top` and also switch to window workspace and rise the window.<br>- The `Above` state is indicated by the front icon at the top instead of the bottom.|
|`S`|                       - Toggle selected window `Always on Visible Workspace`. Ths state is indicated by the 'pin' icon at the top. Note, that this flag have all windows located on other than the primary monitor, when the GNOME Shell's option `Workspaces on Primary Display Only` is active.|
|`X, Shift+Enter`|        - Move selected window to the current workspace and monitor<br>-The current monitor is the one where the switcher popup is placed or where the mouse pointer is currently placed if the switcher was triggered by a mouse from the Custom Hot Corners - Extended extension.|
|`M`|                       - Toggle full maximization of selected window on the current workspace and monitor. The current monitor is the one as described above.|
|`N, Ctrl+Enter`|           - Open new window of selected application, if the application supports it.|
|`F`|                       - Move the selected window to a new empty workspace next to its current workspace and switches the window to the full-screen mode.<br>-Next use of this action on the same window moves the window back to its original workspace and turns off the full-screen mode.|
|`Ctrl+;/~`|                - Toggle between Windows and Applications modes.|
|`T`|                       - Create a thumbnail preview of the selected window and place it at the bottom right of the current monitor. You can remove the lastly created thumbnail using this hotkey while holding the `Ctrl` key pressed, or remove all created thumbnails while holding `Ctrl` and `Shift` keys pressed.|
|`P`|                       - Open preferences window for this extension.|
|`Ctrl+Up/Down/Left/Right`| - Move selected window/app to the adjacent workspace in front of or behind the current workspace.|
|`Ctrl+Shift+Up/Down`|      - Move selected window/app to the newly created workspace in front of or behind the current workspace.|
|`Ctrl+Shift+Left/Right`|   - In App mode with Favorites change the position of the selected favorite application in the Favorite apps list.|
|`Shift+Super`|             - Toggle Activities Overview|
|`Ctrl+Shift+Super`|        - Toggle App Grid Overview|
|`Shift+Enter`|             - Switch keyboard layout|

### Type to Search
- If the `Search mode` is activated (by the `E` or `Insert` hotkeys or as the default mode in the preferences window), the `A-Z` and `0-9` keys can be used to enter the search pattern. The switcher window/app list is immediately filtered/repopulated accordingly.
- When you activate the Search mode using the hotkey, you can release the modifier keys used to activate the switcher (Alt, Super) and the switcher stays open. If the Search mode is active as default, release of the modifier key activates the selected result as usual. If you activate the switcher using Super key, you have 5 seconds to start typing, or you can pres and release the `Ctrl` key to cancel the timeout.
- Characters with diacritics are converted to its basic form and case doesn't matter.
- You can also enter more patterns separated by a space in arbitrary order, so if you enter 'fox ext', a window with 'Extensions - Firefox' in the title will also be found. If you enter a character that would filter out all items (no match), this character will be removed and the selection will stays unchanged waiting for another character.
- AATWS is searching in the window title, app name, app generic name (which usually contains information what type of application it is), description, keywords (not localized), categories (not localized) and name of the app executable file. Properties for apps comes from their `.desktop` launchers.
- Window search results are based not only on window titles but also on their app names and names of executable, so you can find all default file manager windows by typing `files` or even `nautilus`.
- Option `Search All Windows` for the Window Switcher allows AATWS to search for windows outside the current filter scope if no window was found with the current filter mode.
- YOption `Search Applications` for the Window Switcher allows AATWS to search applications in the Window switcher mode, so you don't have to leave the window switcher to launch a new app (if no window match the entered pattern).
- Search results in the application mode include installed applications and Gnome Settings Sections (they have their own launchers).
- In the App Switcher if no app match the entered pattern, windows are searched automatically.
- Application search results add generic name (if different from name) and description to the name in icon tooltips to help identify unknown apps.
- Option `Max Number of Search Results` for App Switcher limits output of search engine. Default is 12.
- Application search results are weighted by the following criteria (in this order): position in the list of frequently used applications, app name starts with the pattern, any word in the item name/description/category/executable starts with the pattern. This means that you can very quickly and consistently find apps if you know their names, mostly using just one letter.
- Window search results are weighted by the following criteria (in this order): app name starts with the pattern, any word in the window title/app name/executable starts with the pattern.

**Even in the search mode you can use all hotkeys if you press and hold the Shift modifier key**.

### DND Window Thumbnails
Window thumbnails are scaled-down window clones that can be used to monitor windows not currently visible on the screen. By pressing the `T` hotkey (which you can change) you can create a thumbnail of the selected window which will be placed at bottom right of the current monitor. You can create as many clones as you want and place them anywhere on the screen. Each thumbnail can be independently resized, you can adjust its opacity and even change its source window. When the thumbnail's source window is closed, its thumbnail will be removed too.
You can remove the lastly created thumbnail using `Ctrl + T` or remove all thumbnails using `Ctrl + Shift + T`.

    Double click          - activates source window
    Primary cLick         - toggles scroll wheel function (resize / source)
    Scroll wheel          - resizes or switches a source window
    Ctrl + Scroll wheel   - switches source window or resizes
    Secondary click       - shows full-size window preview and toggles Show preview on hover functionality - hover shows preview / leave hides the preview
    Shift + Scroll wheel  - changes thumbnail opacity

    NO LONGER AVAILABLE: Secondary click       - removes the thumbnail
    NO LONGER AVAILABLE: Middle click          - closes the source window
    NO LONGER AVAILABLE: Ctrl + Primary button - toggles window preview to app icon

Known bugs: when the thumbnail is created above VirtualBox virtual machine window, the thumbnail becomes irresponsive.

## Changelog
[CHANGELOG.md](CHANGELOG.md)

## Installation
You can install this extension in several ways.

### Installation from extensions.gnome.org
The easiest way to install AATWS: go to [extensions.gnome.org](https://extensions.gnome.org/extension/4412/advanced-alttab-window-switcher/) and toggle the switch. This installation also gives you automatic updates in the future.

### Installation from the latest Github release
Download the latest release archive using following command:

    wget https://github.com/G-dH/advanced-alttab-window-switcher/releases/latest/download/advanced-alt-tab@G-dH.github.com.zip

Install the extension (`--force` switch needs to be used only if some version of the extension is already installed):

    gnome-extensions install --force advanced-alttab-window-switcher@G-dH.github.com.zip

### Installation of the latest development version
The most recent version in the repository is the one I'm currently running on my own systems, problems may occur, but usually nothing serious.
Run following commands in the terminal (`git` needs to installed, navigate to the directory you want to download the source):

    git clone https://github.com/G-dH/advanced-alttab-window-switcher.git
    cd advanced-alttab-window-switcher/
    make install

## Enable installed extension
After installation you need to enable the extension. Only direct installation from extension.gnome.org loads the code and enables the extension immediately.

- First restart GNOME Shell (`ALt` + `F2`, `r`, `Enter`, or Log Out/Log In if you use Wayland)
- Now you should see the new extension in *Extensions* (or *GNOME Tweak Tool* on older systems) application (reopen the app if needed to load new data), where you can enable it and access its Preferences/Settings.
- You can also enable the extension from the command line:

    gnome-extensions enable advanced-alt-tab@G-dH.github.com

## Contribution
Contributions are welcome and I will try my best to answer quickly to all suggestions.

## Buy Me a Coffee
If you like my work and want to keep me motivated, give me some feedback. You can also [buy me a coffee](https://buymeacoffee.com/georgdh).

# Advanced Alt+Tab Window Switcher
Extension for Gnome Shell desktop environment, a replacement for default Window Switcher Popup

Advanced Alt+Tab Window Switcher offers effective window navigation that includes switching workspaces, type to search and wide palette of window control hotkeys.

## Features:

- Optional default filter settings : *All windows / Current workspace / Current monitor*, plus *Skip minimized* option.
- Optional default order settings: *Deafault Most Recently Used / Current workspace first / Group applications / Workspaces*.
- All filter and most of order modes can be switched on the fly by hotkeys while switcher popup is up.
- Switch workspaces using a keyboard or a mouse scroll wheel outside the switcher popup.
- Type to Search mode - you can activate it by a hotkey or you can set in preferences to start the switcher directly in this mode, so you can type immediately as the popup shows up.
- Sort and iterate through window list by applications instead of windows by hotkey
- Customizable window preview and app icon sizes. The larger one is used as the base and the smaller as the front icon.
- `Always on Top` property of selected window can be controled from the switcher and is indicated by the TOP position of the icon (or the preview if smaller) instead of default BOTTOM.
- Pin icon indicates whether the window is set as `Always on Visible Workspace` and you can control it from the switcher.
- Optional workspace index on each window item.
- Direct window activation via `Fn` keys with optional `Fn` key indicator on each window in the list.
- Optionaly windows can be brought to the front immediatey as they are selected, otherwise you can press dedicated hotkey to do it.
- Make live window previews as a thumbnails that you can place anywhere on the screen and is always on top. This thumbnail can be controlled and can control the source window as described below.


### Hotkeys

    H/L, Left/Right         - window selection
    J/K, Up/Down, PgUp/Down - workspace selection
    Home/End                - first / last window
    Space, KP_0/KP_Ins      - show selected window - switch to window workspace and bring it to the front
    Q                       - switch window filter mode - ALL / WS / MONITOR
    ;/~                     - sort windows by applications, each subsequent key press jumps to the first window of the next app
    G                       - toggle sort by workspaces, when base filter is set to ALL
    1/+/X                   - filter out all windows that don't belong to the application of selected window
    E/Insert                - Activate the Search mode, the `Insert` key can turn it off.
    W                       - close selected window
    Shift+Del               - force close - kill -9 to application of selected window
    C                       - close all windows from window list that belongs to the same application as selected window
    A                       - toggle window Always on Top. Also switch to window workspace and rise the window. Indicated by front icon on top instead of bottom.
    S                       - toggle window Always on Visible Workspace, indicated by pin icon
    X/click outside switcher- move selected window to the current workspace and to the monitor with mouse pointer
    N                       - create New Window of selected application, if the app soupports it
    V                       - Move window to selected workspace and maximize it
    F                       - Move window to empty workspace next to its current workspace and switch it to fullscreen mode. Next use of this action on the same window moves the window back to its original workspace and turn off the fullscreen mode.
    O                       - Show application grid, if you need to lunch new application
    T                       - Creates drag and drop thumbnail preview of selected window and place it to the bottom right of the current monitor. You can have more than one thumbnail
    P                       - Open preferences window for this extension

### Type to Search

When `Search mode` is activated (by `E` or `Insert` keys or as default mode in preferences window), the keyboard keys `A-Z` and `0-9` can be used to type a pattern which will be searched for in the window title and application name, window list will be filtered accordingly. Characters with diacritics in the title and app name will be converted to the basic form and case doesn't matter. You can type in two patterns in arbitrary order separated by a space, so if you enter 'fox ext' window with 'Extensions - Firefox' in the title will be found too. If you type in a character that would filter out all windows, this character will be removed and the selection will stay unchanged waiting for another key.

**Even in search mode you can still use all hotkeys if you press and hold Shift key**.

### DND Window Thumbnails

Window thumbnails are scaled-down window clones that can be used to monitor windows not currently visible on the screen. By pressing `T` hotkey you can create thumbnail of the selected window and place it at bottom right of the monitor with mouse pointer. You can create as many clones as you want and place them anywhere on the screen. Each thumbnail can be independently resized, you can adjust its opacity, even change its source window. When the thumbnail's source window close, thumbnail will be removed.

    Double click          - activate source window
    Primary cLick         - toggle scroll wheel function (resize / source)
    Scroll wheel          - resize or switch source window
    Ctrl + Scroll wheel   - switch source window or resize
    Secondary click       - remove thumbnail
    Middle click          - close source window
    Shift + Scroll wheel  - change thumbnail opacity
 
![Window Switcher Popup](screenshot.png)
![Extension configuration window](screenshot1.png)
 
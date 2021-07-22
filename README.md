# Advanced AltTab Window Switcher
Extension for Gnome Shell desktop environment, a replacement for default Window Switcher Popup

Advanced AltTab Window Switcher offers better window navigation that includes switching workspaces and wider palette of window control shortcuts.
## Features:

- Optional default filter settings : *all windows / current workspace / current monitor*, plus *skip minimized* option
- Optional default order settings: *Deafault Most Recently Used / Current workspace first / Group applications / Workspaces*
- All filter and order modes can be switched on the fly by keyboard shortcuts while switcher popup is up
- Type to Search - you can activate by the E/Ins key or you can set in preferences to start the switcher directly in this mode, so you can type right away
- Customizable window preview and app icon sizes. The bigger one is used as a base and the smaller as an front icon.
- Front element position indicates whether the window is set as `Always on Top`
- Pin icon indicates whether the window is set as `Always on Visible Workspace`
- Optional workspace index on each window item
- Direct window activation via `F` keys with optional `F` key indicator on each window item
- Switching workspaces
- Can create live window preview as a thumbnail which you can place anywhere on the screen and is always on top

### Keyboard shortcuts

    H/L, Left/Right         - window selection
    J/K, Up/Down, PgUp/Down - workspace selection
    Home/End                - first / last window
    Space, KP_0/KP_Ins      - show selected window - switch to window workspace and bring it to the front
    W                       - close selected window
    Shift+Del               - force close - kill -9 to application of selected window
    C                       - close all windows from list that belongs to the same application as selected window
    A                       - toggle window Always on Top. Also switch to window workspace and rise the window. Indicated by front icon on top instead of bottom.
    S                       - toggle window Always on Visible Workspace, indicated by pin icon
    Q                       - switch window filter mode - All / WS / Monitor
    ;/~                     - sort windows by applications, each subsequent key press jumps to the first window of the next app
    O                       - toggle sort by workspaces, when base filter is set to All
    1/+/X                   - filter out all windows that don't belong to the application of selected window
    M                       - move selected window to the current workspace and to the monitor with mouse pointer
    N                       - create New Window of selected application, if the app soupports it
    V                       - Move window to selected workspace and maximize it
    F                       - Move window to empty workspace next to its current workspace and switch it to fullscreen mode. Next use of this action on the same window moves the window back to its original workspace and turn off the fullscreen mode.
    E/Ins                   - Switch to the Search mode, the `Insert` key can turn it off.
    T                       - Creates drag and drop thumbnail preview of selected window and place it to the bottom right of the current monitor

### Type to Search

When a `Search mode` is activated (by `E` or `Insert` keys), keys `A-Z` and `0-9` can be used to type a pattern which will be searched for in the window title and app name. Window list will be filtered acordingly. Diacritics and case don't matter. You can type in two patterns in arbitrary order and separated by a space, so if you enter 'fire ext' window with 'Extensions - Firefox' in the title will be found too.

### DND Window Thumbnails

    Double click          - activate source window
    Primary cLick         - toggle scroll wheel function (resize / source)
    Scroll wheel          - resize or switch source window
    Ctrl + Scroll wheel   - switch source window or resize
    Secondary click       - remove thumbnail
    Middle click          - close source window
    Shift + Scroll wheel  - change thumbnail opacity
 
 
 
 

/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * Enum
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2024
 * @license    GPL-3.0
 */

'use strict';

export const Actions = {
    NONE:              0,
    SELECT_ITEM:       1,
    ACTIVATE:          2,
    SINGLE_APP:        3,
    SWITCH_FILTER:     4,
    SWITCHER_MODE:     5,
    SWITCH_WS:         6,
    GROUP_APP:         7,
    CURRENT_MON_FIRST: 8,
    MENU:              9,
    SHOW:             10,
    MOVE_TO_WS:       11,
    THUMBNAIL:        12,
    HIDE:             13,
    CLOSE_QUIT:       14,
    CLOSE_ALL_APP:    15, // close all windows of selected application
    KILL:             16,
    NEW_WINDOW:       17,
    ALLWAYS_ON_TOP:   18,
    STICKY:           19, // always on visible ws
    MOVE_MAX:         20, // move window to the current ws and maximize it
    FS_ON_NEW_WS:     21, // fullscreen window on new ws next to the current one
    REORDER_WS:       22,
    MINIMIZE:         23,

    PREFS:            99,
};

export const SwitcherMode = {
    WINDOWS: 0,
    APPS:    1,
};

export const FilterMode = {
    ALL:       1,
    WORKSPACE: 2,
    MONITOR:   3,
};

export const Position = {
    TOP: 1,
    CENTER: 2,
    BOTTOM: 3,
};

export const SortingMode = {
    MRU: 1,
    STABLE_SEQUENCE: 2,
    STABLE_CURRENT_FIRST: 3,
};

export const GroupMode = {
    NONE: 1,
    CURRENT_MON_FIRST: 2,
    APPS: 3,
    WORKSPACES: 4,
};

export const SelectMode = {
    NONE: -1,
    FIRST: 0,
    SECOND: 1,
    ACTIVE: 2,
};

export const PreviewMode = {
    DISABLE: 1,
    PREVIEW: 2,
    // SHOW_WIN: 3,
};

export const UpDownAction = {
    DISABLE: 1,
    SWITCH_WS: 2,
    SINGLE_APP: 3,
    SINGLE_AND_SWITCHER: 4,
};

export const DoubleSuperAction = {
    DEFAULT: 1,
    SWITCHER_MODE: 2,
    OVERVIEW: 3,
    APP_GRID: 4,
    PREV_WIN: 5,
};

export const TooltipTitle = {
    DISABLE: 1,
    ITEM: 2,
    CENTER: 3,
};
export const ListOnActivate = {
    DISABLE: 0,
    FOCUSED: 1,
    FOCUSED_MULTI_WINDOW: 2,
};

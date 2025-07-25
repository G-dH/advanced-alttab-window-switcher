/**
 * AATWS - Advanced Alt-Tab Window Switcher
 * ListProvider
 *
 * @author     GdH <G-dH@github.com>
 * @copyright  2021-2025
 * @license    GPL-3.0
 */

'use strict';

import Shell from 'gi://Shell';

import * as SystemActions from 'resource:///org/gnome/shell/misc/systemActions.js';

import * as Enum from './enum.js';
import * as Util from './util.js';

export class ListProvider {
    constructor(wsp, opt) {
        this._wsp = wsp;
        this._opt = opt;
    }

    _updateCoreParams(searchQuery) {
        this._showApps = this._wsp._showApps;
        this._singleApp = this._wsp._singleApp;
        // this._firstRun = this._wsp._firstRun;
        this._dashMode = this._wsp._dashMode;
        this._keyboardTriggered = this._wsp._keyboardTriggered;
        this._allowFilterSwitchOnOnlyItem = this._wsp._allowFilterSwitchOnOnlyItem;

        if (!this._currentFilterMode) {
            this._currentFilterMode = this._showApps
                ? this._wsp._appFilterMode
                : this._wsp._winFilterMode;
        }

        this._insufficientResultsLimit = !searchQuery && this._keyboardTriggered && this._allowFilterSwitchOnOnlyItem ? 1 : 0;
        this._filterSwitchAllowed = !searchQuery || (this._opt.SEARCH_ALL && !!searchQuery);
        this._workspace = this._currentFilterMode > Enum.FilterMode.ALL
            ? global.workspace_manager.get_active_workspace()
            : null;
        this._monitorIndex = this._currentFilterMode === Enum.FilterMode.MONITOR
            ? this._wsp._monitorIndex
            : null;

        this._filterWorkspace = this._workspace !== null;
        this._filterMonitor = this._monitorIndex !== null && this._monitorIndex > -1;
    }

    getItemList(searchQuery) {
        if (!searchQuery)
            searchQuery = '';
        searchQuery = searchQuery.trim();
        this._updateCoreParams(searchQuery);
        let itemList;

        if (this._showApps)
            itemList = this.getAppList(searchQuery);
        else
            itemList = this.getCustomWindowList(searchQuery);

        // if no window matches the filter or search searchQuery, try to switch to a less restricted filter if possible and allowed
        // same for only 1 window, since it makes sense
        // even if the switcher is in app mode, try to search windows if no app matches the search searchQuery

        let mode = this._currentFilterMode;
        const onlyApp = itemList.length <= 1 && this._showApps && !searchQuery;

        if (itemList.length <= this._insufficientResultsLimit && this._filterSwitchAllowed) {
            for (mode; mode > 0; mode--) {
                this._currentFilterMode = mode;

                if (onlyApp)
                    itemList = this.getAppList(searchQuery);
                else
                    itemList = this.getCustomWindowList(searchQuery);

                if (itemList.length > this._insufficientResultsLimit) {
                    // if on empty WS/monitor ...
                    if (!searchQuery) {
                        // set filter mode to ALL to avoid switching it back if user creates/moves any window to this empty ws
                        if (onlyApp)
                            this._wsp._appFilterMode = this._currentFilterMode;
                        else
                            this._wsp._winFilterMode = this._currentFilterMode;
                    }
                    this._wsp._filterSwitched = true;
                    break;
                }
            }
        }

        // if no windows/apps match the searchQuery and searching apps is allowed, try to find some apps instead
        if (itemList.length === 0 && this._opt.SEARCH_APPS === true && searchQuery) {
            itemList = this.getAppList(searchQuery);
            this._wsp._initialSelectionMode = Enum.SelectMode.FIRST;
        }

        // if no windows at all, show dash content to launch new app
        if ((this._opt.SHOW_IF_NO_WIN || this._wsp._dashMode) && itemList.length === 0 && !Util.getWindows(null).length && !searchQuery) {
            this._wsp._switcherMode = Enum.SwitcherMode.APPS;
            this._wsp._includeFavorites = true;
            this._wsp._showApps = true;
            this._wsp._initialSelectionMode = Enum.SelectMode.FIRST;
            this._wsp._filterSwitched = false; // avoid coloring the popup border that indicates filter mode

            return this.getAppList();
        }

        return itemList;
    }

    _updateForWinList() {
        this._tracker = this._tracker ?? Shell.WindowTracker.get_default();
        this._groupMode = this._wsp._groupMode;
        this._singleApp = this._wsp._singleApp;
        this._stableSequenceCurrentFirst = this._opt.WIN_SORTING_MODE === Enum.SortingMode.STABLE_CURRENT_FIRST;
        this._stableSequence = this._opt.WIN_SORTING_MODE === Enum.SortingMode.STABLE_SEQUENCE || this._stableSequenceCurrentFirst;
        this._groupWorkspaces = this._wsp._groupMode === Enum.GroupMode.WORKSPACES && this._currentFilterMode === Enum.FilterMode.ALL;
        this._currentMonitorFirst = this._wsp._groupMode === Enum.GroupMode.CURRENT_MON_FIRST && this._currentFilterMode < Enum.FilterMode.MONITOR;
        this._groupByApps = this._wsp._groupMode === Enum.GroupMode.APPS;
    }

    getCustomWindowList(searchQuery = '', allWindows = false) {
        this._updateCoreParams();
        this._updateForWinList();

        const workspace = null;
        let winList = Util.getWindows(workspace, this._opt.INCLUDE_MODALS);

        this._currentWin = winList[0];

        // after the shell restarts (X11) AltTab.getWindows(ws) generates different (wrong) win order than ...getwindows(null) (tested on GS 3.36 - 41)
        // so we will filter the list here if needed, to get consistent results in this situation for all FilterModes
        if (!allWindows && this._filterWorkspace) {
            winList = winList.filter(w => w.get_workspace() === this._workspace);
            if (this._filterMonitor)
                winList = winList.filter(w => w.get_monitor() === this._monitorIndex);
        }

        if (searchQuery)
            winList = this._filterWinList(winList, searchQuery);
        else
            winList = this._sortWinList(winList);

        if (this._singleApp) {
            const { id, name } = this._singleApp;

            // some apps (like VirtualBox) may create multiple windows with different app ids, but with the same name
            winList = winList.filter(w => this._tracker.get_window_app(w).get_id() === id || this._tracker.get_window_app(w).get_name() === name);
        }

        return winList;
    }

    _filterWinList(winList, searchQuery) {
        winList = winList.filter(w => {
            // search in window title and app name/exec
            const appInfo = Shell.WindowTracker.get_default().get_window_app(w).appInfo;

            const title = w.title;
            const appName = appInfo?.get_name() || '';
            const appGeneric = appInfo?.get_generic_name() || '';
            const appExec = appInfo?.get_executable() || '';

            const text = `${title} ${appName} ${appGeneric} ${appExec}`;

            // Store appName to the metaWindow
            w._appName = appName;

            return this._match(text, searchQuery);
        });

        if (winList.length > 0 /* && this._wsp._searchQuery*/) {
            winList.sort((a, b) => this._isMoreRelevant(a._appName || '', b._appName || '', searchQuery));
            winList.sort((a, b) => this._isMoreRelevant(a.get_title(), b.get_title(), searchQuery));
        }

        return winList;
    }

    _sortWinList(winList) {
        if (this._opt.SKIP_MINIMIZED) {
            winList = winList.filter(w => !w.minimized);
        } else if (!this._opt.MINIMIZED_LAST && !this._stableSequence) {
            // wm returns tablist with the minimized windows at the end of the list, we want to move them back to their real MRU position
            // but avoid sorting all windows because parents of the modal windows could already be moved to their children position.
            winList = winList.sort((a, b) => (b.get_user_time() > a.get_user_time()) && b.minimized);
        }

        if (this._stableSequence) {
            winList.sort((a, b) => a.get_stable_sequence() - b.get_stable_sequence());

            if (this._stableSequenceCurrentFirst) {
                const currentSq = this._currentWin.get_stable_sequence();
                winList.sort((a, b, cs = currentSq) => (b.get_stable_sequence() > cs) && (a.get_stable_sequence() <= cs)
                    ? 0 : 1
                );
            }
        }

        if (this._groupWorkspaces) {
            winList.sort((a, b) => b.get_workspace().index() < a.get_workspace().index());
        } else if (this._currentMonitorFirst) {
            // windows from the active workspace and monitor first
            winList.sort((a, b) => (b.get_workspace().index() === this._workspace.index() && b.get_monitor() === this._monitorIndex) &&
                (a.get_workspace().index() !== this._workspace.index() || a.get_monitor() !== this._monitorIndex));
        } else if (this._groupByApps) {
            // let apps = _getAppList(winList);
            let apps = this._getRunningAppsIds();
            winList.sort((a, b) => apps.indexOf(this._getWindowApp(b).get_id()) < apps.indexOf(this._getWindowApp(a).get_id()));
        }

        return winList;
    }

    _updateForAppList() {
        this._stableSequence = this._opt.APP_SORTING_MODE === Enum.SortingMode.STABLE_SEQUENCE || (this._dashMode && this._opt.DASH_APP_STABLE_SEQUENCE);
        this._sortByFavorites = (this._dashMode && this._opt.DASH_APP_STABLE_SEQUENCE) || (!this._dashMode && (!this._wsp._favoritesMRU || this._opt.APP_SORTING_MODE !== Enum.SortingMode.MRU));
        this._wsp._favoritesMRU = !this._sortByFavorites;
        this._includeFavorites = this._wsp._includeFavorites;
        this._runningIds = this._getRunningAppsIds(
            true, // true for stable sequence order
            this._workspace,
            this._monitorIndex
        );
    }

    getAppList(searchQuery = '') {
        this._updateCoreParams();
        this._updateForAppList();

        const running = this._getRunningApps();
        const favorites = this._getFavoriteApps();

        if (!searchQuery) {
            if (this._stableSequence)
                running.sort((a, b) => this._runningIds.indexOf(a.get_id()) - this._runningIds.indexOf(b.get_id()));

            let appList = [...running, ...favorites];
            appList = this._sortAppListByFavorites(appList);

            return this._setCachedWindows(appList);
        } else {
            let appList = this._getInstalledApps(searchQuery);
            appList = this._sortAppSearchResults(appList, searchQuery);
            appList = appList.concat(this._getSystemActions(searchQuery));
            // limit the app list size
            appList.splice(this._opt.APP_SEARCH_LIMIT);

            return this._setCachedWindowsForSearch(appList);
        }
    }

    _getRunningApps() {
        let running = Shell.AppSystem.get_default().get_running(); // AppSystem returns list in MRU order
        return running.filter(app => this._runningIds.includes(app.get_id()));
    }

    _getFavoriteApps() {
        if (!this._includeFavorites)
            return [];

        const favoritesFull = global.settings.get_strv('favorite-apps');
        this._favoritesFull = favoritesFull;
        let favorites = favoritesFull.filter(fav => !this._runningIds.includes(fav));
        return favorites.map(fav => Shell.AppSystem.get_default().lookup_app(fav)).filter(app => app);
    }

    _getInstalledApps(searchQuery) {
        let appInfoList = Shell.AppSystem.get_default().get_installed();
        return appInfoList.filter(appInfo => {
            try {
                appInfo.get_id(); // catch invalid file encodings
            } catch {
                return false;
            }

            let exec = appInfo.get_commandline();

            // show only launchers that should be visible in this DE and invisible launchers of Gnome Settings items
            const shouldShow = appInfo.should_show() || exec?.includes('gnome-control-center');
            if (!shouldShow)
                return false;

            let string = '';
            if (appInfo.get_display_name) {
                let dispName = appInfo.get_display_name() || '';
                let gName = appInfo.get_generic_name() || '';
                exec = exec || '';
                let description = appInfo.get_description() || '';
                let categories = appInfo.get_string('Categories') || '';
                let keywords = appInfo.get_string('Keywords') || '';
                string = `${dispName} ${gName} ${exec} ${description} ${categories} ${keywords}`;
            }
            return this._match(string, searchQuery);
        }).map(appInfo => this._convertAppInfoToShellApp(appInfo));
    }

    _sortAppSearchResults(appList, searchQuery) {
        const usage = Shell.AppUsage.get_default();
        // exclude running apps from the search result
        // appList = appList.filter(a => running.indexOf(a.get_id()) === -1);
        // sort apps by usage list
        appList.sort((a, b) => usage.compare(a.get_id(), b.get_id()));
        // prefer apps where any word in their name starts with the searchQuery
        appList.sort((a, b) => this._isMoreRelevant(a.app_info.get_display_name(), b.app_info.get_display_name(), searchQuery));
        // prefer currently running apps
        if (this._opt.SEARCH_PREF_RUNNING)
            appList.sort((a, b) => b.get_n_windows() > 0 && a.get_n_windows() === 0);
        return appList;
    }

    _sortAppListByFavorites(appList) {
        if (this._includeFavorites && this._sortByFavorites) {
            appList = appList.sort((a, b) => {
                a = this._favoritesFull.indexOf(a.get_id());
                b = this._favoritesFull.indexOf(b.get_id());
                return b > -1 && (b < a || a === -1);
            });
        }

        return appList;
    }

    _getSystemActions(searchQuery) {
        const sysActions = SystemActions.getDefault();
        let actionList = Array.from(sysActions._actions.keys()); // getMatchingActions(searchQuery.split(/ +/));
        return actionList.filter(action => this._match(`qq ${action} ${sysActions._actions.get(action).keywords.join(' ')}`, searchQuery));
    }

    _setCachedWindows(appList) {
        return appList.filter(app => {
            if (app.get_n_windows())
                app.cachedWindows = this._filterWindowsForWsMonitor(app.get_windows());
            else
                app.cachedWindows = [];

            // Filter out non-favorite apps without windows
            return app.cachedWindows.length > 0 || this._favoritesFull.includes(app.get_id());
        });
    }

    _setCachedWindowsForSearch(appList) {
        appList.forEach(app => {
            if (app.get_n_windows && app.get_n_windows())
                app.cachedWindows = this._filterWindowsForWsMonitor(app.get_windows());
            else if (app.get_n_windows)
                app.cachedWindows = [];
        });

        return appList;
    }

    _filterWindowsForWsMonitor(windows) {
        if (this._filterWorkspace)
            windows = windows.filter(w => w.get_workspace() === this._workspace);

        if (this._filterMonitor)
            windows = windows.filter(w => w.get_monitor() === this._monitorIndex);

        return windows.filter(w => !w.skip_taskbar || (this._opt.INCLUDE_MODALS && w.is_attached_dialog()));
    }

    _getRunningAppsIds(stableSequence = false, workspace = null, monitor = null) {
        let running = [];
        if (stableSequence) {
            let winList = Util.getWindows(workspace);
            // We need to get stable order, the functions above return MRU order
            if (monitor !== null)
                winList = winList.filter(win => win.get_monitor() === monitor);
            winList.sort((a, b) => a.get_stable_sequence() - b.get_stable_sequence());
            winList.forEach(w => {
                let app = this._getWindowApp(w);
                let id = app.get_id();
                if (running.indexOf(id) < 0)
                    running.push(id);
            });
        } else {
            Shell.AppSystem.get_default().get_running().forEach(a => running.push(a.get_id()));
        }
        return running;
    }

    _getWindowApp(metaWindow) {
        let tracker = Shell.WindowTracker.get_default();
        return tracker.get_window_app(metaWindow);
    }

    _convertAppInfoToShellApp(appInfo) {
        return Shell.AppSystem.get_default().lookup_app(appInfo.get_id());
    }

    _match(string, searchQuery) {
        // remove diacritics and accents from letters
        let s = string.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
        let p = searchQuery.toLowerCase();
        let ps = p.split(/ +/);

        // allows to use multiple exact searchQuerys separated by space in arbitrary order
        for (let w of ps) {
            if (!s.includes(w))
                return false;
        }
        return true;
    }

    _isMoreRelevant(stringA, stringB, searchQuery) {
        let regex = /[^a-zA-Z\d]/;
        let strSplitA = stringA.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(regex);
        let strSplitB = stringB.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(regex);
        let aAny = false;
        strSplitA.forEach(w => {
            aAny = aAny || w.startsWith(searchQuery);
        });
        let bAny = false;
        strSplitB.forEach(w => {
            bAny = bAny || w.startsWith(searchQuery);
        });

        // if both strings contain a word that starts with the searchQuery
        // prefer the one whose first word starts with the searchQuery
        if (aAny && bAny)
            return !strSplitA[0].startsWith(searchQuery) && strSplitB[0].startsWith(searchQuery);
        else
            return !aAny && bAny;
    }
}

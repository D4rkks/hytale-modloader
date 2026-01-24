const { contextBridge, ipcRenderer } = require('electron');

console.log('[Preload] Initializing electronAPI...');

contextBridge.exposeInMainWorld('electronAPI', {
    isFirstLaunch: () => ipcRenderer.invoke('is-first-launch'),
    markAsLaunched: () => ipcRenderer.invoke('mark-as-launched'),

    getAccounts: () => ipcRenderer.invoke('get-accounts'),
    getActiveAccount: () => ipcRenderer.invoke('get-active-account'),
    setActiveAccount: (accountId: string) => ipcRenderer.invoke('set-active-account', accountId),
    removeAccount: (accountId: string) => ipcRenderer.invoke('remove-account', accountId),
    startHytaleOAuth: () => ipcRenderer.invoke('start-hytale-oauth'),
    pollOAuthToken: () => ipcRenderer.invoke('poll-oauth-token'),
    cancelOAuth: () => ipcRenderer.invoke('cancel-oauth'),
    refreshAccountToken: (accountId: string) => ipcRenderer.invoke('refresh-account-token', accountId),

    initiateHytaleLogin: () => ipcRenderer.invoke('initiate-hytale-login'),
    confirmHytaleAccount: (username: string) => ipcRenderer.invoke('confirm-hytale-account', username),

    addOfflineAccount: (username: string) => ipcRenderer.invoke('add-offline-account', username),

    launchGame: (instanceId?: string) => ipcRenderer.invoke('launch-game', instanceId),
    isGameInstalled: () => ipcRenderer.invoke('is-game-installed'),
    getGameDir: () => ipcRenderer.invoke('get-game-dir'),
    getLatestVersion: () => ipcRenderer.invoke('get-latest-version'),
    getInstalledVersion: () => ipcRenderer.invoke('get-installed-version'),
    setGamePath: (path: string) => ipcRenderer.invoke('set-game-path', path),
    selectGameFolder: () => ipcRenderer.invoke('select-game-folder'),
    onLaunchProgress: (callback: (event: any, msg: string, percent: number) => void) => ipcRenderer.on('launch-progress', callback),

    getInstances: () => ipcRenderer.invoke('get-instances'),
    createInstance: (name: string, version: string, options?: any) => ipcRenderer.invoke('create-instance', name, version, options),
    updateInstance: (id: string, updates: any) => ipcRenderer.invoke('update-instance', id, updates),
    deleteInstance: (id: string) => ipcRenderer.invoke('delete-instance', id),
    openInstanceFolder: (id: string) => ipcRenderer.invoke('open-instance-folder', id),
    createComplexInstance: (payload: any) => ipcRenderer.invoke('create-complex-instance', payload),
    copyInstanceMods: (sourceId: string, targetId: string, modFiles: string[]) => ipcRenderer.invoke('copy-instance-mods', sourceId, targetId, modFiles),
    getInstanceWorlds: (instanceId: string) => ipcRenderer.invoke('get-instance-worlds', instanceId),
    deleteInstanceWorld: (instanceId: string, worldName: string) => ipcRenderer.invoke('delete-instance-world', instanceId, worldName),
    openWorldFolder: (instanceId: string, worldName: string) => ipcRenderer.invoke('open-world-folder', instanceId, worldName),

    getSessionTokens: () => ipcRenderer.invoke('get-session-tokens'),

    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),

    minimizeWindow: () => ipcRenderer.send('minimize-window'),
    closeWindow: () => ipcRenderer.send('close-window'),
    resizeWindow: (width: number, height: number) => ipcRenderer.send('resize-window', width, height),

    getHytaleNews: () => ipcRenderer.invoke('get-hytale-news'),

    searchMods: (source: string, query: string, filters?: any) => ipcRenderer.invoke('search-mods', source, query, filters),
    installMod: (instanceId: string, mod: any) => ipcRenderer.invoke('install-mod', instanceId, mod),
    cancelModWatch: () => ipcRenderer.invoke('cancel-mod-watch'),
    onModInstalled: (callback: (event: any, data: any) => void) => ipcRenderer.on('mod-installed', callback),
    removeModInstalledListener: () => ipcRenderer.removeAllListeners('mod-installed'),

    getInstalledMods: () => ipcRenderer.invoke('get-installed-mods'),
    markModInstalled: (mod: { id: string; name: string; source: string }, instanceId: string) =>
        ipcRenderer.invoke('mark-mod-installed', mod, instanceId),
    unmarkModInstalled: (modId: string, instanceId: string) =>
        ipcRenderer.invoke('unmark-mod-installed', modId, instanceId),

    getInstanceMods: (instanceId: string) => ipcRenderer.invoke('get-instance-mods', instanceId),
    removeInstanceMod: (instanceId: string, fileName: string, modId?: string) =>
        ipcRenderer.invoke('remove-instance-mod', instanceId, fileName, modId),
    batchInstallMods: (instanceId: string, mods: any[]) =>
        ipcRenderer.invoke('batch-install-mods', instanceId, mods),

    getInstanceServerConfig: (instanceId: string) => ipcRenderer.invoke('get-instance-server-config', instanceId),
    updateInstanceServerConfig: (instanceId: string, updates: any) => ipcRenderer.invoke('update-instance-server-config', instanceId, updates),
    invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),

    secureSet: (key: string, value: string) => ipcRenderer.invoke('secure-set', key, value),
    secureGet: (key: string) => ipcRenderer.invoke('secure-get', key),

    onAppClosing: (callback: () => void) => {
        ipcRenderer.on('app-closing', () => {
            console.log('[Preload] App closing signal received');
            callback();
        });
    },

    login: (credentials: { username: string; password: string }) => ipcRenderer.invoke('login', credentials),
});

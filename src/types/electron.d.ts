export interface IElectronAPI {
    login: (token: string) => Promise<void>;
    getAccounts: () => Promise<any[]>;
    startHytaleOAuth: () => Promise<{ success: boolean; account?: any; error?: string }>;
    addOfflineAccount: (username: string) => Promise<{ success: boolean; error?: string }>;
    setActiveAccount: (id: string | null) => Promise<void>;
    markAsLaunched: () => Promise<void>;
    removeAccount: (id: string) => Promise<void>;
    getHytaleNews: () => Promise<any>;
    getLatestVersion: () => Promise<string | null>;
    openExternal: (url: string) => Promise<void>;
    secureSet: (key: string, value: string) => Promise<void>;
    secureGet: (key: string) => Promise<string | null>;
    getActiveAccount: () => Promise<any>;
    getInstances: () => Promise<any[]>;
    launchGame: (instanceId: string) => Promise<{ success: boolean; error?: string }>;
    resizeWindow: (width: number, height: number) => Promise<void>;
    onLaunchProgress: (callback: (event: any, data: any) => void) => () => void;
    createComplexInstance: (payload: any) => Promise<{ success: boolean; instanceId?: string; error?: string }>;
}

declare global {
    interface Window {
        electronAPI: IElectronAPI;
    }
}

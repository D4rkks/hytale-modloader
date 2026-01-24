const fs = require('fs');
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

function getAppDir() {
    const home = os.homedir();
    if (process.platform === 'win32') {
        return path.join(home, 'AppData', 'Local', 'HytaleModloader');
    } else if (process.platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'HytaleModloader');
    } else {
        return path.join(home, '.hytalemodloader');
    }
}

const CONFIG_FILE = path.join(getAppDir(), 'config.json');

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
    } catch (err) {
        console.log('Config load error:', err.message);
    }
    return { accounts: [], activeAccountId: null, hasLaunchedBefore: false };
}

function saveConfig(update) {
    try {
        const configDir = path.dirname(CONFIG_FILE);
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const config = loadConfig();
        const next = { ...config, ...update };
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
    } catch (err) {
        console.log('Config save error:', err.message);
    }
}

function getAccounts() {
    return loadConfig().accounts || [];
}

function addAccount(account) {
    const config = loadConfig();
    const accounts = config.accounts || [];

    if (!account.uuid) {
        account.uuid = uuidv4();
    }
    account.id = uuidv4();
    account.addedAt = new Date().toISOString();

    accounts.push(account);
    saveConfig({ accounts, activeAccountId: account.id });
    return account;
}

function removeAccount(accountId) {
    const config = loadConfig();
    const accounts = (config.accounts || []).filter(a => a.id !== accountId);
    const activeAccountId = config.activeAccountId === accountId ? null : config.activeAccountId;
    saveConfig({ accounts, activeAccountId });
}

function setActiveAccount(accountId) {
    saveConfig({ activeAccountId: accountId });
}

function getActiveAccount() {
    const config = loadConfig();
    if (!config.activeAccountId) return null;
    return (config.accounts || []).find(a => a.id === config.activeAccountId) || null;
}

function isFirstLaunch() {
    const config = loadConfig();
    return !config.hasLaunchedBefore || (config.accounts || []).length === 0;
}

function markAsLaunched() {
    saveConfig({ hasLaunchedBefore: true });
}

module.exports = {
    getAppDir,
    loadConfig,
    saveConfig,
    getAccounts,
    addAccount,
    removeAccount,
    setActiveAccount,
    getActiveAccount,
    isFirstLaunch,
    markAsLaunched,
    CONFIG_FILE
};

"use strict";
const { app, BrowserWindow, ipcMain, shell, dialog, session, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const nodeCrypto = require('crypto');
const { spawn, execFile } = require('child_process');
const https = require('https');
const http = require('http');
const uuidv4 = () => nodeCrypto.randomUUID();
if (require('electron-squirrel-startup')) {
    app.quit();
}
const OAUTH_CONFIG = {
    clientId: 'hytale-launcher',
    authUrl: 'https://oauth.accounts.hytale.com/oauth2/auth',
    tokenUrl: 'https://oauth.accounts.hytale.com/oauth2/token',
    profilesUrl: 'https://account-data.hytale.com/my-account/get-launcher-data',
    sessionUrl: 'https://sessions.hytale.com/game-session/new',
    scopes: 'openid offline auth:launcher',
    redirectUri: 'https://accounts.hytale.com/consent/client'
};
function getAppDir() {
    const home = os.homedir();
    if (process.platform === 'win32') {
        return path.join(home, 'AppData', 'Local', 'HytaleModloader');
    }
    else if (process.platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'HytaleModloader');
    }
    else {
        return path.join(home, '.hytalemodloader');
    }
}
const CONFIG_FILE = path.join(getAppDir(), 'config.json');
const SECURE_STORE_FILE = path.join(getAppDir(), 'secure.json');
function loadSecureStore() {
    try {
        if (!fs.existsSync(SECURE_STORE_FILE))
            return {};
        return JSON.parse(fs.readFileSync(SECURE_STORE_FILE, 'utf8'));
    }
    catch (e) {
        console.error('Failed to load secure store:', e);
        return {};
    }
}
function saveSecureStore(data) {
    try {
        fs.writeFileSync(SECURE_STORE_FILE, JSON.stringify(data, null, 2), 'utf8');
    }
    catch (e) {
        console.error('Failed to save secure store:', e);
    }
}
ipcMain.handle('secure-set', async (event, key, value) => {
    if (!safeStorage.isEncryptionAvailable()) {
        console.error('Encryption not available on this OS/User');
        return false;
    }
    try {
        const store = loadSecureStore();
        const buffer = safeStorage.encryptString(value);
        store[key] = buffer.toString('hex');
        saveSecureStore(store);
        return true;
    }
    catch (e) {
        console.error('Secure set failed:', e);
        return false;
    }
});
ipcMain.handle('secure-get', async (event, key) => {
    if (!safeStorage.isEncryptionAvailable())
        return null;
    try {
        const store = loadSecureStore();
        if (!store[key])
            return null;
        const buffer = Buffer.from(store[key], 'hex');
        const decrypted = safeStorage.decryptString(buffer);
        return decrypted;
    }
    catch (e) {
        console.error('Secure get failed:', e);
        return null;
    }
});
function loadConfig() {
    let config = { accounts: [], activeAccountId: null, hasLaunchedBefore: false };
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const loaded = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            config = { ...config, ...loaded };
        }
    }
    catch (err) {
        console.log('Config load error:', err.message);
    }
    if (!config.gameSettings) {
        config.gameSettings = {
            minMemory: 1024,
            maxMemory: 6144,
            width: 1280,
            height: 720,
            javaArgs: ''
        };
    }
    if (!config.launcherSettings) {
        config.launcherSettings = {
            hardwareAcceleration: true,
            borderless: true,
            textureOptimization: false,
            manaEffects: true
        };
    }
    return config;
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
    }
    catch (err) {
        console.log('Config save error:', err.message);
    }
}
function getAccounts() {
    return loadConfig().accounts || [];
}
function addAccount(account) {
    const config = loadConfig();
    const accounts = config.accounts || [];
    const existingIndex = accounts.findIndex((a) => a.uuid === account.uuid);
    const newAccount = {
        id: account.id || uuidv4(),
        username: account.username || 'Player',
        uuid: account.uuid || uuidv4(),
        type: account.type || 'offline',
        accessToken: account.accessToken,
        refreshToken: account.refreshToken,
        tokenExpiresAt: account.tokenExpiresAt,
        addedAt: new Date().toISOString()
    };
    if (existingIndex >= 0) {
        accounts[existingIndex] = newAccount;
    }
    else {
        accounts.push(newAccount);
    }
    saveConfig({ accounts, activeAccountId: newAccount.id });
    return newAccount;
}
function removeAccount(accountId) {
    const config = loadConfig();
    const accounts = (config.accounts || []).filter((a) => a.id !== accountId);
    const activeAccountId = config.activeAccountId === accountId ? null : config.activeAccountId;
    saveConfig({ accounts, activeAccountId });
}
function setActiveAccount(accountId) {
    saveConfig({ activeAccountId: accountId || null });
}
function getActiveAccount() {
    const config = loadConfig();
    if (!config.activeAccountId)
        return null;
    return (config.accounts || []).find((a) => a.id === config.activeAccountId) || null;
}
function isFirstLaunch() {
    const config = loadConfig();
    return !config.hasLaunchedBefore || (config.accounts || []).length === 0;
}
function markAsLaunched() {
    saveConfig({ hasLaunchedBefore: true });
}
function base64URLEncode(str) {
    return str.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}
function generateCodeVerifier() {
    return base64URLEncode(nodeCrypto.randomBytes(32));
}
function generateCodeChallenge(verifier) {
    return base64URLEncode(nodeCrypto.createHash('sha256').update(verifier).digest());
}
let activePkceServer = null;
async function startPkceFlow() {
    return new Promise(async (resolve) => {
        try {
            console.log('[OAuth] Starting Official PKCE Flow...');
            const codeVerifier = generateCodeVerifier();
            const codeChallenge = generateCodeChallenge(codeVerifier);
            const stateId = uuidv4();
            if (activePkceServer) {
                activePkceServer.close();
            }
            activePkceServer = http.createServer(async (req, res) => {
                const url = new URL(req.url, `http://localhost`);
                console.log(`[OAuth] Received request: ${url.pathname}`);
                if (url.pathname === '/authorization-callback' || url.pathname === '/') {
                    const code = url.searchParams.get('code');
                    const error = url.searchParams.get('error');
                    const state = url.searchParams.get('state');
                    if (error) {
                        res.writeHead(400, { 'Content-Type': 'text/html' });
                        res.end('<h1>Login Failed</h1><p>Error: ' + error + '</p>');
                        activePkceServer.close();
                        resolve({ success: false, error: error });
                        return;
                    }
                    if (code) {
                        const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Orbis Launcher Login</title>
    <style>
        body {
            background-color: #050505;
            color: #e0e0e0;
            font-family: 'Inter', 'Segoe UI', sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
        }
        .card {
            background: #111;
            border: 1px solid #222;
            padding: 32px;
            border-radius: 8px;
            text-align: center;
            max-width: 320px;
            width: 100%;
            animation: fadeIn 0.5s ease-out;
        }
        h1 { margin: 0 0 12px; font-size: 20px; font-weight: 500; color: #fff; letter-spacing: -0.02em; }
        p { margin: 0; color: #666; font-size: 14px; line-height: 1.5; }
        strong { color: #888; font-weight: 500; }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
    </style>
</head>
<body>
    <div class="card">
        <h1>Login Successful</h1>
        <p>You can now close this tab and return to <strong>Orbis Launcher</strong>.</p>
    </div>
    <script>
        setTimeout(() => {
            window.close();
        }, 2500);
    </script>
</body>
</html>`;
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(html);
                        activePkceServer.close();
                        try {
                            const tokens = await exchangeCodeForToken(code, codeVerifier, OAUTH_CONFIG.redirectUri);
                            const profiles = await getLauncherData(tokens.access_token);
                            if (!profiles.profiles || profiles.profiles.length === 0) {
                                resolve({ success: false, error: 'No profiles found' });
                                return;
                            }
                            const profile = profiles.profiles[0];
                            const session = await createGameSession(tokens.access_token, profile.uuid);
                            const account = addAccount({
                                type: 'hytale',
                                username: profile.username,
                                uuid: profile.uuid,
                                accessToken: tokens.access_token,
                                refreshToken: tokens.refresh_token,
                                tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString()
                            });
                            resolve({
                                success: true,
                                account: {
                                    id: account.id,
                                    username: account.username,
                                    uuid: account.uuid,
                                    type: account.type,
                                    sessionToken: session.sessionToken,
                                    identityToken: session.identityToken
                                }
                            });
                        }
                        catch (err) {
                            resolve({ success: false, error: err.message });
                        }
                    }
                    else {
                        res.writeHead(400);
                        res.end('No code provided');
                    }
                }
                else {
                    res.writeHead(404);
                    res.end('Not found');
                }
            });
            activePkceServer.listen(0, '127.0.0.1', () => {
                const address = activePkceServer.address();
                const port = address.port;
                console.log(`[OAuth] Listening on port ${port}`);
                const stateJson = JSON.stringify({
                    state: stateId,
                    port: port.toString()
                });
                const stateBase64 = Buffer.from(stateJson).toString('base64');
                const authUrl = new URL(OAUTH_CONFIG.authUrl);
                authUrl.searchParams.append('client_id', OAUTH_CONFIG.clientId);
                authUrl.searchParams.append('response_type', 'code');
                authUrl.searchParams.append('scope', OAUTH_CONFIG.scopes);
                authUrl.searchParams.append('redirect_uri', OAUTH_CONFIG.redirectUri);
                authUrl.searchParams.append('state', stateBase64);
                authUrl.searchParams.append('code_challenge', codeChallenge);
                authUrl.searchParams.append('code_challenge_method', 'S256');
                console.log('[OAuth] Opening browser:', authUrl.toString());
                shell.openExternal(authUrl.toString());
            });
        }
        catch (err) {
            resolve({ success: false, error: err.message });
        }
    });
}
async function exchangeCodeForToken(code, codeVerifier, redirectUri) {
    const response = await fetch(OAUTH_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
            client_id: OAUTH_CONFIG.clientId,
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: redirectUri,
            code_verifier: codeVerifier
        })
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Token exchange failed: ${response.status} - ${text}`);
    }
    return await response.json();
}
async function getLauncherData(accessToken) {
    const osName = getOS();
    const arch = getArch();
    const url = `${OAUTH_CONFIG.profilesUrl}?os=${osName}&arch=${arch}`;
    console.log(`[OAuth] Fetching launcher data from: ${url}`);
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    });
    if (!response.ok) {
        throw new Error(`Get launcher data failed: ${response.status}`);
    }
    return await response.json();
}
async function createGameSession(accessToken, profileUuid) {
    const response = await fetch(OAUTH_CONFIG.sessionUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ uuid: profileUuid })
    });
    if (!response.ok) {
        throw new Error(`Create session failed: ${response.status}`);
    }
    return await response.json();
}
async function startDeviceCodeFlow() {
    throw new Error("Device flow replaced by PKCE");
}
async function completeOAuthFlow() {
    return { success: false, error: "Use startPkceFlow" };
}
async function addOfflineAccount(username) {
    if (!username || username.trim().length === 0) {
        return { success: false, error: 'Username is required' };
    }
    const account = addAccount({
        type: 'offline',
        username: username.trim(),
        uuid: uuidv4(),
    });
    return {
        success: true,
        account: {
            id: account.id,
            username: account.username,
            uuid: account.uuid,
            type: account.type
        }
    };
}
async function refreshAccountToken(accountId) {
    const config = loadConfig();
    const account = config.accounts.find((a) => a.id === accountId);
    if (!account || !account.refreshToken) {
        return { success: false, error: 'No refresh token' };
    }
    try {
        const response = await fetch(OAUTH_CONFIG.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: new URLSearchParams({
                client_id: OAUTH_CONFIG.clientId,
                grant_type: 'refresh_token',
                refresh_token: account.refreshToken
            })
        });
        if (!response.ok) {
            throw new Error(`Refresh failed: ${response.status}`);
        }
        const data = await response.json();
        account.accessToken = data.access_token;
        account.refreshToken = data.refresh_token;
        account.tokenExpiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString();
        saveConfig({ accounts: config.accounts });
        return { success: true };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
function getGameConfig() {
    const config = loadConfig();
    return {
        gamePath: config.gamePath,
        javaPath: config.javaPath,
        installedVersion: config.installedVersion
    };
}
function saveGameConfig(update) {
    const config = loadConfig();
    const next = { ...config, ...update };
    const configDir = path.dirname(CONFIG_FILE);
    if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
}
function getPossibleGameDirs() {
    const home = os.homedir();
    const dirs = [];
    if (process.platform === 'win32') {
        dirs.push(path.join(home, 'AppData', 'Roaming', 'Hytale', 'install', 'release', 'package', 'game', 'latest'));
        dirs.push(path.join(home, 'AppData', 'Local', 'HytaleF2P', 'release', 'package', 'game', 'latest'));
        dirs.push(path.join(home, 'AppData', 'Local', 'Hytale'));
        dirs.push(path.join(home, 'AppData', 'Local', 'Hytale', 'game'));
        dirs.push('C:\\Program Files\\Hytale');
        dirs.push('C:\\Program Files (x86)\\Hytale');
        // Steam common path
        dirs.push('C:\\Program Files (x86)\\Steam\\steamapps\\common\\Hytale');
    }
    else if (process.platform === 'darwin') {
        dirs.push(path.join(home, 'Library', 'Application Support', 'HytaleF2P', 'release', 'package', 'game', 'latest'));
        dirs.push(path.join(home, 'Library', 'Application Support', 'Hytale'));
        dirs.push('/Applications/Hytale.app/Contents');
    }
    else {
        dirs.push(path.join(home, '.hytalef2p', 'release', 'package', 'game', 'latest'));
        dirs.push(path.join(home, '.hytale'));
        dirs.push(path.join(home, '.local', 'share', 'Hytale'));
    }
    return dirs;
}
function getGameDir() {
    const gameConfig = getGameConfig();
    if (gameConfig.gamePath) {
        return gameConfig.gamePath;
    }
    const possibleDirs = getPossibleGameDirs();
    for (const dir of possibleDirs) {
        if (fs.existsSync(dir)) {
            const clientPath = findClientPathInDir(dir);
            if (clientPath) {
                console.log(`[Game] Auto-detected game at: ${dir}`);
                saveGameConfig({ gamePath: dir });
                return dir;
            }
        }
    }
    return possibleDirs[0];
}
function findClientPathInDir(gameDir) {
    const candidates = getClientCandidates(gameDir);
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return null;
}
function getOS() {
    switch (process.platform) {
        case 'win32': return 'windows';
        case 'darwin': return 'darwin';
        default: return 'linux';
    }
}
function getArch() {
    const arch = process.arch;
    if (arch === 'arm64')
        return 'arm64';
    return 'x64';
}
// Download file with   progress
function downloadFile(url, dest, progressCallback) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                file.close();
                fs.unlinkSync(dest);
                return downloadFile(response.headers.location, dest, progressCallback).then(resolve).catch(reject);
            }
            if (response.statusCode !== 200) {
                file.close();
                fs.unlinkSync(dest);
                reject(new Error(`Download failed: ${response.statusCode}`));
                return;
            }
            const totalSize = parseInt(response.headers['content-length'] || '0', 10);
            let downloadedSize = 0;
            response.on('data', (chunk) => {
                downloadedSize += chunk.length;
                if (progressCallback && totalSize > 0) {
                    progressCallback(Math.round((downloadedSize / totalSize) * 100));
                }
            });
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
            file.on('error', (err) => {
                fs.unlinkSync(dest);
                reject(err);
            });
        }).on('error', (err) => {
            fs.unlinkSync(dest);
            reject(err);
        });
    });
}
async function getLatestClientVersion() {
    const osName = getOS();
    const arch = getArch();
    const urls = [
        `https://game-patches.hytale.com/patches/${osName}/${arch}/release/latest`,
        `https://game-patches.hytale.com/patches/${osName}/${arch}/earlyaccess/latest`,
    ];
    for (const url of urls) {
        try {
            const response = await fetch(url);
            if (response.ok) {
                const version = await response.text();
                const trimmedVersion = version.trim();
                if (trimmedVersion && !trimmedVersion.includes('<') && trimmedVersion.length < 20) {
                    return trimmedVersion;
                }
            }
        }
        catch (err) {
            console.error(`Failed to get version from ${url}:`, err.message);
        }
    }
    return '1.0';
}
function getInstalledVersion() {
    const gameConfig = getGameConfig();
    return gameConfig.installedVersion || null;
}
function getClientCandidates(gameLatest) {
    const candidates = [];
    if (process.platform === 'win32') {
        candidates.push(path.join(gameLatest, 'Client', 'HytaleClient.exe'));
        candidates.push(path.join(gameLatest, 'Client', 'Hytale.exe'));
        candidates.push(path.join(gameLatest, 'HytaleClient.exe'));
        candidates.push(path.join(gameLatest, 'Hytale.exe'));
    }
    else if (process.platform === 'darwin') {
        candidates.push(path.join(gameLatest, 'Client', 'Hytale.app', 'Contents', 'MacOS', 'HytaleClient'));
        candidates.push(path.join(gameLatest, 'Client', 'Hytale.app', 'Contents', 'MacOS', 'Hytale'));
        candidates.push(path.join(gameLatest, 'Client', 'HytaleClient'));
        candidates.push(path.join(gameLatest, 'Hytale.app', 'Contents', 'MacOS', 'Hytale'));
    }
    else {
        candidates.push(path.join(gameLatest, 'Client', 'HytaleClient'));
        candidates.push(path.join(gameLatest, 'Client', 'Hytale'));
        candidates.push(path.join(gameLatest, 'HytaleClient'));
        candidates.push(path.join(gameLatest, 'Hytale'));
    }
    return candidates;
}
function findClientPath(gameDir) {
    const candidates = getClientCandidates(gameDir);
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            console.log(`[Game] Found client at: ${p}`);
            return p;
        }
    }
    console.log(`[Game] Client not found. Checked: ${candidates.join(', ')}`);
    return null;
}
function findJavaPath(gameDir) {
    const jreBase = path.join(path.dirname(path.dirname(gameDir)), 'jre', 'latest');
    const possiblePaths = [
        path.join(jreBase, 'bin', 'java.exe'),
        path.join(jreBase, 'bin', 'java'),
        path.join(jreBase, 'Contents', 'Home', 'bin', 'java'),
    ];
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log(`[Game] Found Java at: ${p}`);
            return p;
        }
    }
    console.log(`[Game] Java not found in bundled JRE`);
    return null;
}
function isGameInstalled() {
    const gameDir = getGameDir();
    console.log(`[Game] Checking installation at: ${gameDir}`);
    const clientPath = findClientPath(gameDir);
    return clientPath !== null;
}
async function launchGame(event, instanceId, sendProgress, worldName) {
    const account = getActiveAccount();
    if (!account) {
        return { success: false, error: 'No active account' };
    }
    const gameDir = getGameDir();
    const clientPath = findClientPath(gameDir);
    if (!clientPath) {
        return { success: false, error: 'Game not installed. Please install first.' };
    }
    const javaPath = findJavaPath(gameDir) || getGameConfig().javaPath;
    if (!javaPath || !fs.existsSync(javaPath)) {
        return { success: false, error: 'Java not found. Please configure Java path.' };
    }
    sendProgress('Fetching session tokens...', 10);
    let identityToken = '';
    let sessionToken = '';
    if (account.type === 'hytale' && account.accessToken) {
        try {
            const expiresAt = account.tokenExpiresAt;
            if (expiresAt && new Date(expiresAt) < new Date()) {
                sendProgress('Refreshing auth tokens...', 15);
                await refreshAccountToken(account.id);
            }
            sendProgress('Creating game session...', 20);
            const token = account.accessToken;
            const session = await createGameSession(token, account.uuid);
            identityToken = session.identityToken;
            sessionToken = session.sessionToken;
        }
        catch (err) {
            return { success: false, error: `Failed to get session: ${err.message}` };
        }
    }
    else {
        sendProgress('Generating offline session...', 20);
        const tokens = generateOfflineTokens(account.uuid, account.username);
        identityToken = tokens.identityToken;
        sessionToken = tokens.sessionToken;
    }
    let userDataDir = path.join(gameDir, 'Client', 'UserData');
    let instanceSettings = {};
    const globalConfig = loadConfig();
    const globalSettings = globalConfig.gameSettings || { minMemory: 1024, maxMemory: 4096, width: 1280, height: 720, javaArgs: '' };
    if (instanceId) {
        const { getInstanceDir, getInstance } = require('./instanceManager');
        const instanceDir = getInstanceDir(instanceId);
        const instance = getInstance(instanceId);
        if (fs.existsSync(instanceDir)) {
            console.log(`[Launch] Using isolated instance dir: ${instanceDir}`);
            userDataDir = instanceDir;
            if (instance)
                instanceSettings = instance;
        }
        else {
            console.warn(`[Launch] Instance ${instanceId} not found, falling back to default.`);
        }
    }
    if (!fs.existsSync(userDataDir)) {
        fs.mkdirSync(userDataDir, { recursive: true });
    }
    const minMem = instanceSettings.minMemory || globalSettings.minMemory;
    const maxMem = instanceSettings.maxMemory || globalSettings.maxMemory;
    const width = instanceSettings.width || globalSettings.width;
    const height = instanceSettings.height || globalSettings.height;
    try {
        const settingsPath = path.join(userDataDir, 'Settings.json');
        let gameSettings = {};
        if (fs.existsSync(settingsPath)) {
            try {
                gameSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            }
            catch (e) {
                console.warn('[Launch] Failed to parse existing Settings.json, creating new.', e);
            }
        }
        else {
            gameSettings = { FormatVersion: 5 };
        }
        if (width && height) {
            gameSettings.WindowWidth = width;
            gameSettings.WindowHeight = height;
            console.log(`[Launch] Applied resolution: ${width}x${height}`);
        }
        if (gameSettings.RenderDistance) {
            delete gameSettings.RenderDistance;
            console.log(`[Launch] Removed invalid 'RenderDistance' key from settings`);
        }
        if (!gameSettings.RenderingSettings)
            gameSettings.RenderingSettings = {};
        if (!gameSettings.RenderingSettings.ViewDistance || gameSettings.RenderingSettings.ViewDistance > 64) {
            console.log(`[Launch] Clamping ViewDistance to 64 to prevent load crash (Safe Mode, was ${gameSettings.RenderingSettings.ViewDistance})`);
            gameSettings.RenderingSettings.ViewDistance = 64;
        }
        if (!fs.existsSync(userDataDir)) {
            fs.mkdirSync(userDataDir, { recursive: true });
        }
        fs.writeFileSync(settingsPath, JSON.stringify(gameSettings, null, 2), 'utf8');
    }
    catch (err) {
        console.error('[Launch] Error applying game settings:', err);
    }
    const args = [
        '--app-dir', gameDir,
        '--java-exec', javaPath,
        '--auth-mode', account.type === 'hytale' ? 'authenticated' : 'offline',
        '--uuid', account.uuid,
        '--name', account.username,
        '--identity-token', identityToken,
        '--session-token', sessionToken,
        '--user-dir', userDataDir
    ];
    if (worldName) {
        console.log(`[Launch] World requested: ${worldName} (user must select manually due to client bug)`);
    }
    sendProgress('Starting game...', 50);
    sendProgress('Starting game...', 50);
    console.log(`Launching: ${clientPath}`);
    console.log(`Args: ${args.join(' ')}`);
    return new Promise((resolve) => {
        try {
            const child = spawn(clientPath, args, {
                stdio: ['ignore', 'pipe', 'pipe'],
                detached: true,
                env: { ...process.env }
            });
            child.stdout.on('data', (data) => {
                console.log(`[Game] ${data.toString().trim()}`);
            });
            child.stderr.on('data', (data) => {
                console.error(`[Game Error] ${data.toString().trim()}`);
            });
            child.on('error', (error) => {
                console.error('Failed to launch:', error);
                if (event && event.sender) {
                    event.sender.send('launch-progress', { message: 'Erro: ' + error.message, percent: -1 });
                }
                resolve({ success: false, error: error.message });
            });
            child.on('exit', (code) => {
                console.log(`[Game] Process exited with code ${code}`);
                sendProgress('IDLE', 0);
                resolve({ success: code === 0 });
            });
            let launchResolved = false;
            setTimeout(() => {
                if (launchResolved)
                    return;
                launchResolved = true;
                if (child.pid) {
                    console.log(`[Game] Successfully started with PID: ${child.pid}`);
                    sendProgress('Rodando..', 100);
                    resolve({ success: true });
                }
                else {
                    resolve({ success: false, error: 'Failed' });
                }
            }, 2000);
        }
        catch (err) {
            resolve({ success: false, error: err.message });
        }
    });
}
function generateOfflineTokens(uuid, name) {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 36000;
    const header = Buffer.from(JSON.stringify({
        alg: 'none',
        typ: 'JWT'
    })).toString('base64url');
    const identityPayload = Buffer.from(JSON.stringify({
        sub: uuid,
        name: name,
        username: name,
        scope: 'offline',
        iat: now,
        exp: exp,
        jti: uuidv4()
    })).toString('base64url');
    const sessionPayload = Buffer.from(JSON.stringify({
        sub: uuid,
        scope: 'offline',
        iat: now,
        exp: exp,
        jti: uuidv4()
    })).toString('base64url');
    return {
        identityToken: `${header}.${identityPayload}.`,
        sessionToken: `${header}.${sessionPayload}.`
    };
}
let mainWindow = null;
const createWindow = () => {
    mainWindow = new BrowserWindow({
        width: 1000,
        height: 1000,
        transparent: true,
        frame: false,
        resizable: false,
        minWidth: 1000,
        minHeight: 1000,
        maxWidth: 1360,
        maxHeight: 1000,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        show: false
    });
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools();
    }
    else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }
};
app.whenReady().then(() => {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'; " +
                        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com; " +
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com; " +
                        "font-src 'self' https://fonts.gstatic.com data:; " +
                        "img-src 'self' data: https: http:; " +
                        "connect-src 'self' https: http: ws: wss:; " +
                        "media-src 'self' https: http:;"
                ]
            }
        });
    });
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
const { ipcMain: ipcMainEvents } = require('electron');
ipcMainEvents.on('minimize-window', () => {
    if (mainWindow) {
        mainWindow.minimize();
    }
});
ipcMainEvents.on('close-window', async () => {
    if (mainWindow) {
        console.log('[Main] Sending app-closing signal to renderer...');
        mainWindow.webContents.send('app-closing');
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('[Main] Closing window...');
        mainWindow.close();
    }
});
ipcMainEvents.on('resize-window', (_event, width, height) => {
    if (mainWindow) {
        mainWindow.setMinimumSize(width, height);
        mainWindow.setMaximumSize(width, height);
        mainWindow.setSize(width, height);
    }
});
ipcMain.handle('is-first-launch', async () => {
    return isFirstLaunch();
});
ipcMain.handle('get-config', async () => {
    return loadConfig();
});
ipcMain.handle('save-config', async (_event, newConfig) => {
    saveConfig(newConfig);
    return true;
});
ipcMain.handle('mark-as-launched', async () => {
    markAsLaunched();
    return true;
});
ipcMain.handle('get-accounts', async () => {
    return getAccounts();
});
ipcMain.handle('get-active-account', async () => {
    return getActiveAccount();
});
ipcMain.handle('set-active-account', async (_event, accountId) => {
    setActiveAccount(accountId);
    return true;
});
ipcMain.handle('remove-account', async (_event, accountId) => {
    removeAccount(accountId);
    return true;
});
ipcMain.handle('start-hytale-oauth', async () => {
    return await startPkceFlow();
});
ipcMain.handle('poll-oauth-token', async () => {
    return { success: false, error: 'Use start-hytale-oauth' };
});
ipcMain.handle('cancel-oauth', async () => {
    if (activePkceServer) {
        activePkceServer.close();
        activePkceServer = null;
    }
    return true;
});
ipcMain.handle('refresh-account-token', async (_event, accountId) => {
    return await refreshAccountToken(accountId);
});
ipcMain.handle('initiate-hytale-login', async () => {
    return await startPkceFlow();
});
ipcMain.handle('confirm-hytale-account', async (_event, username) => {
    const account = addAccount({
        type: 'hytale',
        username: username.trim(),
        uuid: uuidv4(),
    });
    return { success: true, account };
});
ipcMain.handle('add-offline-account', async (_event, username) => {
    return await addOfflineAccount(username);
});
ipcMain.handle('get-session-tokens', async () => {
    const account = getActiveAccount();
    if (!account) {
        throw new Error('No active account');
    }
    if (account.type === 'hytale' && account.accessToken) {
        const session = await createGameSession(account.accessToken, account.uuid);
        return session;
    }
    throw new Error('Account has no valid tokens');
});
ipcMain.handle('login', async (_event, credentials) => {
    const { username } = credentials;
    if (username) {
        return await addOfflineAccount(username);
    }
    return { success: false, error: 'Invalid credentials' };
});
ipcMain.handle('open-external', async (_event, url) => {
    await shell.openExternal(url);
    return true;
});
ipcMain.handle('launch-game', async (event, payload) => {
    const instanceId = typeof payload === 'string' ? payload : payload?.instanceId;
    const worldName = typeof payload === 'object' ? payload?.worldName : undefined;
    const sendProgress = (msg, percent) => {
        console.log(`[Launch] ${msg} (${percent}%)`);
        event.sender.send('launch-progress', { message: msg, percent });
    };
    return await launchGame(event, instanceId, sendProgress, worldName);
});
ipcMain.handle('is-game-installed', async () => {
    return isGameInstalled();
});
ipcMain.handle('get-game-dir', async () => {
    return getGameDir();
});
ipcMain.handle('get-latest-version', async () => {
    return await getLatestClientVersion();
});
ipcMain.handle('get-installed-version', async () => {
    return getInstalledVersion();
});
ipcMain.handle('set-game-path', async (_event, gamePath) => {
    saveGameConfig({ gamePath });
    return true;
});
ipcMain.handle('select-game-folder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Hytale Game Folder'
    });
    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }
    const selectedPath = result.filePaths[0];
    const clientPath = findClientPath(selectedPath);
    if (clientPath) {
        saveGameConfig({ gamePath: selectedPath });
        return { success: true, path: selectedPath };
    }
    return { success: false, error: 'Hytale client not found in this folder' };
});
ipcMain.handle('get-instances', async () => {
    const { loadInstances } = require('./instanceManager');
    return loadInstances();
});
ipcMain.handle('create-instance', async (event, name, version, options) => {
    const { createInstance } = require('./instanceManager');
    return createInstance(name, version, options);
});
ipcMain.handle('create-complex-instance', async (event, payload) => {
    const { createInstanceWithConfig, addWorldToInstance, getInstanceDir } = require('./instanceManager');
    try {
        let instanceId = payload.targetInstanceId;
        if (instanceId) {
            console.log('[WorldGen] Adding world to existing instance:', instanceId);
            const result = addWorldToInstance(instanceId, payload.worldConfig, payload.modEnabledState);
            if (!result.success)
                throw new Error(result.error);
        }
        else {
            console.log('[WorldGen] Creating complex instance:', payload.name);
            const { instance } = createInstanceWithConfig(payload.name, payload.version, payload.worldConfig, { icon: payload.icon }, payload.modEnabledState);
            instanceId = instance.id;
        }
        if (!payload.targetInstanceId && payload.mods && payload.mods.length > 0) {
            console.log(`[WorldGen] Installing ${payload.mods.length} mods...`);
            await installModsInternal(instanceId, payload.mods);
        }
        console.log(`[WorldGen] Hitting server generation for ${instanceId}...`);
        await generateWorldWithServer(instanceId, payload.worldConfig?.name || payload.name, event.sender);
        return { success: true, instanceId: instanceId };
    }
    catch (e) {
        console.error('[WorldGen] Failed:', e);
        return { success: false, error: e.message };
    }
});
async function installModsInternal(instanceId, mods) {
    const { getInstanceDir } = require('./instanceManager');
    const instanceDir = getInstanceDir(instanceId);
    const modsDir = path.join(instanceDir, 'mods');
    if (!fs.existsSync(modsDir))
        fs.mkdirSync(modsDir, { recursive: true });
    for (const mod of mods) {
        try {
            //todo
        }
        catch (e) {
            console.error(e);
        }
    }
}
function findServerJar(gameDir) {
    if (!gameDir)
        return null;
    const candidates = [
        path.join(gameDir, 'HytaleServer.jar'),
        path.join(gameDir, 'Server', 'HytaleServer.jar'),
        path.join(path.dirname(gameDir), 'Server', 'HytaleServer.jar'),
        path.join(gameDir, '..', 'Server', 'HytaleServer.jar')
    ];
    for (const p of candidates) {
        if (fs.existsSync(p))
            return p;
    }
    return null;
}
async function generateWorldWithServer(instanceId, worldName, sender) {
    const { getInstanceDir } = require('./instanceManager');
    const instanceDir = getInstanceDir(instanceId);
    const gameDir = getGameDir();
    const serverJar = findServerJar(gameDir);
    if (!serverJar) {
        console.warn('[WorldGen] HytaleServer.jar not found. World will generate on first game launch.');
        return;
    }
    const serverDir = path.dirname(serverJar);
    const assetsZip = path.join(serverDir, '..', 'Assets.zip');
    if (!fs.existsSync(assetsZip)) {
        console.warn('[WorldGen] Assets.zip not found. World will generate on first game launch.');
        return;
    }
    console.log(`[WorldGen] Found server at ${serverJar}. Generating world...`);
    if (sender)
        sender.send('launch-progress', { message: 'Gerando mundo...', percent: 50 });
    const javaPath = findJavaPath(gameDir) || 'java';
    const universePath = path.join(instanceDir, 'universe', 'worlds').replace(/\\/g, '/');
    if (!fs.existsSync(universePath)) {
        fs.mkdirSync(universePath, { recursive: true });
    }
    const aotCache = path.join(serverDir, 'HytaleServer.aot');
    const serverArgs = [
        ...(fs.existsSync(aotCache) ? ['-XX:AOTCache=' + aotCache] : []),
        '-jar', serverJar,
        '--assets', assetsZip,
        '--world', worldName,
        '--singleplayer'
    ];
    const savesDir = path.join(instanceDir, 'saves');
    if (!fs.existsSync(savesDir))
        fs.mkdirSync(savesDir, { recursive: true });
    const cleanupItems = ['logs', 'universe', 'bans.json', 'whitelist.json', 'permissions.json', 'bds', 'crash-reports'];
    cleanupItems.forEach(item => {
        const src = path.join(savesDir, item);
        const dest = path.join(instanceDir, item);
        if (fs.existsSync(src)) {
            try {
                if (!fs.existsSync(dest)) {
                    fs.renameSync(src, dest);
                }
                else if (!fs.lstatSync(src).isDirectory()) {
                    fs.copyFileSync(src, dest);
                    fs.unlinkSync(src);
                }
            }
            catch (e) {
                console.warn(`[Cleanup] Failed to move ${item}:`, e);
            }
        }
    });
    if (fs.existsSync(path.join(savesDir, 'config.json'))) {
        try {
            fs.unlinkSync(path.join(savesDir, 'config.json'));
        }
        catch (e) { }
    }
    const serverConfigPath = path.join(instanceDir, 'config.json');
    if (fs.existsSync(serverConfigPath)) {
        try {
            const configContent = fs.readFileSync(serverConfigPath, 'utf8');
            const config = JSON.parse(configContent);
            if (config.Version && config.Version > 3) {
                console.log(`[Launch] Downgrading Config Version from ${config.Version} to 3 to prevent crash.`);
                config.Version = 3;
                fs.writeFileSync(serverConfigPath, JSON.stringify(config, null, 2));
            }
        }
        catch (e) {
            console.warn('[Launch] Failed to check/fix config version:', e);
        }
    }
    serverArgs[serverArgs.indexOf('--world') + 1] = path.join('saves', worldName);
    console.log(`[WorldGen] Spawning server with args:`, serverArgs);
    console.log(`[WorldGen] CWD: ${instanceDir}`);
    return new Promise((resolve) => {
        const child = spawn(javaPath, serverArgs, {
            cwd: instanceDir,
            stdio: 'pipe'
        });
        child.on('spawn', () => {
            console.log('[WorldGen] Server process spawned successfully (PID: ' + child.pid + ')');
        });
        child.on('error', (err) => {
            console.error('[WorldGen] Failed to start server process:', err);
            resolve();
        });
        let generated = false;
        child.on('close', (code) => {
            console.log(`[WorldGen] Server process exited with code ${code}`);
            if (!generated)
                resolve();
        });
        child.stderr.on('data', (data) => {
            console.error('[WorldGen Server Error]', data.toString());
        });
        child.stdout.on('data', (data) => {
            const line = data.toString();
            console.log('[WorldGen Server]', line.trim());
            if (line.includes('Singleplayer Ready') || line.includes('Server thread/INFO]: Done') || line.includes('Listening for connections') || line.includes('World loaded')) {
                if (!generated) {
                    generated = true;
                    console.log('[WorldGen] World generation complete. Stopping server.');
                    if (sender)
                        sender.send('launch-progress', { message: 'Mundo gerado!', percent: 90 });
                    child.kill();
                    resolve();
                }
            }
        });
        setTimeout(() => {
            if (!generated) {
                console.log('[WorldGen] Timeout waiting for generation. Killing server.');
                child.kill();
                resolve();
            }
        }, 120000);
    });
}
ipcMain.handle('update-instance', async (event, id, updates) => {
    const { updateInstance } = require('./instanceManager');
    return updateInstance(id, updates);
});
ipcMain.handle('delete-instance', async (event, id) => {
    const { deleteInstance } = require('./instanceManager');
    return deleteInstance(id);
});
ipcMain.handle('delete-world', async (event, instanceId, worldName) => {
    const { deleteWorld } = require('./instanceManager');
    return deleteWorld(instanceId, worldName);
});
ipcMain.handle('open-instance-folder', async (event, id) => {
    const { getInstanceDir } = require('./instanceManager');
    const dir = getInstanceDir(id);
    if (fs.existsSync(dir)) {
        require('electron').shell.openPath(dir);
        return true;
    }
    return false;
});
ipcMain.handle('get-instance-worlds', async (event, instanceId) => {
    const { getInstanceWorlds } = require('./instanceManager');
    return getInstanceWorlds(instanceId);
});
ipcMain.on('minimize-window', () => {
    console.log('[Window] Minimizing via ipcMain.on...');
    const win = BrowserWindow.getFocusedWindow();
    if (win)
        win.minimize();
});
ipcMain.on('close-window', () => {
    console.log('[Window] Closing via ipcMain.on...');
    const win = BrowserWindow.getFocusedWindow();
    if (win)
        win.close();
});
ipcMain.on('resize-window', (event, width, height) => {
    if (mainWindow) {
        mainWindow.setResizable(true);
        mainWindow.setSize(width, height, true);
        mainWindow.center();
        setTimeout(() => {
            mainWindow?.setResizable(false);
        }, 100);
    }
});
ipcMain.handle('get-hytale-news', async () => {
    try {
        const response = await fetch('https://hytale.com/api/blog/post/published');
        if (!response.ok)
            throw new Error('Failed to fetch news');
        const news = await response.json();
        return news;
    }
    catch (error) {
        console.error('Failed to fetch Hytale news:', error);
        return [];
    }
});

const CURSEFORGE_API_KEY = '$';
const CURSEFORGE_HYTALE_GAME_ID = 70216;
let curseforgeModsClassId = null;
async function getCurseforgeModsClassId() {
    if (curseforgeModsClassId !== null) {
        return curseforgeModsClassId;
    }
    try {
        console.log('[CurseForge] Fetching categories to find Mods classId...');
        const catRes = await fetch(`https://api.curseforge.com/v1/categories?gameId=${CURSEFORGE_HYTALE_GAME_ID}`, {
            headers: {
                'Accept': 'application/json',
                'x-api-key': CURSEFORGE_API_KEY
            }
        });
        if (catRes.ok) {
            const catData = await catRes.json();
            console.log(`[CurseForge] Found ${catData.data?.length || 0} categories`);
            (catData.data || []).forEach((cat) => {
                if (cat.isClass) {
                    console.log(`[CurseForge] Category: ${cat.name} (id: ${cat.id}, isClass: ${cat.isClass})`);
                }
            });
            const modsCategory = (catData.data || []).find((cat) => cat.name.toLowerCase() === 'mods' && cat.isClass === true);
            if (modsCategory) {
                curseforgeModsClassId = modsCategory.id;
                console.log(`[CurseForge] Found Mods classId: ${curseforgeModsClassId}`);
                return curseforgeModsClassId;
            }
        }
    }
    catch (e) {
        console.log('[CurseForge] Could not fetch categories:', e);
    }
    return null;
}
ipcMain.handle('search-mods', async (event, source, query, filters) => {
    console.log(`[ModSearch] Source: ${source}, Query: "${query}", Filters:`, filters);
    try {
        if (source === 'ModTale') {
            const result = await searchModTale(query, filters);
            console.log(`[ModSearch] ModTale returned ${result.mods.length} results, hasMore: ${result.hasMore}, total: ${result.total}`);
            return result;
        }
        else if (source === 'CurseForge') {
            const result = await searchCurseForge(query, filters);
            console.log(`[ModSearch] CurseForge returned ${result.mods.length} results, hasMore: ${result.hasMore}, total: ${result.total}`);
            return result;
        }
        return { mods: [], hasMore: false, total: 0 };
    }
    catch (e) {
        console.error("Search mods failed:", e);
        return { mods: [], hasMore: false, total: 0 };
    }
});
async function searchModTale(query, filters) {
    const pageSize = 50;
    const page = filters?.page || 0;
    let url = `https://api.modtale.net/api/v1/projects?size=${pageSize}&page=${page}`;
    if (query) {
        url += `&search=${encodeURIComponent(query)}`;
    }
    // Sort mapping
    const sortMap = {
        'relevance': 'relevance',
        'downloads': 'downloads',
        'rating': 'rating',
        'newest': 'newest',
        'updated': 'updated',
        'favorites': 'favorites'
    };
    url += `&sort=${sortMap[filters?.sort || 'downloads'] || 'downloads'}`;
    if (filters?.classification) {
        url += `&classification=${filters.classification}`;
    }
    if (filters?.tags) {
        url += `&tags=${encodeURIComponent(filters.tags)}`;
    }
    console.log(`[ModTale] Fetching: ${url}`);
    const res = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'OrbisLauncher/1.0'
        }
    });
    if (!res.ok) {
        const errorText = await res.text();
        console.error(`ModTale API error: ${res.status} ${res.statusText}`, errorText);
        throw new Error(`ModTale API error: ${res.statusText}`);
    }
    const data = await res.json();
    const totalElements = data.totalElements || 0;
    const totalPages = data.totalPages || 1;
    const currentPage = data.number ?? page;
    const hasMore = currentPage < totalPages - 1;
    console.log(`[ModTale] Response: ${data.content?.length || 0} items, page ${currentPage + 1}/${totalPages}, total: ${totalElements}, hasMore: ${hasMore}`);
    if (data.content && data.content.length > 0) {
        console.log(`[ModTale] First item fields:`, Object.keys(data.content[0]));
        console.log(`[ModTale] First item downloads:`, data.content[0].downloads, 'downloadCount:', data.content[0].downloadCount);
    }
    const mods = (data.content || []).map((project) => ({
        id: project.id,
        name: project.title,
        author: project.author,
        description: project.description,
        icon: project.imageUrl || '',
        source: 'ModTale',
        classification: project.classification,
        downloads: project.downloads ?? project.downloadCount ?? 0,
        rating: project.rating ?? 0,
        tags: project.tags || []
    }));
    return { mods, hasMore, total: totalElements };
}
async function searchCurseForge(query, filters) {
    const sortMap = {
        'relevance': 1,
        'downloads': 6,
        'rating': 2,
        'newest': 3,
        'updated': 3,
        'favorites': 2
    };
    const sortField = sortMap[filters?.sort || 'downloads'] || 6;
    const pageSize = 50;
    const page = filters?.page || 0;
    const index = page * pageSize;
    const modsClassId = await getCurseforgeModsClassId();
    let url = `https://api.curseforge.com/v1/mods/search?gameId=${CURSEFORGE_HYTALE_GAME_ID}&pageSize=${pageSize}&index=${index}&sortField=${sortField}&sortOrder=desc`;
    if (modsClassId) {
        url += `&classId=${modsClassId}`;
    }
    if (query) {
        url += `&searchFilter=${encodeURIComponent(query)}`;
    }
    try {
        console.log(`[CurseForge] Fetching: ${url}`);
        const res = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'x-api-key': CURSEFORGE_API_KEY
            }
        });
        if (!res.ok) {
            const errorText = await res.text();
            console.error(`CurseForge API error: ${res.status} ${res.statusText}`, errorText);
            return { mods: [], hasMore: false, total: 0 };
        }
        const data = await res.json();
        const pagination = data.pagination || {};
        const totalCount = pagination.totalCount || 0;
        const resultCount = pagination.resultCount || data.data?.length || 0;
        const hasMore = (index + resultCount) < totalCount;
        console.log(`[CurseForge] Found ${resultCount} mods, index: ${index}, total: ${totalCount}, hasMore: ${hasMore}`);
        // Map CurseForge response to our mod format
        const mods = (data.data || []).map((mod) => ({
            id: String(mod.id),
            name: mod.name,
            author: mod.authors?.[0]?.name || 'Unknown',
            description: mod.summary || '',
            icon: mod.logo?.thumbnailUrl || '',
            source: 'CurseForge',
            downloads: mod.downloadCount,
            rating: mod.rating || 0,
            tags: mod.categories?.map((c) => c.name) || [],
            curseforgeUrl: mod.links?.websiteUrl
        }));
        return { mods, hasMore, total: totalCount };
    }
    catch (e) {
        console.error("CurseForge search failed:", e);
        return { mods: [], hasMore: false, total: 0 };
    }
}
let modWatcher = null;
let targetModsDir = null;
let watchingForMod = false;
let pendingModName = null;
function getDownloadsFolders() {
    const homeDir = os.homedir();
    const folders = [
        path.join(homeDir, 'Downloads'),
        path.join(homeDir, 'Desktop'),
        path.join(homeDir, 'Transferências'),
        path.join(homeDir, 'Descargas'),
    ];
    return folders.filter(f => fs.existsSync(f));
}
function startModWatcher(modsDir, modName) {
    stopModWatcher();
    targetModsDir = modsDir;
    watchingForMod = true;
    pendingModName = modName;
    const downloadsFolders = getDownloadsFolders();
    console.log(`[ModWatcher] Watching folders:`, downloadsFolders);
    console.log(`[ModWatcher] Target mods dir:`, modsDir);
    const existingFiles = {};
    downloadsFolders.forEach(folder => {
        try {
            existingFiles[folder] = new Set(fs.readdirSync(folder));
        }
        catch (e) {
            existingFiles[folder] = new Set();
        }
    });
    modWatcher = setInterval(() => {
        if (!watchingForMod || !targetModsDir)
            return;
        for (const folder of downloadsFolders) {
            try {
                const currentFiles = fs.readdirSync(folder);
                for (const file of currentFiles) {
                    if (!existingFiles[folder].has(file)) {
                        const ext = path.extname(file).toLowerCase();
                        if (ext === '.jar' || ext === '.zip') {
                            const srcPath = path.join(folder, file);
                            setTimeout(() => {
                                try {
                                    const stats = fs.statSync(srcPath);
                                    const destPath = path.join(targetModsDir, file);
                                    fs.copyFileSync(srcPath, destPath);
                                    fs.unlinkSync(srcPath);
                                    console.log(`[ModWatcher] Moved ${file} to mods folder`);
                                    if (mainWindow) {
                                        mainWindow.webContents.send('mod-installed', {
                                            success: true,
                                            filename: file,
                                            path: destPath,
                                            modName: pendingModName
                                        });
                                    }
                                    stopModWatcher();
                                }
                                catch (moveErr) {
                                    console.error('[ModWatcher] Failed to move file:', moveErr);
                                }
                            }, 2000);
                            return;
                        }
                        existingFiles[folder].add(file);
                    }
                }
            }
            catch (e) {
            }
        }
    }, 1000);
    setTimeout(() => {
        if (watchingForMod) {
            console.log('[ModWatcher] Timeout - stopped watching');
            stopModWatcher();
            if (mainWindow) {
                mainWindow.webContents.send('mod-installed', {
                    success: false,
                    error: 'timeout',
                    modName: pendingModName
                });
            }
        }
    }, 5 * 60 * 1000);
}
function stopModWatcher() {
    if (modWatcher) {
        clearInterval(modWatcher);
        modWatcher = null;
    }
    watchingForMod = false;
    targetModsDir = null;
    pendingModName = null;
}
ipcMain.handle('install-mod', async (event, instanceId, mod) => {
    try {
        const { getInstanceDir } = require('./instanceManager');
        const instanceDir = getInstanceDir(instanceId);
        const modsDir = path.join(instanceDir, 'mods');
        if (!fs.existsSync(modsDir)) {
            fs.mkdirSync(modsDir, { recursive: true });
        }
        let downloadUrl = mod.downloadUrl;
        const downloadFile = (url, dest) => {
            return new Promise((resolve, reject) => {
                const file = fs.createWriteStream(dest);
                const request = https.get(url, {
                    headers: { 'User-Agent': 'OrbisLauncher/1.0' }
                }, (response) => {
                    if (response.statusCode === 301 || response.statusCode === 302) {
                        file.close();
                        fs.unlinkSync(dest);
                        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                        return;
                    }
                    if (response.statusCode !== 200) {
                        file.close();
                        fs.unlinkSync(dest);
                        reject(new Error(`HTTP ${response.statusCode}`));
                        return;
                    }
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close();
                        resolve();
                    });
                });
                request.on('error', (err) => {
                    file.close();
                    fs.unlink(dest, () => { });
                    reject(err);
                });
            });
        };
        if (mod.source === 'ModTale' && !downloadUrl) {
            const projectRes = await fetch(`https://api.modtale.net/api/v1/projects/${mod.id}`, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'OrbisLauncher/1.0'
                }
            });
            if (!projectRes.ok)
                throw new Error(`Failed to fetch project details: ${projectRes.statusText}`);
            const projectData = await projectRes.json();
            if (projectData.versions && projectData.versions.length > 0) {
                const latestVersion = projectData.versions[0];
                downloadUrl = `https://api.modtale.net/api/v1/projects/${mod.id}/versions/${latestVersion.versionNumber}/download`;
                const fileName = latestVersion.fileName || `${mod.name}-${latestVersion.versionNumber}.jar`;
                const destPath = path.join(modsDir, fileName);
                console.log(`[ModInstall] Downloading ModTale mod directly: ${downloadUrl}`);
                try {
                    await downloadFile(downloadUrl, destPath);
                    console.log(`[ModInstall] ModTale mod downloaded to: ${destPath}`);
                    return { success: true, downloaded: true, path: destPath };
                }
                catch (e) {
                    console.error(`[ModInstall] Direct download failed, falling back to browser:`, e);
                }
            }
        }
        else if (mod.source === 'CurseForge' && !downloadUrl) {
            try {
                const filesRes = await fetch(`https://api.curseforge.com/v1/mods/${mod.id}/files?pageSize=1`, {
                    headers: {
                        'Accept': 'application/json',
                        'x-api-key': CURSEFORGE_API_KEY
                    }
                });
                if (filesRes.ok) {
                    const filesData = await filesRes.json();
                    if (filesData.data && filesData.data.length > 0) {
                        const latestFile = filesData.data[0];
                        const fileName = latestFile.fileName || `${mod.name}.jar`;
                        if (latestFile.downloadUrl) {
                            downloadUrl = latestFile.downloadUrl;
                        }
                        else if (latestFile.id) {
                            const fileIdStr = String(latestFile.id);
                            const firstPart = fileIdStr.substring(0, 4);
                            const secondPart = fileIdStr.substring(4);
                            downloadUrl = `https://edge.forgecdn.net/files/${firstPart}/${secondPart}/${encodeURIComponent(fileName)}`;
                        }
                        if (downloadUrl) {
                            console.log(`[ModInstall] Downloading CurseForge mod directly: ${downloadUrl}`);
                            const destPath = path.join(modsDir, fileName);
                            await downloadFile(downloadUrl, destPath);
                            console.log(`[ModInstall] CurseForge mod downloaded to: ${destPath}`);
                            return { success: true, downloaded: true, path: destPath };
                        }
                    }
                }
            }
            catch (e) {
                console.error("Failed to download CurseForge mod:", e);
            }
            if (!downloadUrl) {
                downloadUrl = `https://www.curseforge.com/hytale/mods/${mod.id}`;
            }
        }
        if (!downloadUrl)
            throw new Error("No download URL found for this mod");
        console.log(`[ModInstall] Opening download in browser: ${downloadUrl}`);
        startModWatcher(modsDir, mod.name);
        shell.openExternal(downloadUrl);
        return { success: true, waiting: true, message: 'Download aberto no navegador. O arquivo será movido automaticamente.' };
    }
    catch (e) {
        console.error("Install mod failed:", e);
        return { success: false, error: e.message };
    }
});
ipcMain.handle('cancel-mod-watch', async () => {
    stopModWatcher();
    return { success: true };
});
ipcMain.handle('get-installed-mods', async () => {
    const config = loadConfig();
    return config.installedMods || [];
});
ipcMain.handle('mark-mod-installed', async (event, mod, instanceId) => {
    const config = loadConfig();
    const installedMods = config.installedMods || [];
    const existingIndex = installedMods.findIndex(m => m.id === mod.id && m.instanceId === instanceId);
    if (existingIndex === -1) {
        installedMods.push({
            id: mod.id,
            name: mod.name,
            source: mod.source,
            installedAt: new Date().toISOString(),
            instanceId,
            fileName: mod.fileName
        });
        saveConfig({ installedMods });
    }
    return { success: true };
});
ipcMain.handle('unmark-mod-installed', async (event, modId, instanceId) => {
    const config = loadConfig();
    const installedMods = (config.installedMods || []).filter(m => !(m.id === modId && m.instanceId === instanceId));
    saveConfig({ installedMods });
    return { success: true };
});
ipcMain.handle('get-instance-mods', async (event, instanceId) => {
    try {
        const { getInstanceDir } = require('./instanceManager');
        const instanceDir = getInstanceDir(instanceId);
        const modsDir = path.join(instanceDir, 'mods');
        if (!fs.existsSync(modsDir)) {
            const config = loadConfig();
            const installedMods = (config.installedMods || []).filter((m) => m.instanceId !== instanceId);
            if (installedMods.length !== (config.installedMods || []).length) {
                saveConfig({ installedMods });
            }
            return { success: true, mods: [] };
        }
        const files = fs.readdirSync(modsDir);
        const config = loadConfig();
        const installedMods = config.installedMods || [];
        const existingFiles = files.map((f) => f.toLowerCase());
        const updatedInstalledMods = installedMods.filter((m) => {
            if (m.instanceId !== instanceId)
                return true;
            if (m.fileName && existingFiles.includes(m.fileName.toLowerCase()))
                return true;
            const hasMatchingFile = existingFiles.some((f) => f.includes(m.name.toLowerCase()));
            return hasMatchingFile;
        });
        if (updatedInstalledMods.length !== installedMods.length) {
            console.log(`[ModSync] Cleaned up ${installedMods.length - updatedInstalledMods.length} stale mod records`);
            saveConfig({ installedMods: updatedInstalledMods });
        }
        const mods = files
            .filter((file) => {
            const ext = path.extname(file).toLowerCase();
            return ['.jar', '.zip', '.hymod'].includes(ext);
        })
            .map((file) => {
            const filePath = path.join(modsDir, file);
            const stats = fs.statSync(filePath);
            const modInfo = updatedInstalledMods.find((m) => m.instanceId === instanceId &&
                (m.fileName === file || file.toLowerCase().includes(m.name.toLowerCase())));
            return {
                fileName: file,
                name: modInfo?.name || file.replace(/\.(jar|zip|hymod)$/i, ''),
                source: modInfo?.source || 'Unknown',
                id: modInfo?.id || file,
                size: stats.size,
                installedAt: stats.mtime.toISOString(),
            };
        });
        return { success: true, mods, syncedCount: installedMods.length - updatedInstalledMods.length };
    }
    catch (e) {
        console.error('Failed to get instance mods:', e);
        return { success: false, error: e.message, mods: [] };
    }
});
ipcMain.handle('remove-instance-mod', async (event, instanceId, fileName, modId) => {
    try {
        const { getInstanceDir } = require('./instanceManager');
        const instanceDir = getInstanceDir(instanceId);
        const modsDir = path.join(instanceDir, 'mods');
        const filePath = path.join(modsDir, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[ModRemove] Deleted mod file: ${filePath}`);
        }
        if (modId) {
            const config = loadConfig();
            const installedMods = (config.installedMods || []).filter(m => !(m.id === modId && m.instanceId === instanceId));
            saveConfig({ installedMods });
        }
        return { success: true };
    }
    catch (e) {
        console.error('Failed to remove mod:', e);
        return { success: false, error: e.message };
    }
});
ipcMain.handle('copy-instance-mods', async (event, sourceId, targetId, modFiles) => {
    try {
        const { getInstanceDir } = require('./instanceManager');
        const sourceDir = path.join(getInstanceDir(sourceId), 'mods');
        const targetDir = path.join(getInstanceDir(targetId), 'mods');
        if (!fs.existsSync(sourceDir))
            return { success: false, error: 'Source mods directory not found' };
        if (!fs.existsSync(targetDir))
            fs.mkdirSync(targetDir, { recursive: true });
        console.log(`[ModCopy] Copying ${modFiles.length} mods from ${sourceId} to ${targetId}`);
        let copiedCount = 0;
        for (const file of modFiles) {
            const srcPath = path.join(sourceDir, file);
            const destPath = path.join(targetDir, file);
            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destPath);
                copiedCount++;
            }
            else {
                console.warn(`[ModCopy] Source file found: ${srcPath}`);
            }
        }
        return { success: true, count: copiedCount };
    }
    catch (e) {
        console.error('[ModCopy] Failed:', e);
        return { success: false, error: e.message };
    }
});
let batchDownloadQueue = [];
let isBatchDownloading = false;
ipcMain.handle('batch-install-mods', async (event, instanceId, mods) => {
    console.log(`[BatchInstall] Starting batch install of ${mods.length} mods`);
    const { getInstanceDir } = require('./instanceManager');
    const instanceDir = getInstanceDir(instanceId);
    const modsDir = path.join(instanceDir, 'mods');
    if (!fs.existsSync(modsDir)) {
        fs.mkdirSync(modsDir, { recursive: true });
    }
    const results = [];
    const downloadFile = (url, dest) => {
        return new Promise((resolve, reject) => {
            const file = fs.createWriteStream(dest);
            const request = https.get(url, {
                headers: { 'User-Agent': 'OrbisLauncher/1.0' }
            }, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    file.close();
                    fs.unlinkSync(dest);
                    downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                    return;
                }
                if (response.statusCode !== 200) {
                    file.close();
                    fs.unlinkSync(dest);
                    reject(new Error(`HTTP ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            });
            request.on('error', (err) => {
                file.close();
                fs.unlink(dest, () => { });
                reject(err);
            });
        });
    };
    for (const mod of mods) {
        try {
            let downloadUrl = mod.downloadUrl;
            let fileName = `${mod.name}.jar`;
            if (mod.source === 'ModTale' && !downloadUrl) {
                const projectRes = await fetch(`https://api.modtale.net/api/v1/projects/${mod.id}`, {
                    headers: { 'Accept': 'application/json', 'User-Agent': 'OrbisLauncher/1.0' }
                });
                if (projectRes.ok) {
                    const projectData = await projectRes.json();
                    if (projectData.versions && projectData.versions.length > 0) {
                        const latestVersion = projectData.versions[0];
                        downloadUrl = `https://api.modtale.net/api/v1/projects/${mod.id}/versions/${latestVersion.versionNumber}/download`;
                        fileName = latestVersion.fileName || `${mod.name}-${latestVersion.versionNumber}.jar`;
                    }
                }
            }
            else if (mod.source === 'CurseForge' && !downloadUrl) {
                try {
                    const filesRes = await fetch(`https://api.curseforge.com/v1/mods/${mod.id}/files?pageSize=1`, {
                        headers: {
                            'Accept': 'application/json',
                            'x-api-key': CURSEFORGE_API_KEY
                        }
                    });
                    if (filesRes.ok) {
                        const filesData = await filesRes.json();
                        if (filesData.data && filesData.data.length > 0) {
                            const latestFile = filesData.data[0];
                            fileName = latestFile.fileName || `${mod.name}.jar`;
                            if (latestFile.downloadUrl) {
                                downloadUrl = latestFile.downloadUrl;
                            }
                            else if (latestFile.id) {
                                const fileIdStr = String(latestFile.id);
                                const firstPart = fileIdStr.substring(0, 4);
                                const secondPart = fileIdStr.substring(4);
                                downloadUrl = `https://edge.forgecdn.net/files/${firstPart}/${secondPart}/${encodeURIComponent(fileName)}`;
                            }
                        }
                    }
                }
                catch (e) {
                    console.error(`[BatchInstall] Failed to get CurseForge file info for ${mod.name}:`, e);
                }
            }
            if (downloadUrl) {
                console.log(`[BatchInstall] Downloading: ${mod.name}`);
                const destPath = path.join(modsDir, fileName);
                try {
                    await downloadFile(downloadUrl, destPath);
                    console.log(`[BatchInstall] Downloaded: ${mod.name} to ${destPath}`);
                    results.push({ mod, success: true });
                }
                catch (downloadError) {
                    console.error(`[BatchInstall] Download failed for ${mod.name}:`, downloadError);
                    shell.openExternal(downloadUrl);
                    results.push({ mod, success: true });
                }
                await new Promise(resolve => setTimeout(resolve, 300));
            }
            else {
                results.push({ mod, success: false, error: 'No download URL' });
            }
        }
        catch (e) {
            results.push({ mod, success: false, error: e.message });
        }
    }
    return { success: true, results };
});
ipcMain.handle('delete-instance-world', async (event, instanceId, worldName) => {
    try {
        const { deleteWorld } = require('./instanceManager');
        const result = deleteWorld(instanceId, worldName);
        return result;
    }
    catch (e) {
        console.error('Failed to delete world:', e);
        return { success: false, error: e.message };
    }
});
ipcMain.handle('open-world-folder', async (event, instanceId, worldName) => {
    try {
        const { getInstanceDir } = require('./instanceManager');
        const instanceDir = getInstanceDir(instanceId);
        const worldDir = path.join(instanceDir, 'saves', worldName);
        if (fs.existsSync(worldDir)) {
            shell.openPath(worldDir);
            return { success: true };
        }
        else {
            const worldsDir = path.join(instanceDir, 'saves');
            if (fs.existsSync(worldsDir)) {
                shell.openPath(worldsDir);
            }
            return { success: false, error: 'World folder not found' };
        }
    }
    catch (e) {
        console.error('Failed to open world folder:', e);
        return { success: false, error: e.message };
    }
});
ipcMain.handle('get-instance-server-config', async (event, instanceId) => {
    try {
        const { getInstanceServerConfig } = require('./instanceManager');
        return getInstanceServerConfig(instanceId);
    }
    catch (e) {
        console.error('Failed to get server config:', e);
        return {};
    }
});
ipcMain.handle('update-instance-server-config', async (event, instanceId, updates) => {
    try {
        const { updateInstanceServerConfig } = require('./instanceManager');
        return updateInstanceServerConfig(instanceId, updates);
    }
    catch (e) {
        console.error('Failed to update server config:', e);
        return { success: false, error: e.message };
    }
});
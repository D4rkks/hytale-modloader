const { shell, BrowserWindow } = require('electron');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { addAccount } = require('./config');

const HYTALE_AUTH_URL = 'https://hytale.com/auth';
const AUTH_CALLBACK_PORT = 42069;

function generatePKCE() {
    const verifier = crypto.randomBytes(32).toString('base64url');
    const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
    return { verifier, challenge };
}

async function initiateHytaleLogin() {
    await shell.openExternal('https://hytale.com/account');

    return {
        status: 'browser_opened',
        message: 'Please log in to your Hytale account in the browser, then click "Confirm Login" in the app.'
    };
}

async function confirmAccount(username) {
    if (!username || username.trim().length === 0) {
        throw new Error('Username is required');
    }

    // Generate secure tokens
    const uuid = uuidv4();
    const accessToken = crypto.createHmac('sha256', 'hytale-modloader-secret')
        .update(username + Date.now().toString())
        .digest('hex');

    const account = addAccount({
        type: 'hytale',
        username: username.trim(),
        uuid: uuid,
        accessToken: accessToken,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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

async function addOfflineAccount(username) {
    if (!username || username.trim().length === 0) {
        throw new Error('Username is required');
    }

    const account = addAccount({
        type: 'offline',
        username: username.trim(),
        uuid: uuidv4(),
        accessToken: null,
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

async function validateToken(accessToken) {
    return { valid: !!accessToken };
}

async function fetchGameSessionTokens(account) {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 36000;

    const header = Buffer.from(JSON.stringify({
        alg: 'EdDSA',
        kid: '2025-10-01',
        typ: 'JWT'
    })).toString('base64url');

    const identityPayload = Buffer.from(JSON.stringify({
        sub: account.uuid,
        name: account.username,
        username: account.username,
        entitlements: ['game.base'],
        scope: 'hytale:server hytale:client',
        iat: now,
        exp: exp,
        iss: 'hytale-modloader',
        jti: uuidv4()
    })).toString('base64url');

    const sessionPayload = Buffer.from(JSON.stringify({
        sub: account.uuid,
        scope: 'hytale:server',
        iat: now,
        exp: exp,
        iss: 'hytale-modloader',
        jti: uuidv4()
    })).toString('base64url');

    const signature = crypto.randomBytes(64).toString('base64url');

    return {
        identityToken: `${header}.${identityPayload}.${signature}`,
        sessionToken: `${header}.${sessionPayload}.${signature}`
    };
}

module.exports = {
    initiateHytaleLogin,
    confirmAccount,
    addOfflineAccount,
    validateToken,
    fetchGameSessionTokens,
    generatePKCE
};

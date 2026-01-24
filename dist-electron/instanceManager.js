"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createInstanceWithConfig = createInstanceWithConfig;
exports.addWorldToInstance = addWorldToInstance;
exports.loadInstances = loadInstances;
exports.saveInstances = saveInstances;
exports.createInstance = createInstance;
exports.deleteInstance = deleteInstance;
exports.updateInstance = updateInstance;
exports.getInstance = getInstance;
exports.getInstanceDir = getInstanceDir;
exports.getInstanceWorlds = getInstanceWorlds;
exports.deleteWorld = deleteWorld;
exports.getInstanceServerConfig = getInstanceServerConfig;
exports.updateInstanceServerConfig = updateInstanceServerConfig;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto_1 = require("crypto");
const INSTANCES_FILE = path.join(electron_1.app.getPath('userData'), 'instances.json');
const INSTANCES_DIR = path.join(electron_1.app.getPath('userData'), 'instances');
function createInstanceWithConfig(name, version, worldConfig, options, modEnabledState) {
    const instance = createInstance(name, version, {
        ...options,
        worldName: worldConfig.name || name,
        seed: worldConfig.seed,
        gameMode: worldConfig.gamemode
    });
    const instanceDir = getInstanceDir(instance.id);
    const worldName = sanitizeFileName(worldConfig.name || name);
    const worldsDir = path.join(instanceDir, 'saves');
    const specificWorldDir = path.join(worldsDir, worldName);
    if (!fs.existsSync(specificWorldDir)) {
        fs.mkdirSync(specificWorldDir, { recursive: true });
    }
    const hytaleWorldConfig = {
        "Version": 4,
        "DisplayName": worldConfig.name || name,
        "Seed": worldConfig.seed ? parseSeed(worldConfig.seed) : Date.now(),
        "WorldGen": { "Type": "Hytale", "Name": "Default" },
        "WorldMap": { "Type": "WorldGen" },
        "ChunkStorage": { "Type": "Hytale" },
        "ChunkConfig": {},
        "IsTicking": true,
        "IsBlockTicking": true,
        "IsPvpEnabled": worldConfig.pvpEnabled !== false,
        "IsFallDamageEnabled": worldConfig.fallDamage !== false,
        "IsGameTimePaused": false,
        "GameMode": normalizeGameMode(worldConfig.gamemode),
        "IsSpawningNPC": worldConfig.spawnNPC !== false,
        "IsSpawnMarkersEnabled": true,
        "GameplayConfig": "Default",
        "GameRules": {
            "fallDamage": worldConfig.fallDamage !== false,
            "pvp": worldConfig.pvpEnabled !== false
        },
        "Death": {
            "RespawnController": { "Type": "HomeOrSpawnPoint" },
            "ItemsLossMode": normalizeItemsLossMode(worldConfig.itemsLossMode),
            "ItemsAmountLossPercentage": 50.0,
            "ItemsDurabilityLossPercentage": 10.0
        },
        "IsSavingPlayers": true,
        "IsSavingChunks": true,
        "SaveNewChunks": true,
        "IsUnloadingChunks": true
    };
    fs.writeFileSync(path.join(specificWorldDir, 'config.json'), JSON.stringify(hytaleWorldConfig, null, 2));
    const worldGenDir = path.join(specificWorldDir, 'Default');
    if (!fs.existsSync(worldGenDir)) {
        fs.mkdirSync(worldGenDir, { recursive: true });
    }
    fs.writeFileSync(path.join(worldGenDir, 'World.json'), JSON.stringify(hytaleWorldConfig, null, 2));
    const serverConfig = {
        "Version": 3,
        "ServerName": name,
        "Defaults": {
            "World": worldName,
            "GameMode": normalizeGameMode(worldConfig.gamemode)
        }
    };
    if (modEnabledState && Object.keys(modEnabledState).length > 0) {
        serverConfig.Mods = {};
        for (const [modId, enabled] of Object.entries(modEnabledState)) {
            if (modId && modId.includes(':')) {
                serverConfig.Mods[modId] = { "Enabled": enabled };
            }
        }
        if (Object.keys(serverConfig.Mods).length === 0) {
            delete serverConfig.Mods;
        }
    }
    fs.writeFileSync(path.join(instanceDir, 'config.json'), JSON.stringify(serverConfig, null, 2));
    return { instance, worldPath: specificWorldDir };
}
function addWorldToInstance(instanceId, worldConfig, modEnabledState) {
    const instance = getInstance(instanceId);
    if (!instance)
        return { success: false, error: 'Instance not found' };
    const instanceDir = getInstanceDir(instanceId);
    const worldName = sanitizeFileName(worldConfig.name);
    const worldsDir = path.join(instanceDir, 'saves');
    const specificWorldDir = path.join(worldsDir, worldName);
    if (fs.existsSync(specificWorldDir)) {
        return { success: false, error: 'World already exists' };
    }
    fs.mkdirSync(specificWorldDir, { recursive: true });
    const hytaleWorldConfig = {
        "Version": 4,
        "DisplayName": worldConfig.name,
        "Seed": worldConfig.seed ? parseSeed(worldConfig.seed) : Date.now(),
        "WorldGen": { "Type": "Hytale", "Name": "Default" },
        "WorldMap": { "Type": "WorldGen" },
        "ChunkStorage": { "Type": "Hytale" },
        "ChunkConfig": {},
        "IsTicking": true,
        "IsBlockTicking": true,
        "IsPvpEnabled": worldConfig.pvpEnabled !== false,
        "IsFallDamageEnabled": worldConfig.fallDamage !== false,
        "IsGameTimePaused": false,
        "GameMode": normalizeGameMode(worldConfig.gamemode),
        "IsSpawningNPC": worldConfig.spawnNPC !== false,
        "IsSpawnMarkersEnabled": true,
        "GameplayConfig": "Default",
        "Death": {
            "RespawnController": { "Type": "HomeOrSpawnPoint" },
            "ItemsLossMode": normalizeItemsLossMode(worldConfig.itemsLossMode),
            "ItemsAmountLossPercentage": 50.0,
            "ItemsDurabilityLossPercentage": 10.0
        },
        "IsSavingPlayers": true,
        "IsSavingChunks": true,
        "SaveNewChunks": true,
        "IsUnloadingChunks": true
    };
    fs.writeFileSync(path.join(specificWorldDir, 'config.json'), JSON.stringify(hytaleWorldConfig, null, 2));
    const worldGenDir = path.join(specificWorldDir, 'Default');
    if (!fs.existsSync(worldGenDir)) {
        fs.mkdirSync(worldGenDir, { recursive: true });
    }
    fs.writeFileSync(path.join(worldGenDir, 'World.json'), JSON.stringify(hytaleWorldConfig, null, 2));
    const serverConfigPath = path.join(instanceDir, 'config.json');
    let serverConfig = {};
    if (fs.existsSync(serverConfigPath)) {
        try {
            serverConfig = JSON.parse(fs.readFileSync(serverConfigPath, 'utf-8'));
        }
        catch (e) {  }
    }
    if (!serverConfig.Defaults)
        serverConfig.Defaults = {};
    serverConfig.Version = 3;
    serverConfig.Defaults.World = worldName;
    serverConfig.Defaults.GameMode = normalizeGameMode(worldConfig.gamemode);
    if (modEnabledState && Object.keys(modEnabledState).length > 0) {
        if (!serverConfig.Mods)
            serverConfig.Mods = {};
        for (const [modId, enabled] of Object.entries(modEnabledState)) {
            if (modId && modId.includes(':')) {
                serverConfig.Mods[modId] = { "Enabled": enabled };
            }
        }
    }
    if (serverConfig.Mods) {
        for (const key of Object.keys(serverConfig.Mods)) {
            if (!key.includes(':')) {
                delete serverConfig.Mods[key];
            }
        }
        if (Object.keys(serverConfig.Mods).length === 0) {
            delete serverConfig.Mods;
        }
    }
    fs.writeFileSync(serverConfigPath, JSON.stringify(serverConfig, null, 2));
    return { success: true, worldPath: specificWorldDir };
}
function normalizeGameMode(mode) {
    if (!mode)
        return "Adventure";
    return mode.charAt(0).toUpperCase() + mode.toLowerCase().slice(1);
}
function normalizeDifficulty(diff) {
    if (!diff)
        return "Normal";
    return diff.charAt(0).toUpperCase() + diff.toLowerCase().slice(1);
}
function normalizeItemsLossMode(mode) {
    if (!mode)
        return "All";
    const modeMap = {
        'all': 'All',
        'configured': 'Configured',
        'none': 'None'
    };
    return modeMap[mode.toLowerCase()] || "All";
}
function parseSeed(seed) {
    const num = parseInt(seed);
    if (!isNaN(num)) {
        return num;
    }
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        const char = seed.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}
function sanitizeFileName(name) {
    return name.replace(/[^a-zA-Z0-9\-_]/g, '_');
}
function loadInstances() {
    if (!fs.existsSync(INSTANCES_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(INSTANCES_FILE, 'utf8');
        return JSON.parse(data);
    }
    catch (err) {
        console.error('Failed to load instances:', err);
        return [];
    }
}
function saveInstances(instances) {
    fs.writeFileSync(INSTANCES_FILE, JSON.stringify(instances, null, 2), 'utf8');
}
function createInstance(name, version, options) {
    const instances = loadInstances();
    const id = (0, crypto_1.randomUUID)();
    const newInstance = {
        id,
        name,
        version,
        created: Date.now(),
        icon: options?.icon || 'default',
        ...options
    };
    const instanceDir = path.join(INSTANCES_DIR, id);
    if (!fs.existsSync(instanceDir)) {
        fs.mkdirSync(instanceDir, { recursive: true });
        fs.mkdirSync(path.join(instanceDir, 'mods'), { recursive: true });
        fs.mkdirSync(path.join(instanceDir, 'saves'), { recursive: true });
        fs.mkdirSync(path.join(instanceDir, 'screenshots'), { recursive: true });
    }
    instances.push(newInstance);
    saveInstances(instances);
    return newInstance;
    return newInstance;
}
function deleteInstance(id) {
    const instances = loadInstances();
    const index = instances.findIndex(i => i.id === id);
    if (index === -1)
        return false;
    instances.splice(index, 1);
    saveInstances(instances);
    try {
        const instanceDir = path.join(INSTANCES_DIR, id);
        if (fs.existsSync(instanceDir)) {
            fs.rmSync(instanceDir, { recursive: true, force: true });
        }
    }
    catch (err) {
        console.error(`Failed to delete instance folder for ${id}:`, err);
    }
    return true;
}
function updateInstance(id, updates) {
    const instances = loadInstances();
    const index = instances.findIndex(i => i.id === id);
    if (index === -1)
        return null;
    instances[index] = { ...instances[index], ...updates };
    saveInstances(instances);
    return instances[index];
}
function getInstance(id) {
    const instances = loadInstances();
    return instances.find(i => i.id === id);
}
function getInstanceDir(id) {
    return path.join(INSTANCES_DIR, id);
}
function getInstanceWorlds(id) {
    const instanceDir = getInstanceDir(id);
    const worldsDir = path.join(instanceDir, 'saves');
    if (!fs.existsSync(worldsDir)) {
        return [];
    }
    const worlds = [];
    try {
        const entries = fs.readdirSync(worldsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (['logs', 'mods', 'universe', 'crash-reports', 'bds', 'default'].includes(entry.name.toLowerCase()) && !fs.existsSync(path.join(worldsDir, entry.name, 'config.json')))
                    continue;
                const worldPath = path.join(worldsDir, entry.name);
                const configPath = path.join(worldPath, 'config.json');
                if (!fs.existsSync(configPath)) {
                    continue;
                }
                let seed;
                let createdAt;
                try {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    seed = config.Seed;
                    const stats = fs.statSync(configPath);
                    createdAt = stats.birthtime.toISOString();
                }
                catch (e) {
                }
                worlds.push({
                    name: entry.name,
                    path: worldPath,
                    seed,
                    createdAt
                });
            }
        }
    }
    catch (e) {
        console.error('[InstanceManager] Error reading worlds:', e);
    }
    return worlds;
}
function deleteWorld(instanceId, worldName) {
    const instanceDir = getInstanceDir(instanceId);
    const worldPath = path.join(instanceDir, 'saves', worldName);
    const universeWorldPath = path.join(instanceDir, 'saves', 'universe', 'worlds', worldName);
    let deleted = false;
    if (fs.existsSync(worldPath)) {
        try {
            fs.rmSync(worldPath, { recursive: true, force: true });
            deleted = true;
        }
        catch (e) {
            console.error(`[InstanceManager] Failed to delete world ${worldName} from saves:`, e);
            return { success: false, error: e.message };
        }
    }
    if (fs.existsSync(universeWorldPath)) {
        try {
            fs.rmSync(universeWorldPath, { recursive: true, force: true });
            deleted = true;
        }
        catch (e) {
            console.error(`[InstanceManager] Failed to delete world ${worldName} from universe:`, e);
        }
    }
    if (!deleted) {
        return { success: false, error: 'World not found' };
    }
    return { success: true };
}
function getInstanceServerConfig(instanceId) {
    const instanceDir = getInstanceDir(instanceId);
    const configPath = path.join(instanceDir, 'config.json');
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        catch (e) {
            console.error('Error reading server config:', e);
        }
    }
    return {};
}
function updateInstanceServerConfig(instanceId, updates) {
    const instanceDir = getInstanceDir(instanceId);
    const configPath = path.join(instanceDir, 'config.json');
    try {
        let config = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        const newConfig = { ...config };
        if (updates.Mods) {
            const validModsUpdate = {};
            for (const [key, val] of Object.entries(updates.Mods)) {
                if (key && key.includes(':')) {
                    validModsUpdate[key] = val;
                }
            }
            newConfig.Mods = { ...(config.Mods || {}), ...validModsUpdate };
            for (const key in updates) {
                if (key !== 'Mods') {
                    newConfig[key] = updates[key];
                }
            }
        }
        else {
            Object.assign(newConfig, updates);
        }
        if (newConfig.Mods) {
            for (const key of Object.keys(newConfig.Mods)) {
                if (!key.includes(':')) {
                    delete newConfig.Mods[key];
                }
            }
        }
        fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
        return { success: true };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
}
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

const INSTANCES_FILE = path.join(app.getPath('userData'), 'instances.json');
const INSTANCES_DIR = path.join(app.getPath('userData'), 'instances');

export interface Instance {
    id: string;
    name: string;
    version: string; // Game version
    icon?: string;
    created: number;
    lastPlayed?: number;
    playTime?: number;
    // Settings (MB)
    javaArgs?: string;
    minMemory?: number;
    maxMemory?: number;
    width?: number;
    height?: number;

    // World Config (Persisted in instance for reference)
    worldName?: string;
    seed?: string;
    gameMode?: string;
    difficulty?: string;
}

export function createInstanceWithConfig(
    name: string,
    version: string,
    worldConfig: {
        seed?: string;
        gamemode?: string;
        itemsLossMode?: string;
        fallDamage?: boolean;
        pvpEnabled?: boolean;
        spawnNPC?: boolean;
        name?: string
    },
    options?: Partial<Instance>,
    modEnabledState?: { [modId: string]: boolean }
): { instance: Instance; worldPath: string } {
    // 1. Create basic instance
    const instance = createInstance(name, version, {
        ...options,
        worldName: worldConfig.name || name,
        seed: worldConfig.seed,
        gameMode: worldConfig.gamemode
    });

    const instanceDir = getInstanceDir(instance.id);
    const worldName = sanitizeFileName(worldConfig.name || name);
    // Revert: Create worlds in 'saves/' as server expects this
    const worldsDir = path.join(instanceDir, 'saves');
    const specificWorldDir = path.join(worldsDir, worldName);

    // 2. Create World Directory
    if (!fs.existsSync(specificWorldDir)) {
        fs.mkdirSync(specificWorldDir, { recursive: true });
    }

    // 3. Write World Config (config.json) - Using REAL Hytale fields
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

    fs.writeFileSync(
        path.join(specificWorldDir, 'config.json'),
        JSON.stringify(hytaleWorldConfig, null, 2)
    );

    // Write Default/World.json (Required for settings to be applied in Client)
    const worldGenDir = path.join(specificWorldDir, 'Default');
    if (!fs.existsSync(worldGenDir)) {
        fs.mkdirSync(worldGenDir, { recursive: true });
    }
    fs.writeFileSync(
        path.join(worldGenDir, 'World.json'),
        JSON.stringify(hytaleWorldConfig, null, 2)
    );

    // 4. Write Server Config (config.json) to set default world
    // This allows the server to pick it up immediately if run
    const serverConfig: any = {
        "Version": 3,
        "ServerName": name,
        "Defaults": {
            "World": worldName,
            "GameMode": normalizeGameMode(worldConfig.gamemode)
        }
    };

    // Add Mods section if modEnabledState is provided
    if (modEnabledState && Object.keys(modEnabledState).length > 0) {
        serverConfig.Mods = {};
        for (const [modId, enabled] of Object.entries(modEnabledState)) {
            // Validate format Group:Name to prevent server crash
            if (modId && modId.includes(':')) {
                serverConfig.Mods[modId] = { "Enabled": enabled };
            }
        }
        // If empty, remove Mods key entirely so we don't block all mods
        if (Object.keys(serverConfig.Mods).length === 0) {
            delete serverConfig.Mods;
        }
    }

    fs.writeFileSync(
        path.join(instanceDir, 'config.json'),
        JSON.stringify(serverConfig, null, 2)
    );

    return { instance, worldPath: specificWorldDir };
}

// New function for adding a world to an existing instance
export function addWorldToInstance(
    instanceId: string,
    worldConfig: {
        seed?: string;
        gamemode?: string;
        itemsLossMode?: string;
        fallDamage?: boolean;
        pvpEnabled?: boolean;
        spawnNPC?: boolean;
        name: string
    },
    modEnabledState?: { [modId: string]: boolean }
): { success: boolean; worldPath?: string; error?: string } {
    const instance = getInstance(instanceId);
    if (!instance) return { success: false, error: 'Instance not found' };

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

    fs.writeFileSync(
        path.join(specificWorldDir, 'config.json'),
        JSON.stringify(hytaleWorldConfig, null, 2)
    );

    const worldGenDir = path.join(specificWorldDir, 'Default');
    if (!fs.existsSync(worldGenDir)) {
        fs.mkdirSync(worldGenDir, { recursive: true });
    }
    fs.writeFileSync(
        path.join(worldGenDir, 'World.json'),
        JSON.stringify(hytaleWorldConfig, null, 2)
    );

    const serverConfigPath = path.join(instanceDir, 'config.json');
    let serverConfig: any = {};
    if (fs.existsSync(serverConfigPath)) {
        try {
            serverConfig = JSON.parse(fs.readFileSync(serverConfigPath, 'utf-8'));
        } catch (e) { 
        
         }
    }

    if (!serverConfig.Defaults) serverConfig.Defaults = {};

    serverConfig.Version = 3;

    serverConfig.Defaults.World = worldName;
    serverConfig.Defaults.GameMode = normalizeGameMode(worldConfig.gamemode);

    if (modEnabledState && Object.keys(modEnabledState).length > 0) {
        if (!serverConfig.Mods) serverConfig.Mods = {};
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

function normalizeGameMode(mode?: string): string {
    if (!mode) return "Adventure";
    return mode.charAt(0).toUpperCase() + mode.toLowerCase().slice(1);
}

function normalizeDifficulty(diff?: string): string {
    if (!diff) return "Normal";
    return diff.charAt(0).toUpperCase() + diff.toLowerCase().slice(1);
}

function normalizeItemsLossMode(mode?: string): string {
    if (!mode) return "All";
    const modeMap: { [key: string]: string } = {
        'all': 'All',
        'configured': 'Configured',
        'none': 'None'
    };
    return modeMap[mode.toLowerCase()] || "All";
}

function parseSeed(seed: string): number {
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

function sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9\-_]/g, '_');
}

export function loadInstances(): Instance[] {
    if (!fs.existsSync(INSTANCES_FILE)) {
        return [];
    }
    try {
        const data = fs.readFileSync(INSTANCES_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Failed to load instances:', err);
        return [];
    }
}

export function saveInstances(instances: Instance[]) {
    fs.writeFileSync(INSTANCES_FILE, JSON.stringify(instances, null, 2), 'utf8');
}

export function createInstance(name: string, version: string, options?: Partial<Instance>): Instance {
    const instances = loadInstances();

    const id = randomUUID();
    const newInstance: Instance = {
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

export function deleteInstance(id: string): boolean {
    const instances = loadInstances();
    const index = instances.findIndex(i => i.id === id);

    if (index === -1) return false;

    instances.splice(index, 1);
    saveInstances(instances);

    try {
        const instanceDir = path.join(INSTANCES_DIR, id);
        if (fs.existsSync(instanceDir)) {
            fs.rmSync(instanceDir, { recursive: true, force: true });
        }
    } catch (err) {
        console.error(`Failed to delete instance folder for ${id}:`, err);
    }

    return true;
}

export function updateInstance(id: string, updates: Partial<Instance>): Instance | null {
    const instances = loadInstances();
    const index = instances.findIndex(i => i.id === id);

    if (index === -1) return null;

    instances[index] = { ...instances[index], ...updates };
    saveInstances(instances);
    return instances[index];
}

export function getInstance(id: string): Instance | undefined {
    const instances = loadInstances();
    return instances.find(i => i.id === id);
}

export function getInstanceDir(id: string): string {
    return path.join(INSTANCES_DIR, id);
}

export function getInstanceWorlds(id: string): { name: string, path: string, seed?: number, createdAt?: string }[] {
    const instanceDir = getInstanceDir(id);
    const worldsDir = path.join(instanceDir, 'saves');

    if (!fs.existsSync(worldsDir)) {
        return [];
    }

    const worlds: { name: string, path: string, seed?: number, createdAt?: string }[] = [];

    try {
        const entries = fs.readdirSync(worldsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (['logs', 'mods', 'universe', 'crash-reports', 'bds', 'default'].includes(entry.name.toLowerCase()) && !fs.existsSync(path.join(worldsDir, entry.name, 'config.json'))) {
                }

                if (['universe', 'logs', 'mods'].includes(entry.name.toLowerCase())) continue;

                const worldPath = path.join(worldsDir, entry.name);
                const configPath = path.join(worldPath, 'config.json');
                if (!fs.existsSync(configPath)) {
                    continue;
                }

                let seed: number | undefined;
                let createdAt: string | undefined;

                try {
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                    seed = config.Seed;
                    const stats = fs.statSync(configPath);
                    createdAt = stats.birthtime.toISOString();
                } catch (e) {
                }

                worlds.push({
                    name: entry.name,
                    path: worldPath,
                    seed,
                    createdAt
                });
            }
        }
    } catch (e) {
        console.error('[InstanceManager] Error reading worlds:', e);
    }

    return worlds;
}

export function deleteWorld(instanceId: string, worldName: string): { success: boolean; error?: string } {
    const instanceDir = getInstanceDir(instanceId);
    const worldPath = path.join(instanceDir, 'saves', worldName);
    const universeWorldPath = path.join(instanceDir, 'saves', 'universe', 'worlds', worldName);

    let deleted = false;

    if (fs.existsSync(worldPath)) {
        try {
            fs.rmSync(worldPath, { recursive: true, force: true });
            deleted = true;
        } catch (e: any) {
            console.error(`[InstanceManager] Failed to delete world ${worldName} from saves:`, e);
            return { success: false, error: e.message };
        }
    }

    if (fs.existsSync(universeWorldPath)) {
        try {
            fs.rmSync(universeWorldPath, { recursive: true, force: true });
            deleted = true;
        } catch (e: any) {
            console.error(`[InstanceManager] Failed to delete world ${worldName} from universe:`, e);
        }
    }

    if (!deleted) {
        return { success: false, error: 'World not found' };
    }

    return { success: true };
}

export function getInstanceServerConfig(instanceId: string): any {
    const instanceDir = getInstanceDir(instanceId);
    const configPath = path.join(instanceDir, 'config.json');
    if (fs.existsSync(configPath)) {
        try {
            return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        } catch (e) {
            console.error('Error reading server config:', e);
        }
    }
    return {};
}

export function updateInstanceServerConfig(instanceId: string, updates: any): { success: boolean; error?: string } {
    const instanceDir = getInstanceDir(instanceId);
    const configPath = path.join(instanceDir, 'config.json');
    try {
        let config: any = {};
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }

        const newConfig = { ...config };

        if (updates.Mods) {
            const validModsUpdate: any = {};
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
        } else {
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
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

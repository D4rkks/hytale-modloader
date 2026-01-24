import { useState } from 'react';

function ModManager() {
    const [searchTerm, setSearchTerm] = useState('');
    const [mods, setMods] = useState<any[]>([
        { id: 1, name: 'OptiFine-like (Performance)', author: 'Community', enabled: true },
        { id: 2, name: 'Minimap', author: 'MapDev', enabled: false },
        { id: 3, name: 'JEI-like (Items)', author: 'ItemDev', enabled: true },
    ]);

    const filteredMods = mods.filter(mod =>
        mod.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleMod = (id: number) => {
        setMods(mods.map(mod =>
            mod.id === id ? { ...mod, enabled: !mod.enabled } : mod
        ));
    };

    return (
        <div className="mod-manager fade-in">
            <div className="mod-header" style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <input
                    type="text"
                    placeholder="Search mods..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                        flex: 1,
                        padding: '10px',
                        borderRadius: '6px',
                        border: '1px solid #444',
                        background: '#1a1a1a',
                        color: 'white'
                    }}
                />
                <button style={{
                    padding: '10px 20px',
                    background: 'var(--accent)',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 'bold',
                    cursor: 'pointer'
                }}>
                    Install New
                </button>
            </div>

            <div className="mod-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {filteredMods.map(mod => (
                    <div key={mod.id} className="mod-item" style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: 'var(--bg-secondary)',
                        padding: '15px',
                        borderRadius: '8px',
                        border: 'var(--glass-border)'
                    }}>
                        <div>
                            <h4 style={{ margin: 0, color: 'white' }}>{mod.name}</h4>
                            <small style={{ color: 'var(--text-secondary)' }}>by {mod.author}</small>
                        </div>
                        <label className="switch">
                            <input
                                type="checkbox"
                                checked={mod.enabled}
                                onChange={() => toggleMod(mod.id)}
                            />
                            <span className="slider">
                                {mod.enabled ? 'ON' : 'OFF'}
                            </span>
                        </label>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default ModManager;

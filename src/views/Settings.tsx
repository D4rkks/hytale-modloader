import React from 'react';
import { Save, RotateCcw, Cpu, Monitor, ChevronDown } from 'lucide-react';

const SettingsView: React.FC = () => {
    const [config, setConfig] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);

    const [maxMemory, setMaxMemory] = React.useState(4096);
    const [fpsLimit, setFpsLimit] = React.useState('unlimited');
    const [isFpsOpen, setIsFpsOpen] = React.useState(false);
    const [visuals, setVisuals] = React.useState({
        hardwareAcceleration: true,
        borderless: true,
        textureOptimization: false,
        manaEffects: true
    });

    React.useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        setLoading(true);
        const electron = (window as any).electronAPI;
        if (electron && electron.getConfig) {
            try {
                const cfg = await electron.getConfig();
                if (cfg) {
                    setConfig(cfg);
                    if (cfg.gameSettings) {
                        setMaxMemory(cfg.gameSettings.maxMemory || 4096);
                    }
                    if (cfg.launcherSettings) {
                        setVisuals({
                            hardwareAcceleration: cfg.launcherSettings.hardwareAcceleration ?? true,
                            borderless: cfg.launcherSettings.borderless ?? true,
                            textureOptimization: cfg.launcherSettings.textureOptimization ?? false,
                            manaEffects: cfg.launcherSettings.manaEffects ?? true
                        });
                    }
                }
            } catch (e) {
                console.error("Error loading config", e);
            }
        }
        setLoading(false);
    };

    const handleSave = async () => {
        setSaving(true);
        const electron = (window as any).electronAPI;
        if (electron && electron.saveConfig) {
            try {
                const newConfig = {
                    ...config,
                    gameSettings: {
                        ...(config?.gameSettings || {}),
                        maxMemory: maxMemory,
                        minMemory: 1024,
                    },
                    launcherSettings: {
                        hardwareAcceleration: visuals.hardwareAcceleration,
                        borderless: visuals.borderless,
                        textureOptimization: visuals.textureOptimization,
                        manaEffects: visuals.manaEffects
                    }
                };
                await electron.saveConfig(newConfig);
            } catch (e) {
                console.error("Failed to save", e);
            }
        }
        setTimeout(() => setSaving(false), 500);
    };

    const toggleVisual = (key: keyof typeof visuals) => {
        setVisuals(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (loading) return <div className="p-12 text-center text-white/50">Carregando configurações...</div>;

    return (
        <div className="h-full flex flex-col animate-in slide-in-from-right-6 duration-700">
            <div className="orbis-panel flex-1 rounded-lg flex flex-col overflow-hidden">
                <div className="p-8 border-b border-white/5 bg-black/20">
                    <h2 className="text-lg font-black text-white uppercase tracking-widest">Configurações do Cliente</h2>
                </div>

                <div className="flex-1 p-12 overflow-y-auto space-y-12 custom-scrollbar">
                    <section className="space-y-6">
                        <div className="flex items-center gap-3 border-l-4 border-hytale-accent pl-4">
                            <Cpu className="w-5 h-5 text-hytale-accent" />
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Performance e Alocação</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Memória RAM Alocada</label>
                                <div className="relative h-2 bg-black/40 rounded-full border border-white/5">
                                    <div className="absolute inset-y-0 left-0 bg-hytale-accent rounded-full transition-all" style={{ width: `${(maxMemory / 16384) * 100}%` }}></div>
                                    <input
                                        type="range"
                                        className="absolute inset-0 w-full opacity-0 cursor-pointer"
                                        min="1024"
                                        max="16384"
                                        step="512"
                                        value={maxMemory}
                                        onChange={(e) => setMaxMemory(parseInt(e.target.value))}
                                    />
                                </div>
                                <div className="flex justify-between text-[10px] font-bold text-white/20">
                                    <span>1 GB</span>
                                    <span className="text-hytale-accent">{(maxMemory / 1024).toFixed(1)} GB</span>
                                    <span>16 GB</span>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Limite de FPS</label>
                                <div className="relative">
                                    <button
                                        onClick={() => setIsFpsOpen(!isFpsOpen)}
                                        className="w-full bg-black/40 border border-white/10 p-3 rounded text-sm text-white focus:outline-none focus:border-hytale-accent transition-all flex items-center justify-between"
                                    >
                                        <span className="font-bold">{fpsLimit === 'unlimited' ? 'Ilimitado' : `${fpsLimit} FPS`}</span>
                                        <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${isFpsOpen ? 'rotate-180' : ''}`} />
                                    </button>

                                    {isFpsOpen && (
                                        <div className="absolute top-full left-0 right-0 mt-2 z-[60] bg-[#0a0f16] border border-white/10 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                            {[
                                                { value: 'unlimited', label: 'Ilimitado' },
                                                { value: '60', label: '60 FPS' },
                                                { value: '144', label: '144 FPS' },
                                                { value: '240', label: '240 FPS' }
                                            ].map((opt) => (
                                                <div
                                                    key={opt.value}
                                                    onClick={() => {
                                                        setFpsLimit(opt.value);
                                                        setIsFpsOpen(false);
                                                    }}
                                                    className={`p-3 text-sm font-bold cursor-pointer hover:bg-white/5 transition-colors ${fpsLimit === opt.value ? 'text-hytale-accent bg-hytale-accent/5' : 'text-white/60'}`}
                                                >
                                                    {opt.label}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <div className="flex items-center gap-3 border-l-4 border-hytale-mana pl-4">
                            <Monitor className="w-5 h-5 text-hytale-mana" />
                            <h3 className="text-sm font-black text-white uppercase tracking-widest">Ajustes Visuais</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {[
                                { key: 'hardwareAcceleration', label: 'Aceleração de Hardware', desc: 'Melhora a suavidade da interface usando GPU.' },
                                { key: 'borderless', label: 'Modo Janela Sem Bordas', desc: 'Permite alt-tab rápido sem interrupções.' },
                                { key: 'textureOptimization', label: 'Otimização de Texturas', desc: 'Reduz o uso de VRAM em sistemas de entrada.' },
                                { key: 'manaEffects', label: 'Efeitos de Mana', desc: 'Habilita o brilho místico nos botões do client.' },
                            ].map((opt, i) => (
                                <div key={i} className="flex items-center justify-between p-5 bg-black/20 rounded border border-white/5 hover:border-white/10 transition-all">
                                    <div>
                                        <p className="text-xs font-black text-white uppercase tracking-widest mb-1">{opt.label}</p>
                                        <p className="text-[10px] text-white/30 font-medium italic">{opt.desc}</p>
                                    </div>
                                    <div
                                        className={`w-12 h-6 rounded-full relative cursor-pointer transition-all ${visuals[opt.key as keyof typeof visuals] ? 'bg-hytale-accent' : 'bg-white/10'}`}
                                        onClick={() => toggleVisual(opt.key as keyof typeof visuals)}
                                    >
                                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${visuals[opt.key as keyof typeof visuals] ? 'right-1' : 'left-1'}`}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <div className="p-8 bg-black/40 border-t border-white/5 flex justify-end gap-4">
                    <button className="flex items-center gap-2 px-8 py-4 text-white/40 font-black uppercase tracking-widest text-[10px] hover:text-white transition-all">
                        <RotateCcw className="w-4 h-4" /> Redefinir
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-hytale-accent text-black px-12 py-4 rounded font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all flex items-center gap-3 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {saving ? 'Gravando...' : 'Gravar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;

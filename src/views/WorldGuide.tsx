import { useState, useEffect } from 'react';
import { ArrowRight, ArrowLeft, Check, Box, Globe, Settings, Package, Play, User, ChevronDown, ChevronUp } from 'lucide-react';
import { instanceIcons } from '../utils/instanceIcons';
import WorldList from '../components/WorldList';

interface Mod {
    id: string;
    name: string;
    icon?: string;
    source: string;
    fileName?: string;
}

const STEPS = [
    { number: 1, title: 'Básico', icon: Box },
    { number: 2, title: 'Mundo', icon: Globe },
    { number: 3, title: 'Mods', icon: Package },
    { number: 4, title: 'Revisão', icon: Check },
];

interface WorldGuideProps {
    onInstanceCreated?: () => void;
    activeInstanceId?: string | null;
    onLaunch?: (identifier: string | { instanceId: string, worldName?: string }) => void;
    onInstanceSelect?: (id: string) => void;
}

export default function WorldGuide({ onInstanceCreated, activeInstanceId, onLaunch, onInstanceSelect }: WorldGuideProps) {
    const [currentStep, setCurrentStep] = useState(1);
    const [isCreating, setIsCreating] = useState(false);

    const [creationMode, setCreationMode] = useState<'new_instance' | 'add_to_instance'>(activeInstanceId ? 'add_to_instance' : 'new_instance');
    const [showWorldList, setShowWorldList] = useState(false);
    const [hasExistingWorlds, setHasExistingWorlds] = useState(false);

    useEffect(() => {
        if (activeInstanceId) {
            setCreationMode('add_to_instance');
        }
    }, [activeInstanceId]);

    useEffect(() => {
        if (activeInstanceId) {
            const checkWorlds = async () => {
                const api = (window as any).electronAPI;
                if (api?.getInstanceWorlds) {
                    try {
                        const worlds = await api.getInstanceWorlds(activeInstanceId);
                        if (worlds && worlds.length > 0) {
                            setHasExistingWorlds(true);
                            setShowWorldList(true);
                        } else {
                            setHasExistingWorlds(false);
                            setShowWorldList(false);
                        }
                    } catch (e) {
                        console.error("Failed to check worlds", e);
                        setHasExistingWorlds(false);
                        setShowWorldList(false);
                    }
                }
            };
            checkWorlds();
        } else {
            setHasExistingWorlds(false);
            setShowWorldList(false);
        }
    }, [activeInstanceId]);

    const [formData, setFormData] = useState({
        name: '',
        icon: 'box',
        version: 'latest',

        seed: '',
        gamemode: 'adventure',
        itemsLossMode: 'all',
        fallDamage: true,
        pvpEnabled: true,
        spawnNPC: true,
        fullscreen: false
    });

    const [selectedMods, setSelectedMods] = useState<Mod[]>([]);
    const [modEnabledState, setModEnabledState] = useState<{ [modId: string]: boolean }>({});
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [instances, setInstances] = useState<any[]>([]);
    const [sourceInstanceId, setSourceInstanceId] = useState<string>("");
    const [availableMods, setAvailableMods] = useState<any[]>([]);
    const [isLoadingMods, setIsLoadingMods] = useState(false);

    useEffect(() => {
        const load = async () => {
            const api = (window as any).electronAPI;
            if (api?.getInstances) {
                const list = await api.getInstances();
                setInstances(list || []);
                if (list && list.length > 0) {
                    setSourceInstanceId(list[0].id);
                }
            }
        };
        load();
    }, []);

    useEffect(() => {
        const targetId = creationMode === 'new_instance' ? sourceInstanceId : activeInstanceId;

        if (!targetId) {
            setAvailableMods([]);
            return;
        }

        const fetchMods = async () => {
            setIsLoadingMods(true);
            try {
                const api = (window as any).electronAPI;
                if (api?.getInstanceMods) {
                    const res = await api.getInstanceMods(targetId);
                    setAvailableMods(res.mods || []);
                }
            } catch (e) {
                console.error("Failed to fetch mods", e);
            } finally {
                setIsLoadingMods(false);
            }
        };
        fetchMods();
    }, [sourceInstanceId, activeInstanceId, creationMode]);

    const handleNext = () => {
        if (currentStep < 4) setCurrentStep(c => c + 1);
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(c => c - 1);
        } else if (currentStep === 1 && hasExistingWorlds) {
            setShowWorldList(true);
        }
    };

    const handleCreate = async () => {
        setIsCreating(true);
        try {
            const payload = {
                targetInstanceId: creationMode === 'add_to_instance' ? activeInstanceId : null,
                name: formData.name,
                icon: formData.icon,
                version: formData.version,
                worldConfig: {
                    name: formData.name,
                    seed: formData.seed,
                    gamemode: formData.gamemode,
                    itemsLossMode: formData.itemsLossMode,
                    fallDamage: formData.fallDamage,
                    pvpEnabled: formData.pvpEnabled,
                    spawnNPC: formData.spawnNPC
                },
                modEnabledState: modEnabledState,
                mods: [] as any[]
            };

            const api = (window as any).electronAPI;
            if (api?.createComplexInstance) {
                const result = await api.createComplexInstance(payload);
                if (result.success && result.instanceId) {

                    if (creationMode === 'new_instance' && selectedMods.length > 0 && sourceInstanceId && api.copyInstanceMods) {
                        try {
                            const modFiles = selectedMods.map(m => m.fileName).filter(Boolean);
                            await api.copyInstanceMods(sourceInstanceId, result.instanceId, modFiles);
                        } catch (modErr) {
                            console.error("Failed to copy mods", modErr);
                        }
                    }

                    setSuccessMessage('Mundo criado com sucesso!');
                    setTimeout(() => setSuccessMessage(null), 3000);

                    if (onInstanceCreated) {
                        onInstanceCreated();
                    }

                    setTimeout(() => {
                        setShowWorldList(true);
                        setCurrentStep(1);
                        setFormData(prev => ({ ...prev, name: '', seed: '' }));
                    }, 1500);

                } else {
                    setErrorMessage('Erro ao criar mundo: ' + (result.error || 'Erro desconhecido'));
                    setTimeout(() => setErrorMessage(null), 5000);
                }
            } else {
                console.error("API createComplexInstance not found");
            }
        } catch (e) {
            console.error("Creation failed", e);
            setErrorMessage('Erro fatal ao criar mundo.');
            setTimeout(() => setErrorMessage(null), 5000);
        } finally {
            setIsCreating(false);
        }
    };

    if (showWorldList && activeInstanceId) {
        return (
            <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
                <div className="flex items-center justify-between pb-6 border-b border-white/5">
                    <div>
                        <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Meus <span className="text-hytale-accent">Mundos</span></h2>
                        <p className="text-white/30 text-xs font-bold uppercase tracking-widest mt-1">Gerencie suas aventuras salvas</p>
                    </div>
                </div>

                <div className="flex-1 flex flex-col space-y-6 min-h-0">
                    <div>
                        <label className="text-xs font-black text-white/60 uppercase tracking-widest mb-2 block">Instância Selecionada</label>
                        <InstanceSelector
                            instances={instances}
                            selectedId={activeInstanceId || null}
                            onSelect={(id) => onInstanceSelect && onInstanceSelect(id)}
                        />
                    </div>

                    <div className="flex-1 bg-[#0a0f16]/60 border border-white/10 rounded-2xl p-6 overflow-y-auto custom-scrollbar relative">
                        <WorldList
                            instanceId={activeInstanceId}
                            onSelectWorld={(world) => { console.log('Selected world', world); }}
                            onPlay={(world) => {
                                if (onLaunch && activeInstanceId) {
                                    onLaunch({ instanceId: activeInstanceId, worldName: world.name } as any);
                                }
                            }}
                            onCreateWorld={() => setShowWorldList(false)}
                        />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
            {errorMessage && (
                <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-red-500/90 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-top duration-300">
                    <Settings className="w-5 h-5" />
                    <span className="font-medium">{errorMessage}</span>
                    <button onClick={() => setErrorMessage(null)} className="ml-2 hover:opacity-70">✕</button>
                </div>
            )}
            {successMessage && (
                <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 bg-green-500/90 text-white px-6 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-top duration-300">
                    <Check className="w-5 h-5" />
                    <span className="font-medium">{successMessage}</span>
                </div>
            )}
            <div className="flex items-center justify-between pb-6 border-b border-white/5">
                <div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Guia de <span className="text-hytale-accent">Mundos</span></h2>
                    <p className="text-white/30 text-xs font-bold uppercase tracking-widest mt-1">Crie sua própria aventura em Orbis</p>
                </div>
            </div>

            <div className="flex items-center justify-center gap-4">
                {STEPS.map((step, idx) => {
                    const isActive = currentStep >= step.number;
                    const isCompleted = currentStep > step.number;
                    const StepIcon = step.icon;

                    return (
                        <div key={step.number} className="flex items-center gap-2">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-black transition-all ${isActive
                                ? 'bg-hytale-accent border-hytale-accent text-black shadow-[0_0_15px_rgba(245,184,65,0.4)]'
                                : 'bg-transparent border-white/10 text-white/20'
                                }`}>
                                {isCompleted ? <Check className="w-5 h-5" /> : step.number}
                            </div>
                            <span className={`text-[10px] font-bold uppercase tracking-widest ${isActive ? 'text-white' : 'text-white/20'
                                }`}>
                                {step.title}
                            </span>
                            {idx < STEPS.length - 1 && (
                                <div className="w-12 h-0.5 bg-white/5 mx-2" />
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="flex-1 bg-[#0a0f16]/60 border border-white/10 rounded-2xl p-8 overflow-y-auto custom-scrollbar relative">

                {currentStep === 1 && (
                    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">

                        <div className="grid grid-cols-2 p-1 bg-black/40 rounded-xl border border-white/10">
                            <button
                                onClick={() => setCreationMode('new_instance')}
                                className={`py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${creationMode === 'new_instance' ? 'bg-hytale-accent text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                            >
                                Nova Instância
                            </button>
                            <button
                                onClick={() => {
                                    setCreationMode('add_to_instance');
                                    if (!activeInstanceId && instances.length > 0 && onInstanceSelect) onInstanceSelect(instances[0].id);
                                }}
                                className={`py-3 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${creationMode === 'add_to_instance' ? 'bg-hytale-accent text-black shadow-lg' : 'text-white/40 hover:text-white'}`}
                            >
                                Adicionar a Existente
                            </button>
                        </div>

                        {creationMode === 'add_to_instance' ? (
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <label className="text-xs font-black text-white/60 uppercase tracking-widest">Selecione a Instância</label>
                                    <InstanceSelector
                                        instances={instances}
                                        selectedId={activeInstanceId || null}
                                        onSelect={(id) => onInstanceSelect && onInstanceSelect(id)}
                                    />
                                    {hasExistingWorlds && activeInstanceId && (
                                        <button
                                            onClick={() => setShowWorldList(true)}
                                            className="w-full mt-4 py-3 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold uppercase tracking-widest text-hytale-accent flex items-center justify-center gap-2 transition-all border border-white/5"
                                        >
                                            <ArrowLeft className="w-3 h-3" /> Ver mundos existentes
                                        </button>
                                    )}
                                </div>
                                {(!showWorldList || !activeInstanceId) && (
                                    <div className="space-y-4 pt-4 animate-in fade-in">
                                        <label className="text-xs font-black text-white/60 uppercase tracking-widest">Nome do Mundo</label>
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Minha Nova Aventura"
                                            className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white focus:outline-none focus:border-hytale-accent transition-all font-bold text-lg"
                                        />
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-8 animate-in fade-in">
                                <div className="space-y-4">
                                    <label className="text-xs font-black text-white/60 uppercase tracking-widest">Nome da Instância</label>
                                    <input
                                        type="text"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Minha Nova Instância"
                                        className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white focus:outline-none focus:border-hytale-accent transition-all font-bold text-lg"
                                    />
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-black text-white/60 uppercase tracking-widest">Ícone</label>
                                    <div className="grid grid-cols-6 gap-3">
                                        {Object.entries(instanceIcons).map(([key, Icon]) => (
                                            <button
                                                key={key}
                                                onClick={() => setFormData({ ...formData, icon: key })}
                                                className={`aspect-square rounded-xl flex items-center justify-center transition-all ${formData.icon === key
                                                    ? 'bg-hytale-accent text-black ring-2 ring-hytale-accent/30 scale-105'
                                                    : 'bg-white/5 text-white/20 hover:bg-white/10 hover:text-white'
                                                    }`}
                                            >
                                                <Icon className="w-6 h-6" />
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-xs font-black text-white/60 uppercase tracking-widest">Versão do Jogo</label>
                                    <select
                                        value={formData.version}
                                        onChange={e => setFormData({ ...formData, version: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white focus:outline-none focus:border-hytale-accent transition-all font-bold"
                                    >
                                        <option value="latest">Latest Release (Recomendado)</option>
                                        <option value="stable">Stable Release</option>
                                    </select>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {currentStep === 2 && (
                    <div className="space-y-8 max-w-2xl mx-auto animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="space-y-4">
                            <label className="text-xs font-black text-white/60 uppercase tracking-widest">Seed do Mundo (Opcional)</label>
                            <input
                                type="text"
                                value={formData.seed}
                                onChange={e => setFormData({ ...formData, seed: e.target.value })}
                                placeholder="Deixe em branco para aleatório"
                                className="w-full bg-black/40 border border-white/10 p-4 rounded-xl text-white focus:outline-none focus:border-hytale-accent transition-all font-bold"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <label className="text-xs font-black text-white/60 uppercase tracking-widest">Modo de Jogo</label>
                                <div className="space-y-2">
                                    {[
                                        { value: 'adventure', label: 'Exploration', desc: 'Explore o mundo livremente' },
                                        { value: 'creative', label: 'Creative', desc: 'Recursos infinitos e voo' }
                                    ].map(mode => (
                                        <button
                                            key={mode.value}
                                            onClick={() => setFormData({ ...formData, gamemode: mode.value })}
                                            className={`w-full p-4 rounded-xl text-left transition-all border ${formData.gamemode === mode.value
                                                ? 'bg-hytale-accent/10 border-hytale-accent text-hytale-accent'
                                                : 'bg-black/20 border-white/5 text-white/40 hover:bg-white/5'
                                                }`}
                                        >
                                            <span className="text-sm font-black uppercase tracking-wide block">{mode.label}</span>
                                            <span className="text-[10px] opacity-60">{mode.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="text-xs font-black text-white/60 uppercase tracking-widest">Ao Morrer</label>
                                <div className="space-y-2">
                                    {[
                                        { value: 'all', label: 'Perder Tudo', desc: 'Perde todos os itens' },
                                        { value: 'configured', label: 'Parcial', desc: 'Perde parte dos itens' },
                                        { value: 'none', label: 'Manter Tudo', desc: 'Não perde itens' }
                                    ].map(mode => (
                                        <button
                                            key={mode.value}
                                            onClick={() => setFormData({ ...formData, itemsLossMode: mode.value })}
                                            className={`w-full p-4 rounded-xl text-left transition-all border ${formData.itemsLossMode === mode.value
                                                ? 'bg-hytale-accent/10 border-hytale-accent text-hytale-accent'
                                                : 'bg-black/20 border-white/5 text-white/40 hover:bg-white/5'
                                                }`}
                                        >
                                            <span className="text-sm font-black uppercase tracking-wide block">{mode.label}</span>
                                            <span className="text-[10px] opacity-60">{mode.desc}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div
                                onClick={() => setFormData({ ...formData, fallDamage: !formData.fallDamage })}
                                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${formData.fallDamage ? 'bg-hytale-accent/10 border-hytale-accent' : 'bg-black/20 border-white/5'}`}
                            >
                                <div className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${formData.fallDamage ? 'bg-hytale-accent border-hytale-accent' : 'border-white/20'}`}>
                                    {formData.fallDamage && <Check className="w-4 h-4 text-black" />}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Dano de Queda</h4>
                                    <p className="text-xs text-white/40">Leva dano ao cair de altura</p>
                                </div>
                            </div>

                            <div
                                onClick={() => setFormData({ ...formData, pvpEnabled: !formData.pvpEnabled })}
                                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${formData.pvpEnabled ? 'bg-hytale-accent/10 border-hytale-accent' : 'bg-black/20 border-white/5'}`}
                            >
                                <div className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${formData.pvpEnabled ? 'bg-hytale-accent border-hytale-accent' : 'border-white/20'}`}>
                                    {formData.pvpEnabled && <Check className="w-4 h-4 text-black" />}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">PvP</h4>
                                    <p className="text-xs text-white/40">Jogadores podem se atacar</p>
                                </div>
                            </div>

                            <div
                                onClick={() => setFormData({ ...formData, spawnNPC: !formData.spawnNPC })}
                                className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${formData.spawnNPC ? 'bg-hytale-accent/10 border-hytale-accent' : 'bg-black/20 border-white/5'}`}
                            >
                                <div className={`w-6 h-6 rounded flex items-center justify-center border transition-all ${formData.spawnNPC ? 'bg-hytale-accent border-hytale-accent' : 'border-white/20'}`}>
                                    {formData.spawnNPC && <Check className="w-4 h-4 text-black" />}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Spawn de NPCs</h4>
                                    <p className="text-xs text-white/40">Criaturas aparecem no mundo</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentStep === 3 && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center mb-6">
                            <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Mods do Mundo</h3>
                            <p className="text-white/40 font-bold uppercase tracking-wide text-xs">
                                {creationMode === 'add_to_instance' ? "Estes mods já estão instalados na instância selecionada." : "Selecione mods de outras instâncias para copiar."}
                            </p>
                        </div>

                        {creationMode === 'new_instance' && (
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Copiar de:</label>
                                <select
                                    value={sourceInstanceId}
                                    onChange={(e) => setSourceInstanceId(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-xs font-bold text-white uppercase tracking-wide focus:outline-none focus:border-hytale-accent"
                                >
                                    {instances.length === 0 && <option value="">Nenhuma instância encontrada</option>}
                                    {instances.map(inst => (
                                        <option key={inst.id} value={inst.id}>{inst.name} ({inst.version})</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="h-[300px] overflow-y-auto custom-scrollbar border border-white/5 rounded-xl bg-black/20 p-2">
                            {isLoadingMods ? (
                                <div className="flex items-center justify-center h-full text-white/20 text-xs italic">Carregando mods...</div>
                            ) : availableMods.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-white/20 text-xs italic">Nenhum mod encontrado.</div>
                            ) : (
                                <div className="space-y-1">
                                    {availableMods.map((mod: any) => {
                                        const modId = mod.id || mod.fileName;
                                        const isEnabled = modEnabledState[modId] !== false;
                                        const isSelected = creationMode === 'add_to_instance' ? true : selectedMods.some(m => m.fileName === mod.fileName);

                                        return (
                                            <div key={mod.fileName} className={`p-3 rounded-lg border flex items-center justify-between transition-all ${isEnabled ? 'bg-hytale-accent/5 border-hytale-accent/30' : 'bg-black/30 border-white/5'}`}>
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <div className="w-8 h-8 rounded bg-black/40 flex items-center justify-center">
                                                        <Box className={`w-4 h-4 ${isEnabled ? 'text-hytale-accent' : 'text-white/20'}`} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className={`text-xs font-black uppercase tracking-wide truncate ${isEnabled ? 'text-white' : 'text-white/40'}`}>{mod.name}</p>
                                                        <p className="text-[9px] text-white/30 truncate">{mod.fileName}</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setModEnabledState(prev => ({
                                                                ...prev,
                                                                [modId]: !isEnabled
                                                            }));
                                                        }}
                                                        className={`relative w-12 h-6 rounded-full transition-all ${isEnabled ? 'bg-hytale-accent' : 'bg-white/10'}`}
                                                    >
                                                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${isEnabled ? 'left-7' : 'left-1'}`} />
                                                    </button>
                                                    {creationMode === 'new_instance' && (
                                                        <button
                                                            onClick={() => {
                                                                if (isSelected) {
                                                                    setSelectedMods(prev => prev.filter(m => m.fileName !== mod.fileName));
                                                                } else {
                                                                    setSelectedMods(prev => [...prev, mod]);
                                                                }
                                                            }}
                                                            className={`px-3 py-1.5 rounded text-[9px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black' : 'bg-white/10 text-white hover:bg-hytale-accent hover:text-black'}`}
                                                        >
                                                            {isSelected ? 'Remover' : 'Adicionar'}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {currentStep === 4 && (
                    <div className="max-w-xl mx-auto space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center space-y-2">
                            <div className="w-20 h-20 bg-hytale-accent/20 text-hytale-accent rounded-full flex items-center justify-center mx-auto mb-4 border border-hytale-accent/50">
                                {(() => {
                                    const Icon = instanceIcons[formData.icon] || Box;
                                    return <Icon className="w-10 h-10" />;
                                })()}
                            </div>
                            <h3 className="text-2xl font-black text-white uppercase tracking-tight">{formData.name}</h3>
                            <p className="text-white/40 font-bold">{formData.version} • {formData.gamemode}</p>
                        </div>

                        <div className="bg-black/20 rounded-xl border border-white/5 p-6 space-y-4">
                            <h4 className="text-xs font-black text-white/40 uppercase tracking-widest border-b border-white/5 pb-2">Resumo da Configuração</h4>
                            <div className="grid grid-cols-2 gap-y-4 text-sm">
                                <div className="text-white/40">Seed</div>
                                <div className="text-white font-mono text-right">{formData.seed || 'Aleatória'}</div>

                                <div className="text-white/40">Ao Morrer</div>
                                <div className="text-white text-right capitalize">{formData.itemsLossMode === 'all' ? 'Perder Tudo' : formData.itemsLossMode === 'configured' ? 'Parcial' : 'Manter'}</div>

                                <div className="text-white/40">Dano de Queda</div>
                                <div className="text-white text-right">{formData.fallDamage ? 'Ativado' : 'Desativado'}</div>

                                <div className="text-white/40">PvP</div>
                                <div className="text-white text-right">{formData.pvpEnabled ? 'Ativado' : 'Desativado'}</div>

                                <div className="text-white/40">Spawn de NPCs</div>
                                <div className="text-white text-right">{formData.spawnNPC ? 'Ativado' : 'Desativado'}</div>

                                <div className="text-white/40">{creationMode === 'add_to_instance' ? 'Mods Ativos' : 'Mods Selecionados Ativos'}</div>
                                <div className="text-white text-right">
                                    {(() => {
                                        const modsToCheck = creationMode === 'add_to_instance' ? availableMods : selectedMods;
                                        const activeCount = modsToCheck.filter((m: any) => {
                                            const modId = m.id || m.fileName;
                                            return modEnabledState[modId] !== false;
                                        }).length;
                                        return `${activeCount} / ${modsToCheck.length} mods`;
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between pt-6 border-t border-white/5">
                <button
                    onClick={handleBack}
                    disabled={(currentStep === 1 && !hasExistingWorlds) || isCreating}
                    className="px-6 py-3 rounded-lg text-white/40 hover:text-white font-bold uppercase tracking-widest text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>

                {currentStep < 4 ? (
                    <button
                        onClick={handleNext}
                        disabled={!formData.name}
                        className="px-8 py-3 bg-white/10 hover:bg-white/20 text-white rounded-lg font-black uppercase tracking-widest text-xs flex items-center gap-2 transition-all disabled:opacity-50"
                    >
                        Próximo <ArrowRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        onClick={handleCreate}
                        disabled={isCreating}
                        className="px-10 py-4 bg-hytale-accent text-black rounded-lg font-black uppercase tracking-widest text-xs flex items-center gap-2 hover:brightness-110 transition-all shadow-[0_0_20px_rgba(245,184,65,0.3)] disabled:scale-95 disabled:opacity-80"
                    >
                        {isCreating ? 'Criando Mundo...' : 'Criar Mundo e Jogar'} {isCreating && <Play className="w-4 h-4 animate-spin" />}
                    </button>
                )}
            </div>
        </div >
    );
}

function InstanceSelector({ instances, selectedId, onSelect }: { instances: any[], selectedId: string | null, onSelect: (id: string) => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const selectedInstance = instances.find(i => i.id === selectedId);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full p-3 rounded-xl border flex items-center justify-between transition-all ${selectedId
                    ? 'bg-hytale-accent/10 border-hytale-accent/50'
                    : 'bg-black/40 border-white/10 hover:border-white/30'
                    }`}
            >
                {selectedInstance ? (
                    <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${selectedId ? 'bg-hytale-accent text-black' : 'bg-white/10 text-white'}`}>
                            {(() => {
                                const Icon = instanceIcons[selectedInstance.icon || 'box'] || Box;
                                return <Icon className="w-4 h-4" />;
                            })()}
                        </div>
                        <div className="text-left">
                            <div className={`text-xs font-black uppercase tracking-wide ${selectedId ? 'text-hytale-accent' : 'text-white'}`}>
                                {selectedInstance.name}
                            </div>
                            <div className="text-[9px] font-bold opacity-50 text-white">{selectedInstance.version}</div>
                        </div>
                    </div>
                ) : (
                    <span className="text-white/40 text-xs font-black uppercase tracking-widest pl-2">Selecione uma instância...</span>
                )}
                <div className="bg-white/5 p-2 rounded-lg">
                    {isOpen ? <ChevronUp className="w-4 h-4 text-white/60" /> : <ChevronDown className="w-4 h-4 text-white/60" />}
                </div>
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#0F141C] border border-white/10 rounded-xl max-h-60 overflow-y-auto custom-scrollbar z-50 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                    <div className="p-1 space-y-1">
                        {instances.map(inst => {
                            const Icon = instanceIcons[inst.icon || 'box'] || Box;
                            const isSelected = selectedId === inst.id;
                            return (
                                <button
                                    key={inst.id}
                                    onClick={() => {
                                        onSelect(inst.id);
                                        setIsOpen(false);
                                    }}
                                    className={`w-full p-2.5 rounded-lg flex items-center gap-3 transition-all ${isSelected
                                        ? 'bg-white/10'
                                        : 'hover:bg-white/5'
                                        }`}
                                >
                                    <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-hytale-accent text-black' : 'bg-white/5 text-white/20'}`}>
                                        <Icon className="w-4 h-4" />
                                    </div>
                                    <div className="text-left flex-1">
                                        <div className={`text-xs font-black uppercase tracking-wide truncate ${isSelected ? 'text-white' : 'text-white/60'}`}>{inst.name}</div>
                                    </div>
                                    {isSelected && <Check className="w-3 h-3 text-hytale-accent" />}
                                </button>
                            );
                        })}
                        {instances.length === 0 && (
                            <div className="p-4 text-center text-white/40 text-[10px] font-bold uppercase tracking-widest">
                                Nenhuma instância
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

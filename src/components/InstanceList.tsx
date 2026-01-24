import { useState, useEffect } from 'react';
import { Plus, X, Play, Folder, Trash, Settings2, Box } from 'lucide-react';
import { instanceIcons } from '../utils/instanceIcons';

interface Instance {
    id: string;
    name: string;
    version: string;
    icon?: string;
    lastPlayed?: number;
    created: number;
}

interface InstanceListProps {
    instances: Instance[];
    onRefresh: () => void;
    onLaunch: (instanceId: string) => void;
    activeInstanceId?: string | null;
    selectedId: string | null;
    onSelect: (id: string) => void;
    isLaunching: boolean;
}

export default function InstanceList({ instances, onRefresh, onLaunch, isLaunching, selectedId, onSelect }: InstanceListProps) {
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newInstanceName, setNewInstanceName] = useState('');
    const [newInstanceIcon, setNewInstanceIcon] = useState('box');
    const [version, setVersion] = useState('latest');

    const handleCreate = async () => {
        if (!newInstanceName.trim()) return;
        try {
            await (window as any).electronAPI.createInstance(newInstanceName, version, { icon: newInstanceIcon });
            setNewInstanceName('');
            setNewInstanceIcon('box');
            setShowCreateModal(false);
            await onRefresh();
        } catch (e) {
            console.error("Failed to create instance", e);
        }
    };

    const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setShowDeleteModal(id);
    };

    const confirmDelete = async () => {
        if (!showDeleteModal) return;
        const id = showDeleteModal;
        try {
            await (window as any).electronAPI.deleteInstance(id);
            if (selectedId === id) onSelect('');
            setShowDeleteModal(null);
            await onRefresh();
        } catch (e) {
            console.error("Failed to delete instance", e);
        }
    };

    const handleOpenFolder = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await (window as any).electronAPI.openInstanceFolder(id);
        } catch (e) {
            console.error("Failed to open folder", e);
        }
    };

    const [showSettingsModal, setShowSettingsModal] = useState<string | null>(null);
    const [editForm, setEditForm] = useState({ name: '', minMemory: 1024, maxMemory: 4096, icon: 'box' });
    const [settingsTab, setSettingsTab] = useState<'general' | 'mods'>('general');
    const [instanceMods, setInstanceMods] = useState<any[]>([]);
    const [instanceModConfig, setInstanceModConfig] = useState<any>({});
    const [loadingSettings, setLoadingSettings] = useState(false);

    useEffect(() => {
        if (showSettingsModal) {
            const inst = instances.find(i => i.id === showSettingsModal);
            if (inst) {
                setEditForm({
                    name: inst.name,
                    minMemory: (inst as any).minMemory || 1024,
                    maxMemory: (inst as any).maxMemory || 4096,
                    icon: inst.icon || 'box'
                });

                setLoadingSettings(true);
                Promise.all([
                    (window as any).electronAPI.getInstanceMods(showSettingsModal),
                    (window as any).electronAPI.getInstanceServerConfig(showSettingsModal)
                ]).then(([mods, config]) => {
                    setInstanceMods(mods || []);
                    const enabledState: any = {};
                    if (config.Mods) {
                        for (const [key, val] of Object.entries(config.Mods)) {
                            enabledState[key] = (val as any).Enabled;
                        }
                    }
                    setInstanceModConfig(enabledState);
                    setLoadingSettings(false);
                }).catch(err => {
                    console.error("Error loading instance settings data", err);
                    setLoadingSettings(false);
                });
            }
            setSettingsTab('general');
        }
    }, [showSettingsModal, instances]);

    const handleSaveSettings = async () => {
        if (!showSettingsModal) return;
        try {
            await (window as any).electronAPI.updateInstance(showSettingsModal, {
                name: editForm.name,
                minMemory: editForm.minMemory,
                maxMemory: editForm.maxMemory,
                icon: editForm.icon
            });

            const modsConfigUpdate: any = {};
            for (const [key, val] of Object.entries(instanceModConfig)) {
                modsConfigUpdate[key] = { Enabled: val };
            }

            await (window as any).electronAPI.updateInstanceServerConfig(showSettingsModal, {
                Mods: modsConfigUpdate
            });

            setShowSettingsModal(null);
            await onRefresh();
        } catch (e) {
            console.error("Failed to update instance", e);
        }
    };

    return (
        <div className="flex flex-col space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Minha <span className="text-hytale-accent">Biblioteca</span></h2>
                    <p className="text-white/30 text-xs font-bold uppercase tracking-widest mt-1">Gerencie suas jornadas por Orbis</p>
                </div>
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-3 px-8 py-4 bg-hytale-accent text-black font-black uppercase tracking-widest text-[10px] rounded hover:brightness-110 transition-all shadow-[0_0_20px_rgba(245,184,65,0.2)]"
                >
                    <Plus className="w-4 h-4" /> Nova Instância
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                {instances.length === 0 ? (
                    <div className="col-span-full orbis-panel p-20 flex flex-col items-center justify-center text-center border-dashed border-white/10 opacity-50">
                        <Folder className="w-16 h-16 text-white/10 mb-6" />
                        <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">Nenhuma Instância encontrada</h3>
                        <p className="text-xs text-white/40 italic">Crie uma nova instância para começar sua aventura.</p>
                    </div>
                ) : (
                    instances.map((instance) => {
                        const InstanceIcon = instanceIcons[instance.icon || 'box'] || Box;
                        return (
                            <div
                                key={instance.id}
                                onClick={() => onSelect(instance.id)}
                                className={`orbis-panel p-6 border-white/5 group cursor-pointer transition-all relative overflow-hidden ${selectedId === instance.id ? 'border-hytale-accent ring-1 ring-hytale-accent/30 bg-white/5' : 'hover:border-white/20'
                                    }`}
                            >
                                <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                                    <InstanceIcon className="w-24 h-24 rotate-12" />
                                </div>

                                <div className="relative z-10">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="w-14 h-14 rounded bg-black/40 border border-white/10 flex items-center justify-center group-hover:border-hytale-accent/50 transition-colors">
                                            <InstanceIcon className="w-6 h-6 text-white/20 group-hover:text-hytale-accent transition-colors" />
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={(e) => handleOpenFolder(instance.id, e)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 text-white/40 hover:text-white transition-all">
                                                <Folder className="w-4 h-4" />
                                            </button>
                                            <button onClick={(e) => handleDelete(instance.id, e)} className="p-2 bg-white/5 rounded-lg hover:bg-red-500/20 text-white/40 hover:text-red-500 transition-all">
                                                <Trash className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>

                                    <h3 className="text-lg font-black text-white uppercase tracking-tight mb-1 group-hover:text-hytale-accent transition-colors">
                                        {instance.name}
                                    </h3>
                                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-white/30">
                                        <span className="text-hytale-mana/60">{instance.version}</span>
                                        <span>•</span>
                                        <span>v1.0.4</span>
                                    </div>

                                    <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/5">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onLaunch(instance.id); }}
                                            disabled={isLaunching}
                                            className={`flex items-center gap-3 px-6 py-3 rounded font-black uppercase tracking-widest text-[9px] transition-all ${isLaunching && selectedId === instance.id ? 'bg-white/5 text-white/20 cursor-wait' : 'bg-white/5 hover:bg-hytale-accent hover:text-black text-white'
                                                }`}
                                        >
                                            <Play className="w-3.5 h-3.5 fill-current" />
                                            {isLaunching && selectedId === instance.id ? 'Iniciando...' : 'Jogar'}
                                        </button>
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setShowSettingsModal(instance.id); }}
                                            className="p-2 text-white/10 hover:text-white transition-all"
                                        >
                                            <Settings2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            {showCreateModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 pt-[200px] backdrop-blur-xl bg-[#0a0f16]/95 animate-in fade-in duration-300">
                    <div className="w-full max-w-lg max-h-[75vh] flex flex-col bg-[#0a0f16] border border-white/10 rounded-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-20 bg-hytale-accent/5 blur-[100px] rounded-full pointer-events-none"></div>

                        <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/5 flex-shrink-0">
                            <h3 className="text-2xl font-black text-white uppercase tracking-widest">Nova Instância</h3>
                            <button onClick={() => setShowCreateModal(false)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                                <X className="w-6 h-6 text-white/20" />
                            </button>
                        </div>

                        <div className="relative z-10 p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Nome da Jornada</label>
                                <input
                                    type="text"
                                    autoFocus
                                    placeholder="Ex: Orbis Odyssey"
                                    value={newInstanceName}
                                    onChange={(e) => setNewInstanceName(e.target.value)}
                                    className="w-full bg-[#05080b] border border-white/10 p-4 rounded text-white focus:outline-none focus:border-hytale-accent transition-all font-bold placeholder:text-white/10 placeholder:font-normal"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Ícone</label>
                                <div className="grid grid-cols-6 gap-2">
                                    {Object.entries(instanceIcons).map(([key, Icon]) => (
                                        <div
                                            key={key}
                                            onClick={() => setNewInstanceIcon(key)}
                                            className={`aspect-square rounded flex items-center justify-center cursor-pointer transition-all ${newInstanceIcon === key ? 'bg-hytale-accent text-black ring-2 ring-hytale-accent/20' : 'bg-white/5 text-white/20 hover:bg-white/10 hover:text-white'}`}
                                        >
                                            <Icon className="w-5 h-5" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Versão Base</label>
                                <div className="relative">
                                    <select
                                        value={version}
                                        onChange={(e) => setVersion(e.target.value)}
                                        className="w-full bg-[#05080b] border border-white/10 p-4 rounded text-white focus:outline-none focus:border-hytale-accent transition-all appearance-none font-bold"
                                    >
                                        <option value="latest">Latest Release (Automático)</option>
                                        <option value="stable">Stable Release</option>
                                    </select>
                                    <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none text-white/20">
                                        <Box className="w-4 h-4" />
                                    </div>
                                </div>
                                <p className="text-[10px] text-white/20 italic">*Define a versão do motor do jogo para esta instância.</p>
                            </div>
                        </div>

                        <div className="relative z-10 flex gap-4 p-6 border-t border-white/5 bg-[#0a0f16] flex-shrink-0">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-8 py-4 bg-white/5 hover:bg-white/10 rounded font-black uppercase tracking-widest text-[10px] text-white/40 hover:text-white transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCreate}
                                className="flex-1 px-8 py-4 bg-hytale-accent text-black font-black uppercase tracking-widest text-[10px] rounded hover:brightness-110 transition-all font-black"
                            >
                                Criar Instância
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showSettingsModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 pt-[200px] backdrop-blur-xl bg-[#0a0f16]/95 animate-in fade-in duration-300">
                    <div className="w-full max-w-lg max-h-[75vh] flex flex-col bg-[#0a0f16] border border-white/10 rounded-2xl animate-in zoom-in-95 duration-300 shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 flex items-center justify-between p-6 border-b border-white/5 flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-white uppercase tracking-widest">Configurar Instância</h3>
                            </div>
                            <button onClick={() => setShowSettingsModal(null)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                                <X className="w-6 h-6 text-white/20" />
                            </button>
                        </div>

                        {/* Tabs */}
                        <div className="flex border-b border-white/5 px-6">
                            <button
                                onClick={() => setSettingsTab('general')}
                                className={`py-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${settingsTab === 'general' ? 'border-hytale-accent text-white' : 'border-transparent text-white/40 hover:text-white'}`}
                            >
                                Geral
                            </button>
                            <button
                                onClick={() => setSettingsTab('mods')}
                                className={`py-3 px-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${settingsTab === 'mods' ? 'border-hytale-accent text-white' : 'border-transparent text-white/40 hover:text-white'}`}
                            >
                                Mods
                            </button>
                        </div>

                        <div className="relative z-10 p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                            {loadingSettings ? (
                                <div className="flex items-center justify-center h-40">
                                    <div className="text-white/40 text-xs italic">Carregando configurações...</div>
                                </div>
                            ) : settingsTab === 'general' ? (
                                <>
                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Nome</label>
                                        <input
                                            type="text"
                                            value={editForm.name}
                                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                            className="w-full bg-[#05080b] border border-white/10 p-4 rounded text-white focus:outline-none focus:border-hytale-accent transition-all font-bold"
                                        />
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Ícone</label>
                                        <div className="grid grid-cols-6 gap-2">
                                            {Object.entries(instanceIcons).map(([key, Icon]) => (
                                                <div
                                                    key={key}
                                                    onClick={() => setEditForm(prev => ({ ...prev, icon: key }))}
                                                    className={`aspect-square rounded flex items-center justify-center cursor-pointer transition-all ${editForm.icon === key ? 'bg-hytale-accent text-black ring-2 ring-hytale-accent/20' : 'bg-white/5 text-white/20 hover:bg-white/10 hover:text-white'}`}
                                                >
                                                    <Icon className="w-5 h-5" />
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Memória Máxima (MB)</label>
                                        <input
                                            type="number"
                                            step="512"
                                            value={editForm.maxMemory}
                                            onChange={(e) => setEditForm({ ...editForm, maxMemory: parseInt(e.target.value) })}
                                            className="w-full bg-[#05080b] border border-white/10 p-4 rounded text-white focus:outline-none focus:border-hytale-accent transition-all font-bold"
                                        />
                                        <p className="text-[10px] text-white/20 italic">Defina quanto de RAM esta instância específica pode usar.</p>
                                    </div>

                                    <button
                                        onClick={(e) => handleOpenFolder(showSettingsModal!, e as any)}
                                        className="w-full flex items-center justify-center gap-2 p-3 border border-dashed border-white/10 rounded-lg text-white/40 hover:text-white hover:border-white/20 transition-all mb-4 text-xs font-bold uppercase tracking-widest"
                                    >
                                        <Folder className="w-4 h-4" /> Abrir Pasta de Mods
                                    </button>
                                </>
                            ) : (
                                <div className="space-y-4">
                                    <p className="text-[10px] text-white/40 uppercase tracking-widest pb-2 border-b border-white/5">Mods Instalados ({instanceMods.length})</p>

                                    {instanceMods.length === 0 ? (
                                        <div className="text-white/20 text-xs italic text-center py-8">Nenhum mod instalado.</div>
                                    ) : (
                                        <div className="space-y-2">
                                            {instanceMods.map((mod: any) => {
                                                const modId = mod.id || mod.fileName;
                                                const isEnabled = instanceModConfig[modId] !== false;
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
                                                        <button
                                                            onClick={() => setInstanceModConfig((prev: any) => ({ ...prev, [modId]: !isEnabled }))}
                                                            className={`relative w-10 h-5 rounded-full transition-all ${isEnabled ? 'bg-hytale-accent' : 'bg-white/10'}`}
                                                        >
                                                            <div className={`absolute top-1 w-3 h-3 rounded-full bg-white shadow transition-all ${isEnabled ? 'left-6' : 'left-1'}`} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="relative z-10 flex gap-4 p-6 border-t border-white/5 bg-[#0a0f16] flex-shrink-0">
                            <button
                                onClick={handleSaveSettings}
                                disabled={loadingSettings}
                                className="w-full px-8 py-4 bg-hytale-accent text-black font-black uppercase tracking-widest text-[10px] rounded hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Salvar Alterações
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showDeleteModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 backdrop-blur-xl bg-[#0a0f16]/95 animate-in fade-in duration-300">
                    <div className="w-full max-w-sm bg-[#0a0f16] border border-white/10 rounded-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl relative overflow-hidden">
                        <div className="relative z-10 flex items-center justify-between">
                            <h3 className="text-xl font-black text-white uppercase tracking-widest text-red-500">Deletar Instância</h3>
                            <button onClick={() => setShowDeleteModal(null)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                                <X className="w-5 h-5 text-white/20" />
                            </button>
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                                <div className="p-2 bg-red-500/20 rounded-full">
                                    <Trash className="w-5 h-5 text-red-500" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-black text-white uppercase tracking-wide">Tem certeza?</h4>
                                    <p className="text-[10px] text-white/60 leading-relaxed mt-1">
                                        Você está prestes a excluir permanentemente esta instância e todos os seus arquivos (mods, saves, configs).
                                    </p>
                                </div>
                            </div>
                            <p className="text-[10px] text-white/20 italic text-center">Esta ação não pode ser desfeita.</p>
                        </div>

                        <div className="relative z-10 flex gap-4 pt-2">
                            <button
                                onClick={() => setShowDeleteModal(null)}
                                className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 rounded font-black uppercase tracking-widest text-[10px] text-white/40 hover:text-white transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-6 py-3 bg-red-500 text-black font-black uppercase tracking-widest text-[10px] rounded hover:brightness-110 transition-all font-black"
                            >
                                Deletar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

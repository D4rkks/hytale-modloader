import { useState, useEffect } from 'react';
import { Globe, Plus, Play, Trash, Folder, RefreshCw, X } from 'lucide-react';

interface World {
    name: string;
    path: string;
    seed?: number;
    createdAt?: string;
}

interface WorldListProps {
    instanceId: string;
    onSelectWorld?: (world: World) => void;
    onCreateWorld?: () => void;
    onPlay?: (world: World) => void;
}

export default function WorldList({ instanceId, onSelectWorld, onCreateWorld, onPlay }: WorldListProps) {
    const [worlds, setWorlds] = useState<World[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedWorld, setSelectedWorld] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

    const loadWorlds = async () => {
        setIsLoading(true);
        try {
            const api = (window as any).electronAPI;
            if (api?.getInstanceWorlds) {
                const worldList = await api.getInstanceWorlds(instanceId);
                setWorlds(worldList || []);
                if (worldList && worldList.length > 0 && !selectedWorld) {
                    setSelectedWorld(worldList[0].name);
                }
            }
        } catch (e) {
            console.error('Failed to load worlds:', e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadWorlds();
    }, [instanceId]);

    const handleSelectWorld = (world: World) => {
        setSelectedWorld(world.name);
        if (onSelectWorld) {
            onSelectWorld(world);
        }
    };

    const handleDelete = (e: React.MouseEvent, worldName: string) => {
        e.stopPropagation();
        setShowDeleteModal(worldName);
    };

    const confirmDelete = async () => {
        if (!showDeleteModal) return;
        const worldName = showDeleteModal;

        try {
            const api = (window as any).electronAPI;
            if (api?.deleteInstanceWorld) {
                const res = await api.deleteInstanceWorld(instanceId, worldName);
                if (res.success) {
                    loadWorlds();
                    setShowDeleteModal(null);
                } else {
                    alert('Erro ao deletar mundo: ' + res.error);
                }
            }
        } catch (err) {
            console.error(err);
            alert('Falha ao deletar mundo');
        }
    };

    const handleOpenFolder = async (e: React.MouseEvent, worldName: string) => {
        e.stopPropagation();
        try {
            const api = (window as any).electronAPI;
            if (api?.openWorldFolder) {
                await api.openWorldFolder(instanceId, worldName);
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handlePlay = (e: React.MouseEvent, world: World) => {
        e.stopPropagation();
        handleSelectWorld(world);
        if (onPlay) {
            onPlay(world);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12 border border-white/5 rounded-xl bg-white/5">
                <RefreshCw className="w-6 h-6 text-white/20 animate-spin" />
                <span className="ml-3 text-white/20 text-xs font-bold uppercase tracking-widest">Carregando mundos...</span>
            </div>
        );
    }

    if (worlds.length === 0) {
        return (
            <div className="text-center py-16 bg-white/5 rounded-xl border border-dashed border-white/10 flex flex-col items-center justify-center group hover:bg-white/10 transition-all">
                <div className="p-4 rounded-full bg-white/5 mb-4 group-hover:scale-110 transition-transform">
                    <Globe className="w-8 h-8 text-white/20" />
                </div>
                <p className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Nenhum mundo encontrado</p>
                <p className="text-white/20 text-[10px] italic">Crie um mundo para começar a jogar</p>
                {onCreateWorld && (
                    <button
                        onClick={onCreateWorld}
                        className="mt-6 flex items-center gap-2 px-6 py-3 rounded bg-hytale-accent text-black font-black uppercase tracking-widest text-[10px] hover:brightness-110 transition-all shadow-lg shadow-hytale-accent/10"
                    >
                        <Plus className="w-4 h-4" />
                        Criar Mundo
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-end gap-2 mb-2">
                <button
                    onClick={loadWorlds}
                    className="p-2 rounded hover:bg-white/10 transition-colors text-white/20 hover:text-white"
                    title="Atualizar Lista"
                >
                    <RefreshCw className="w-4 h-4" />
                </button>
                {onCreateWorld && (
                    <button
                        onClick={onCreateWorld}
                        className="flex items-center gap-2 px-4 py-2 rounded bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[10px] font-bold uppercase tracking-widest transition-all border border-white/5 hover:border-white/20"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Novo Mundo
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {worlds.map((world) => {
                    const isSelected = selectedWorld === world.name;
                    return (
                        <div
                            key={world.name}
                            onClick={() => handleSelectWorld(world)}
                            className={`relative p-5 rounded-xl border transition-all cursor-pointer group overflow-hidden ${isSelected
                                ? 'bg-white/5 border-hytale-accent ring-1 ring-hytale-accent/30'
                                : 'bg-black/20 border-white/5 hover:border-white/20 hover:bg-white/5'
                                }`}
                        >
                            <div className="absolute top-0 right-0 p-3 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity pointer-events-none">
                                <Globe className="w-20 h-20 -rotate-12" />
                            </div>

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`w-10 h-10 rounded flex items-center justify-center border transition-colors ${isSelected ? 'bg-hytale-accent/10 border-hytale-accent/30 text-hytale-accent' : 'bg-black/40 border-white/10 text-white/20 group-hover:text-white/40'}`}>
                                        <Globe className="w-5 h-5" />
                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={(e) => handleOpenFolder(e, world.name)}
                                            className="p-1.5 hover:bg-white/10 rounded text-white/20 hover:text-white transition-all"
                                            title="Abrir Pasta"
                                        >
                                            <Folder className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => handleDelete(e, world.name)}
                                            className="p-1.5 hover:bg-red-500/20 rounded text-white/20 hover:text-red-500 transition-all"
                                            title="Deletar Mundo"
                                        >
                                            <Trash className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                <h3 className={`text-base font-black uppercase tracking-tight mb-1 transition-colors ${isSelected ? 'text-white' : 'text-white/80 group-hover:text-white'}`}>
                                    {world.name}
                                </h3>

                                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-white/30 mb-6">
                                    <span>{world.seed || 'Seed Aleatória'}</span>
                                    {world.createdAt && (
                                        <>
                                            <span>•</span>
                                            <span>{formatDate(world.createdAt)}</span>
                                        </>
                                    )}
                                </div>

                                <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                                    <button
                                        onClick={(e) => handlePlay(e, world)}
                                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded font-black uppercase tracking-widest text-[10px] transition-all ${isSelected
                                            ? 'bg-hytale-accent text-black hover:brightness-110 shadow-lg shadow-hytale-accent/10'
                                            : 'bg-white/5 text-white/40 group-hover:bg-white/10 group-hover:text-white'
                                            }`}
                                    >
                                        <Play className="w-3 h-3 fill-current" />
                                        Jogar
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {showDeleteModal && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="w-full max-w-md bg-[#1a1f26] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 transform transition-all">
                        <div className="bg-gradient-to-r from-red-500/10 to-transparent p-6 border-b border-white/5 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-500/20 rounded-lg">
                                    <Trash className="w-5 h-5 text-red-500" />
                                </div>
                                <h3 className="text-lg font-bold text-white tracking-wide">Excluir Mundo?</h3>
                            </div>
                            <button
                                onClick={() => setShowDeleteModal(null)}
                                className="text-white/40 hover:text-white transition-colors p-1 rounded-md hover:bg-white/5"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <p className="text-white/70 text-sm leading-relaxed">
                                Você está prestes a excluir permanentemente o mundo <span className="text-white font-bold">"{showDeleteModal}"</span>.
                            </p>

                            <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-xl flex gap-3">
                                <div className="min-w-0 flex-1">
                                    <p className="text-red-200 text-xs font-medium">Esta ação é irreversível.</p>
                                    <p className="text-red-200/60 text-[10px] mt-0.5">Todos os dados do mundo, construções e inventários serão perdidos para sempre.</p>
                                </div>
                            </div>
                        </div>

                        <div className="p-6 bg-black/20 border-t border-white/5 flex gap-3">
                            <button
                                onClick={() => setShowDeleteModal(null)}
                                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/5 transition-all border border-transparent hover:border-white/10"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                            >
                                Sim, Deletar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

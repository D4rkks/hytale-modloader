import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Package, Download, ShieldCheck, Box, Loader2, CheckCircle, Clock, ChevronDown, SlidersHorizontal, X, Star, Square, CheckSquare, ListChecks, Trash2, FolderOpen, HardDrive } from 'lucide-react';
import { instanceIcons } from '../utils/instanceIcons';

interface Mod {
    id: string;
    name: string;
    author: string;
    description: string;
    icon?: string;
    source: string;
    installed?: boolean;
    downloads?: number;
    rating?: number;
    tags?: string[];
}

interface Instance {
    id: string;
    name: string;
    icon?: string;
}

const MODTALE_TAGS = [
    "Adventure", "RPG", "Sci-Fi", "Fantasy", "Survival", "Magic", "Tech",
    "Exploration", "Minigame", "PvP", "Parkour", "Hardcore", "Skyblock",
    "Puzzle", "Quests", "Economy", "Protection", "Admin Tools", "Chat",
    "Anti-Cheat", "Performance", "Library", "API", "Mechanics", "World Gen",
    "Recipes", "Loot Tables", "Functions", "Decoration", "Vanilla+",
    "Kitchen Sink", "City", "Landscape", "Spawn", "Lobby", "Medieval",
    "Modern", "Futuristic", "Models", "Textures", "Animations", "Particles"
];

const SORT_OPTIONS = [
    { value: 'relevance', label: 'Relevância' },
    { value: 'downloads', label: 'Mais Baixados' },
    { value: 'rating', label: 'Melhor Avaliados' },
    { value: 'newest', label: 'Mais Recentes' },
    { value: 'updated', label: 'Atualizados' },
];

const CLASSIFICATIONS = [
    { value: '', label: 'Todos' },
    { value: 'PLUGIN', label: 'Plugins' },
    { value: 'DATA', label: 'Data Packs' },
    { value: 'ART', label: 'Arte' },
    { value: 'SAVE', label: 'Mundos' },
    { value: 'MODPACK', label: 'Modpacks' },
];

type SourceType = 'ModTale' | 'CurseForge' | 'Installed';

interface InstalledMod {
    fileName: string;
    name: string;
    source: string;
    id: string;
    size: number;
    installedAt: string;
}

interface ModsViewProps {
    instances: Instance[];
    activeInstanceId: string | null;
    onInstanceSelect: (id: string) => void;
}

const ModsView = ({ instances, activeInstanceId, onInstanceSelect }: ModsViewProps) => {
    const [source, setSource] = useState<SourceType>('ModTale');
    const [searchQuery, setSearchQuery] = useState('');

    const [instanceMods, setInstanceMods] = useState<InstalledMod[]>([]);
    const [isLoadingInstanceMods, setIsLoadingInstanceMods] = useState(false);
    const [removingMods, setRemovingMods] = useState<Record<string, boolean>>({});
    const [mods, setMods] = useState<Mod[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [installingMods, setInstallingMods] = useState<Record<string, boolean>>({});
    const [waitingMods, setWaitingMods] = useState<Record<string, boolean>>({});
    const [installedMods, setInstalledMods] = useState<Record<string, boolean>>({});

    const [selectedMods, setSelectedMods] = useState<Set<string>>(new Set());
    const [isBatchInstalling, setIsBatchInstalling] = useState(false);

    const [sortBy, setSortBy] = useState('downloads');
    const [classification, setClassification] = useState('');
    const [selectedTags, setSelectedTags] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [showSortDropdown, setShowSortDropdown] = useState(false);
    const [showInstanceDropdown, setShowInstanceDropdown] = useState(false);

    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [totalMods, setTotalMods] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const loadInstalledMods = async () => {
        const api = (window as any).electronAPI;
        if (api?.getInstalledMods && activeInstanceId) {
            const installed = await api.getInstalledMods();
            const installedMap: Record<string, boolean> = {};
            installed.forEach((m: any) => {
                if (m.instanceId === activeInstanceId) {
                    installedMap[m.id] = true;
                }
            });
            setInstalledMods(installedMap);
        }
    };

    const loadInstanceMods = async () => {
        if (!activeInstanceId) return;

        setIsLoadingInstanceMods(true);
        try {
            const api = (window as any).electronAPI;
            if (api?.getInstanceMods) {
                const result = await api.getInstanceMods(activeInstanceId);
                if (result.success) {
                    setInstanceMods(result.mods);

                    if (result.syncedCount && result.syncedCount > 0) {
                        console.log(`Synced ${result.syncedCount} stale mod records`);
                        loadInstalledMods();
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load instance mods:', e);
        } finally {
            setIsLoadingInstanceMods(false);
        }
    };

    const handleRemoveMod = async (mod: InstalledMod) => {
        if (!activeInstanceId) return;

        setRemovingMods(prev => ({ ...prev, [mod.fileName]: true }));
        try {
            const api = (window as any).electronAPI;
            if (api?.removeInstanceMod) {
                const result = await api.removeInstanceMod(activeInstanceId, mod.fileName, mod.id);
                if (result.success) {
                    setInstanceMods(prev => prev.filter(m => m.fileName !== mod.fileName));
                    setInstalledMods(prev => {
                        const updated = { ...prev };
                        delete updated[mod.id];
                        return updated;
                    });
                }
            }
        } catch (e) {
            console.error('Failed to remove mod:', e);
        } finally {
            setRemovingMods(prev => ({ ...prev, [mod.fileName]: false }));
        }
    };

    useEffect(() => {
        const api = (window as any).electronAPI;
        if (api?.onModInstalled) {
            api.onModInstalled((_event: any, data: any) => {
                console.log('Mod installed event:', data);
                if (data.success) {
                    setWaitingMods({});
                    setInstallingMods({});
                    setMods(prev => prev.map(m =>
                        data.modName === m.name ? { ...m, installed: true } : m
                    ));
                    setInstalledMods(prev => {
                        const updated = { ...prev };
                        mods.forEach(m => {
                            if (m.name === data.modName) {
                                updated[m.id] = true;
                                if (activeInstanceId) {
                                    (window as any).electronAPI?.markModInstalled?.(
                                        { id: m.id, name: m.name, source: m.source },
                                        activeInstanceId
                                    );
                                }
                            }
                        });
                        return updated;
                    });
                } else if (data.error === 'timeout') {
                    setWaitingMods({});
                    setInstallingMods({});
                }
            });
        }

        return () => {
            if (api?.removeModInstalledListener) {
                api.removeModInstalledListener();
            }
        };
    }, [mods, activeInstanceId]);

    useEffect(() => {
        if (activeInstanceId) {
            loadInstalledMods();
            if (source === 'Installed') {
                loadInstanceMods();
            }
        }
    }, [activeInstanceId]);

    useEffect(() => {
        if (source === 'Installed' && activeInstanceId) {
            loadInstanceMods();
        }
    }, [source]);

    const [isResetting, setIsResetting] = useState(false);

    useEffect(() => {
        if (source === 'Installed') {
            setIsResetting(false);
            return;
        }

        setIsResetting(true);
        setMods([]);
        setHasMore(true);
        setPage(0);
        setSelectedMods(new Set());

        const timer = setTimeout(() => {
            handleSearch(0, true).finally(() => {
                setIsResetting(false);
            });
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, [searchQuery, source, sortBy, classification, selectedTags]);

    useEffect(() => {
        handleSearch(0, true);
    }, []);
    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container || isLoadingMore || !hasMore || isSearching || isResetting) return;

        const { scrollTop, scrollHeight, clientHeight } = container;
        if (scrollHeight - scrollTop - clientHeight < 200) {
            loadMore();
        }
    }, [isLoadingMore, hasMore, isSearching, isResetting, page]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (container) {
            container.addEventListener('scroll', handleScroll);
            return () => container.removeEventListener('scroll', handleScroll);
        }
    }, [handleScroll]);

    useEffect(() => {
        const handleClickOutside = () => {
            setShowSortDropdown(false);
            setShowInstanceDropdown(false);
        };
        if (showSortDropdown || showInstanceDropdown) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [showSortDropdown, showInstanceDropdown]);



    const handleSearch = async (pageNum: number = 0, reset: boolean = false) => {
        if (reset) {
            setIsSearching(true);
        } else {
            setIsLoadingMore(true);
        }

        try {
            const filters = {
                sort: sortBy,
                classification,
                tags: selectedTags.join(','),
                page: pageNum,
            };
            const result = await (window as any).electronAPI.invoke('search-mods', source, searchQuery, filters);

            if (reset) {
                setMods(result.mods || []);
            } else {
                setMods(prev => [...prev, ...(result.mods || [])]);
            }

            setHasMore(result.hasMore ?? false);
            setTotalMods(result.total ?? 0);
            setPage(pageNum);
        } catch (e) {
            console.error("Search failed", e);
        } finally {
            setIsSearching(false);
            setIsLoadingMore(false);
        }
    };

    const loadMore = () => {
        if (!isLoadingMore && hasMore) {
            handleSearch(page + 1, false);
        }
    };

    const toggleTag = (tag: string) => {
        setSelectedTags(prev =>
            prev.includes(tag)
                ? prev.filter(t => t !== tag)
                : [...prev, tag]
        );
    };

    const clearFilters = () => {
        setSortBy('downloads');
        setClassification('');
        setSelectedTags([]);
    };

    const hasActiveFilters = classification !== '' || selectedTags.length > 0 || sortBy !== 'downloads';

    const handleInstall = async (mod: Mod) => {
        if (!activeInstanceId) {
            alert("Selecione uma instância primeiro!");
            return;
        }

        setInstallingMods(prev => ({ ...prev, [mod.id]: true }));
        try {
            const result = await (window as any).electronAPI.invoke('install-mod', activeInstanceId, mod);
            if (result.waiting) {
                setInstallingMods(prev => ({ ...prev, [mod.id]: false }));
                setWaitingMods(prev => ({ ...prev, [mod.id]: true }));
            } else if (result.success) {
                setInstalledMods(prev => ({ ...prev, [mod.id]: true }));
                setInstallingMods(prev => ({ ...prev, [mod.id]: false }));
                if (activeInstanceId) {
                    (window as any).electronAPI?.markModInstalled?.(
                        { id: mod.id, name: mod.name, source: mod.source },
                        activeInstanceId
                    );
                }
            } else {
                console.error("Install failed details:", result.error);
                alert("Falha ao instalar o mod: " + result.error);
                setInstallingMods(prev => ({ ...prev, [mod.id]: false }));
            }
        } catch (e) {
            console.error("Install failed", e);
            setInstallingMods(prev => ({ ...prev, [mod.id]: false }));
        }
    };

    const toggleModSelection = (modId: string) => {
        setSelectedMods(prev => {
            const next = new Set(prev);
            if (next.has(modId)) {
                next.delete(modId);
            } else {
                next.add(modId);
            }
            return next;
        });
    };

    const selectAllVisible = () => {
        const notInstalledMods = mods.filter(m => !installedMods[m.id]).map(m => m.id);
        setSelectedMods(new Set(notInstalledMods));
    };

    const clearSelection = () => {
        setSelectedMods(new Set());
    };

    const handleBatchInstall = async () => {
        if (!activeInstanceId) {
            alert("Selecione uma instância primeiro!");
            return;
        }

        const modsToInstall = mods.filter(m => selectedMods.has(m.id) && !installedMods[m.id]);
        if (modsToInstall.length === 0) return;

        setIsBatchInstalling(true);

        try {
            const api = (window as any).electronAPI;
            let result;

            if (api?.batchInstallMods) {
                result = await api.batchInstallMods(activeInstanceId, modsToInstall);
            } else {
                result = await api.invoke('batch-install-mods', activeInstanceId, modsToInstall);
            }

            if (result?.success) {
                const waitingMap: Record<string, boolean> = {};
                modsToInstall.forEach(m => { waitingMap[m.id] = true; });
                setWaitingMods(waitingMap);
                setSelectedMods(new Set());
            } else {
                console.error("Batch install returned error:", result);
            }
        } catch (e) {
            console.error("Batch install failed", e);
        } finally {
            setIsBatchInstalling(false);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">Gerenciador de <span className="text-hytale-accent">Mods</span></h2>
                    <p className="text-white/30 text-xs font-bold uppercase tracking-widest mt-1">Sintonizando o código de Orbis</p>
                </div>

                <div className="flex items-center gap-4">
                    <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Instalando em:</span>
                    <div className="relative">
                        {(() => {
                            const selectedInstance = instances.find(i => i.id === activeInstanceId);
                            const SelectedIcon = instanceIcons[selectedInstance?.icon || 'box'] || Box;
                            return (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowInstanceDropdown(!showInstanceDropdown); }}
                                    className="flex items-center justify-between gap-3 bg-black/60 border border-white/10 hover:border-white/20 rounded-lg px-4 py-2.5 min-w-[200px] transition-all group"
                                >
                                    <div className="flex items-center gap-3">
                                        <SelectedIcon className="w-4 h-4 text-hytale-accent" />
                                        <span className="text-xs font-bold text-white uppercase tracking-wide truncate max-w-[140px]">
                                            {selectedInstance?.name || 'Selecionar'}
                                        </span>
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showInstanceDropdown ? 'rotate-180' : ''}`} />
                                </button>
                            );
                        })()}

                        {showInstanceDropdown && (
                            <div className="absolute right-0 top-full mt-2 w-full bg-[#0a0f16] border border-white/10 rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                                {instances.length === 0 ? (
                                    <div className="px-4 py-3 text-[10px] text-white/30 font-bold uppercase tracking-widest text-center">
                                        Nenhuma instância
                                    </div>
                                ) : (
                                    instances.map(inst => {
                                        const InstIcon = instanceIcons[inst.icon || 'box'] || Box;
                                        return (
                                            <button
                                                key={inst.id}
                                                onClick={() => {
                                                    onInstanceSelect(inst.id);
                                                    setShowInstanceDropdown(false);
                                                }}
                                                className={`w-full px-4 py-3 text-left flex items-center gap-3 transition-all ${activeInstanceId === inst.id
                                                    ? 'bg-hytale-accent/20 text-hytale-accent'
                                                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                                                    }`}
                                            >
                                                <InstIcon className={`w-4 h-4 ${activeInstanceId === inst.id ? 'text-hytale-accent' : 'text-white/30'}`} />
                                                <span className="text-xs font-bold uppercase tracking-wide truncate">{inst.name}</span>
                                                {activeInstanceId === inst.id && (
                                                    <CheckCircle className="w-3 h-3 ml-auto text-hytale-accent" />
                                                )}
                                            </button>
                                        )
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="orbis-panel rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
                <div className="bg-black/40 border-b border-white/5 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 bg-black/20 p-1 rounded-lg border border-white/5 w-fit">
                            {(['ModTale', 'CurseForge', 'Installed'] as const).map((s) => (
                                <button
                                    key={s}
                                    onClick={() => setSource(s)}
                                    className={`px-6 py-2 rounded-md text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${source === s
                                        ? 'bg-hytale-accent text-black shadow-lg shadow-hytale-accent/20'
                                        : 'text-white/40 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    {s === 'Installed' && <HardDrive className="w-3 h-3" />}
                                    {s === 'Installed' ? 'Baixados' : s}
                                    {s === 'Installed' && instanceMods.length > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded text-[8px] ${source === s ? 'bg-black/20' : 'bg-hytale-accent/20 text-hytale-accent'}`}>
                                            {instanceMods.length}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                        {source !== 'Installed' && (
                            <button
                                onClick={() => setShowFilters(!showFilters)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border ${showFilters || hasActiveFilters
                                    ? 'bg-hytale-accent/20 text-hytale-accent border-hytale-accent/30'
                                    : 'bg-black/20 text-white/40 border-white/5 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                Filtros
                                {hasActiveFilters && (
                                    <span className="bg-hytale-accent text-black px-1.5 py-0.5 rounded text-[8px]">
                                        {(classification ? 1 : 0) + selectedTags.length + (sortBy !== 'downloads' ? 1 : 0)}
                                    </span>
                                )}
                            </button>
                        )}
                    </div>

                    {source !== 'Installed' && (
                        <div className="flex gap-4">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-hytale-accent" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder={`Buscar mods no ${source}...`}
                                    className="w-full bg-black/20 border border-white/5 rounded-lg pl-12 pr-4 py-4 text-sm font-medium focus:outline-none focus:border-hytale-accent/30 text-white transition-all"
                                />
                                {isSearching && (
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                        <Loader2 className="w-4 h-4 text-hytale-accent animate-spin" />
                                    </div>
                                )}
                            </div>

                            <div className="relative group">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowSortDropdown(!showSortDropdown);
                                    }}
                                    className="flex items-center justify-between gap-3 bg-black/40 border border-white/10 rounded-lg px-4 py-3.5 text-xs text-white font-bold uppercase tracking-wide focus:outline-none focus:border-hytale-accent/30 cursor-pointer hover:bg-white/5 transition-all min-w-[200px]"
                                >
                                    <span>{SORT_OPTIONS.find(o => o.value === sortBy)?.label || 'Ordenar'}</span>
                                    <ChevronDown className={`w-4 h-4 text-white/40 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} />
                                </button>
                                {showSortDropdown && (
                                    <div
                                        className="absolute top-full left-0 right-0 mt-2 bg-[#0d1117] border border-white/10 rounded-lg overflow-hidden z-50 shadow-xl shadow-black/50"
                                        onClick={(e) => e.stopPropagation()}
                                    >
                                        {SORT_OPTIONS.map(opt => (
                                            <button
                                                key={opt.value}
                                                onClick={() => {
                                                    setSortBy(opt.value);
                                                    setShowSortDropdown(false);
                                                }}
                                                className={`w-full px-4 py-3 text-left text-xs font-bold uppercase tracking-wide transition-all ${sortBy === opt.value
                                                    ? 'bg-hytale-accent/20 text-hytale-accent'
                                                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {showFilters && source !== 'Installed' && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Categoria</span>
                                    {hasActiveFilters && (
                                        <button
                                            onClick={clearFilters}
                                            className="text-[9px] font-bold uppercase text-hytale-accent/60 hover:text-hytale-accent flex items-center gap-1"
                                        >
                                            <X className="w-3 h-3" /> Limpar Filtros
                                        </button>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {CLASSIFICATIONS.map(c => (
                                        <button
                                            key={c.value}
                                            onClick={() => setClassification(c.value)}
                                            className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wide transition-all ${classification === c.value
                                                ? 'bg-hytale-accent text-black'
                                                : 'bg-white/5 text-white/50 hover:text-white hover:bg-white/10'
                                                }`}
                                        >
                                            {c.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">Tags</span>
                                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                                    {MODTALE_TAGS.map(tag => (
                                        <button
                                            key={tag}
                                            onClick={() => toggleTag(tag)}
                                            className={`px-2 py-1 rounded text-[9px] font-bold transition-all ${selectedTags.includes(tag)
                                                ? 'bg-hytale-accent text-black'
                                                : 'bg-white/5 text-white/40 hover:text-white hover:bg-white/10'
                                                }`}
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div
                    ref={scrollContainerRef}
                    className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar"
                >
                    {source === 'Installed' ? (
                        <>
                            <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                                {instanceMods.length} mods instalados
                            </div>

                            {isLoadingInstanceMods ? (
                                <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4">
                                    <Loader2 className="w-16 h-16 opacity-50 animate-spin" />
                                    <p className="text-xs font-black uppercase tracking-widest">Carregando mods...</p>
                                </div>
                            ) : instanceMods.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4 py-20">
                                    <FolderOpen className="w-16 h-16 opacity-50" />
                                    <p className="text-xs font-black uppercase tracking-widest">Nenhum mod instalado</p>
                                    <p className="text-[10px] text-white/10">Instale mods nas abas ModTale ou CurseForge</p>
                                </div>
                            ) : (
                                instanceMods.map(mod => (
                                    <div key={mod.fileName} className="orbis-panel p-4 border-white/5 flex items-center gap-4 hover:border-white/10 transition-all bg-black/20">
                                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-hytale-accent/20 to-transparent flex items-center justify-center shrink-0 border border-white/5">
                                            <Package className="w-6 h-6 text-hytale-accent/60" />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-black text-white uppercase tracking-wide truncate">{mod.name}</h3>
                                                <span className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${mod.source === 'ModTale' ? 'bg-hytale-accent/20 text-hytale-accent' :
                                                    mod.source === 'CurseForge' ? 'bg-orange-500/20 text-orange-400' :
                                                        'bg-white/10 text-white/40'
                                                    }`}>
                                                    {mod.source}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-white/30 truncate">
                                                {mod.fileName} • {(mod.size / 1024).toFixed(1)} KB
                                            </p>
                                        </div>

                                        <button
                                            onClick={() => handleRemoveMod(mod)}
                                            disabled={removingMods[mod.fileName]}
                                            className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500/40 text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {removingMods[mod.fileName] ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <Trash2 className="w-3.5 h-3.5" />
                                            )}
                                            Remover
                                        </button>
                                    </div>
                                ))
                            )}
                        </>
                    ) : (
                        <>
                            {totalMods > 0 && (
                                <div className="text-[10px] font-bold uppercase tracking-widest text-white/30 mb-2">
                                    Mostrando {mods.length} de {totalMods} mods
                                </div>
                            )}

                            {isSearching && mods.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4">
                                    <Loader2 className="w-16 h-16 opacity-50 animate-spin" />
                                    <p className="text-xs font-black uppercase tracking-widest">Buscando mods...</p>
                                </div>
                            ) : mods.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-white/20 space-y-4">
                                    <Package className="w-16 h-16 opacity-50" />
                                    <p className="text-xs font-black uppercase tracking-widest">Nenhum mod encontrado</p>
                                    <p className="text-[10px] text-white/10">Tente buscar por outro termo ou mudar os filtros</p>
                                </div>
                            ) : (
                                mods.map(mod => (
                                    <div key={mod.id} className="orbis-panel p-4 border-white/5 flex items-center gap-4 hover:border-white/10 transition-all bg-black/20">
                                        {!installedMods[mod.id] && (
                                            <button
                                                onClick={() => toggleModSelection(mod.id)}
                                                className={`shrink-0 p-1 rounded transition-all ${selectedMods.has(mod.id)
                                                    ? 'text-hytale-accent'
                                                    : 'text-white/20 hover:text-white/40'
                                                    }`}
                                            >
                                                {selectedMods.has(mod.id) ? (
                                                    <CheckSquare className="w-5 h-5" />
                                                ) : (
                                                    <Square className="w-5 h-5" />
                                                )}
                                            </button>
                                        )}
                                        {installedMods[mod.id] && (
                                            <div className="shrink-0 p-1 text-green-500">
                                                <CheckCircle className="w-5 h-5" />
                                            </div>
                                        )}

                                        <div className="w-14 h-14 bg-black/40 rounded-lg flex items-center justify-center border border-white/5 shrink-0 overflow-hidden">
                                            {mod.icon ? (
                                                <img src={mod.icon} alt={mod.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <Package className="w-7 h-7 text-white/10" />
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-black text-white uppercase text-sm truncate">{mod.name}</h4>
                                                <span className="shrink-0 text-[9px] text-hytale-accent/60 font-black uppercase px-2 bg-hytale-accent/5 border border-hytale-accent/10 rounded">
                                                    {mod.author}
                                                </span>
                                                {mod.source && (
                                                    <span className="shrink-0 text-[8px] text-white/30 font-bold uppercase px-1.5 bg-white/5 rounded">
                                                        {mod.source}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-white/40 line-clamp-2">{mod.description}</p>
                                            <div className="flex items-center gap-3 mt-2">
                                                {mod.downloads != null && mod.downloads >= 0 && (
                                                    <span className="text-[9px] text-white/30 flex items-center gap-1">
                                                        <Download className="w-3 h-3" />
                                                        {mod.downloads.toLocaleString()}
                                                    </span>
                                                )}
                                                {mod.rating != null && mod.rating > 0 && (
                                                    <span className="text-[9px] text-yellow-500/60 flex items-center gap-1">
                                                        <Star className="w-3 h-3 fill-current" />
                                                        {mod.rating.toFixed(1)}
                                                    </span>
                                                )}
                                                {mod.tags && mod.tags.length > 0 && (
                                                    <div className="flex items-center gap-1">
                                                        {mod.tags.slice(0, 3).map((tag, tagIndex) => (
                                                            <span key={`${mod.id}-tag-${tagIndex}`} className="text-[8px] text-white/20 bg-white/5 px-1.5 py-0.5 rounded">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                        {mod.tags.length > 3 && (
                                                            <span className="text-[8px] text-white/20">+{mod.tags.length - 3}</span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => handleInstall(mod)}
                                            disabled={installingMods[mod.id] || installedMods[mod.id] || waitingMods[mod.id]}
                                            className={`shrink-0 flex items-center gap-2 px-6 py-3 rounded font-black uppercase tracking-widest text-[10px] transition-all min-w-[160px] justify-center ${installedMods[mod.id]
                                                ? 'bg-green-500/20 text-green-500 cursor-default border border-green-500/20'
                                                : waitingMods[mod.id]
                                                    ? 'bg-yellow-500/20 text-yellow-500 cursor-wait border border-yellow-500/20'
                                                    : installingMods[mod.id]
                                                        ? 'bg-white/5 text-white/40 cursor-wait'
                                                        : 'bg-white/5 hover:bg-hytale-accent hover:text-black text-white hover:brightness-110'
                                                }`}
                                        >
                                            {installingMods[mod.id] ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Abrindo...
                                                </>
                                            ) : waitingMods[mod.id] ? (
                                                <>
                                                    <Clock className="w-3.5 h-3.5 animate-pulse" /> Aguardando
                                                </>
                                            ) : installedMods[mod.id] ? (
                                                <>
                                                    <CheckCircle className="w-3.5 h-3.5" /> Instalado
                                                </>
                                            ) : (
                                                <>
                                                    <Download className="w-3.5 h-3.5" /> Instalar
                                                </>
                                            )}
                                        </button>
                                    </div>
                                ))
                            )}

                            {isLoadingMore && (
                                <div className="flex justify-center py-6">
                                    <div className="flex items-center gap-3 text-white/40">
                                        <Loader2 className="w-5 h-5 animate-spin" />
                                        <span className="text-[10px] font-bold uppercase tracking-widest">Carregando mais mods...</span>
                                    </div>
                                </div>
                            )}

                            {!hasMore && mods.length > 0 && !isLoadingMore && (
                                <div className="flex justify-center py-6 text-white/20">
                                    <span className="text-[10px] font-bold uppercase tracking-widest">
                                        — Fim da lista ({mods.length} mods carregados) —
                                    </span>
                                </div>
                            )}
                        </>
                    )}
                </div>

                {selectedMods.size > 0 && source !== 'Installed' && (
                    <div className="p-3 bg-hytale-accent/10 border-t border-hytale-accent/20 flex justify-between items-center animate-in slide-in-from-bottom duration-200">
                        <div className="flex items-center gap-4">
                            <span className="text-[11px] text-hytale-accent font-bold uppercase tracking-widest flex items-center gap-2">
                                <ListChecks className="w-4 h-4" />
                                {selectedMods.size} mod{selectedMods.size > 1 ? 's' : ''} selecionado{selectedMods.size > 1 ? 's' : ''}
                            </span>
                            <button
                                onClick={selectAllVisible}
                                className="text-[10px] text-white/50 hover:text-white font-bold uppercase tracking-wide transition-colors"
                            >
                                Selecionar Todos
                            </button>
                            <button
                                onClick={clearSelection}
                                className="text-[10px] text-white/50 hover:text-white font-bold uppercase tracking-wide transition-colors"
                            >
                                Limpar
                            </button>
                        </div>
                        <button
                            onClick={handleBatchInstall}
                            disabled={isBatchInstalling}
                            className="flex items-center gap-2 px-5 py-2 bg-hytale-accent hover:brightness-110 text-black font-black uppercase text-xs rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isBatchInstalling ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Instalando...
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    Baixar Selecionados
                                </>
                            )}
                        </button>
                    </div>
                )}

                {Object.values(waitingMods).some(v => v) && source !== 'Installed' && (
                    <div className="p-3 bg-yellow-500/10 border-t border-yellow-500/20 flex justify-center items-center gap-3 text-[11px] text-yellow-500 font-bold uppercase tracking-widest">
                        <Clock className="w-4 h-4 animate-pulse" />
                        <span>Aguardando download... Salve o arquivo na pasta Downloads</span>
                    </div>
                )}

                <div className="p-4 bg-black/40 border-t border-white/5 flex justify-between items-center text-[10px] text-white/20 font-bold uppercase tracking-widest">
                    <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-hytale-accent" />
                        <span>
                            {source === 'Installed'
                                ? `Pasta de Mods: ${instances.find(i => i.id === activeInstanceId)?.name || 'N/A'}`
                                : `Conexão Segura: ${source} API`
                            }
                        </span>
                    </div>
                    {source === 'Installed' ? (
                        <span>{instanceMods.length} mods instalados</span>
                    ) : totalMods > 0 && (
                        <span>{mods.length} de {totalMods} mods</span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ModsView;
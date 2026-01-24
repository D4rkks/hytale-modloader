import { useState, useEffect } from 'react';
import { Calendar, ArrowRight, Sparkles, Tag, ExternalLink, Loader2 } from 'lucide-react';

interface NewsItem {
    slug: string;
    title: string;
    author: string;
    bodyExcerpt: string;
    publishedAt: string;
    coverImage: {
        s3Key: string;
    };
    category?: string;
}

interface ChangelogChange {
    category: string;
    description: string;
}

interface ChangelogItem {
    version: string;
    date: string;
    title: string;
    type?: string;
    changes: ChangelogChange[];
}

interface ChangelogData {
    latestVersion: string;
    changelog: ChangelogItem[];
}

interface DashboardProps {
    isConnected?: boolean;
    isOfflineMode?: boolean;
    connectionError?: boolean;
    onConnect?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ isConnected = false, isOfflineMode = false, connectionError = false, onConnect: _onConnect }) => {
    // State definitions
    const [news, setNews] = useState<NewsItem[]>([]);
    const [heroNews, setHeroNews] = useState<NewsItem | null>(null);
    const [changelog, setChangelog] = useState<ChangelogData | null>(null);
    const [changelogError, setChangelogError] = useState(false);
    const [hytaleVersion, setHytaleVersion] = useState<string>('...');

    useEffect(() => {
        const fetchNews = async () => {
            const api = (window as any).electronAPI;
            if (api && api.getHytaleNews) {
                try {
                    const data = await api.getHytaleNews();
                    if (Array.isArray(data) && data.length > 0) {
                        setHeroNews(data[0]);
                        setNews(data.slice(1, 5));
                    }
                } catch (e) {
                    console.error("Failed to fetch news", e);
                }
            }
        };

        const fetchChangelog = async () => {
            try {
                const response = await fetch('https://raw.githubusercontent.com/D4rkks/hytale-modloader/refs/heads/main/changelog.json');

                if (response.ok) {
                    const data: ChangelogData = await response.json();
                    setChangelog(data);
                    setChangelogError(false);
                } else {
                    setChangelogError(true);
                }
            } catch (e) {
                console.error("Failed to fetch changelog", e);
                setChangelogError(true);
            }
        };

        const fetchHytaleVersion = async () => {
            const api = (window as any).electronAPI;
            if (api?.getLatestVersion) {
                try {
                    const version = await api.getLatestVersion();
                    if (version) {
                        setHytaleVersion(version);
                    }
                } catch (e) {
                    console.error("Failed to fetch Hytale version", e);
                    setHytaleVersion('1.0');
                }
            }
        };

        fetchNews();
        fetchChangelog();
        fetchHytaleVersion();
    }, []);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString();
    };

    const getImageUrl = (s3Key: string) => `https://cdn.hytale.com/variants/blog_cover_${s3Key}`;
    const getPostUrl = (item: NewsItem) => {
        const date = new Date(item.publishedAt);
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        return `https://hytale.com/news/${year}/${month}/${item.slug}`;
    };
    const openExternal = (url: string) => {
        const api = (window as any).electronAPI;
        if (api && api.openExternal) api.openExternal(url);
    };

    const formatChangelogDate = (dateString: string) => {
        const date = new Date(dateString);
        const day = date.getDate();
        const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        return `${day} ${months[date.getMonth()]}`;
    };

    const launcherUpdates = (changelog && changelog.changelog && changelog.changelog.length > 0)
        ? changelog.changelog.slice(0, 2).map(log => ({
            version: log.version,
            date: formatChangelogDate(log.date),
            title: log.title,
            desc: log.changes?.[0]?.description || 'Sem descrição'
        }))
        : [
            {
                version: "v1.0.0",
                date: "21 Jan",
                title: changelogError ? "Erro ao carregar" : "Carregando...",
                desc: changelogError ? "Verifique sua conexão" : "Buscando changelogs..."
            }
        ];

    return (
        <div className="h-full flex flex-col space-y-8 animate-in fade-in duration-500 pb-8">
            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter">
                        Central <span className="text-hytale-accent">Orbis</span>
                    </h2>
                    <p className="text-white/30 text-xs font-bold uppercase tracking-widest mt-1">
                        Sua conexão direta com o universo Hytale
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-[#0a0f16] border border-white/10 rounded-lg flex items-center gap-3">
                        <Tag className="w-4 h-4 text-hytale-accent" />
                        <div>
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest leading-none mb-0.5">Patch Hytale</p>
                            <p className="text-xs font-black text-white uppercase tracking-wide">
                                Early Access {hytaleVersion}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full min-h-0">

                <div className="lg:col-span-8 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">

                    {heroNews ? (
                        <div
                            className="relative h-64 w-full rounded-2xl overflow-hidden group cursor-pointer border border-white/10 shrink-0"
                            onClick={() => openExternal(getPostUrl(heroNews))}
                        >
                            <img
                                src={getImageUrl(heroNews.coverImage.s3Key)}
                                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                alt="Hero"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f16] via-[#0a0f16]/60 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 p-8 w-full">
                                <div className="flex items-center gap-3 mb-2">
                                    <span className="px-2 py-1 bg-hytale-accent text-black text-[9px] font-black uppercase tracking-widest rounded-sm">
                                        Destaque
                                    </span>
                                    <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider flex items-center gap-1">
                                        <Calendar className="w-3 h-3" /> {formatDate(heroNews.publishedAt)}
                                    </span>
                                </div>
                                <h3 className="text-3xl font-black text-white uppercase tracking-tight mb-2 group-hover:text-hytale-accent transition-colors">
                                    {heroNews.title}
                                </h3>
                                <p className="text-sm text-white/70 max-w-2xl line-clamp-2">
                                    {heroNews.bodyExcerpt}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="relative h-64 w-full rounded-2xl overflow-hidden border border-white/10 shrink-0 bg-white/5 animate-pulse flex items-center justify-center">
                            <span className="text-white/20 font-bold uppercase tracking-widest text-xs">Carregando Notícias...</span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {news.map(item => (
                            <div
                                key={item.slug}
                                onClick={() => openExternal(getPostUrl(item))}
                                className="bg-[#0a0f16]/40 border border-white/5 rounded-xl overflow-hidden group hover:border-white/10 transition-all cursor-pointer flex flex-col"
                            >
                                <div className="h-32 w-full overflow-hidden relative">
                                    <img
                                        src={getImageUrl(item.coverImage.s3Key)}
                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110 opacity-60 group-hover:opacity-100"
                                        alt={item.title}
                                    />
                                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 backdrop-blur-md rounded text-[8px] font-black text-white uppercase tracking-widest border border-white/5">
                                        {(item as any).category || 'News'}
                                    </div>
                                </div>
                                <div className="p-4 flex-1 flex flex-col">
                                    <h4 className="text-sm font-black text-white uppercase tracking-wide mb-2 line-clamp-1 group-hover:text-hytale-accent transition-colors">
                                        {item.title}
                                    </h4>
                                    <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2 mb-4 flex-1">
                                        {item.bodyExcerpt}
                                    </p>
                                    <div className="flex items-center justify-between text-[9px] font-bold text-white/20 uppercase tracking-widest">
                                        <span>{formatDate(item.publishedAt)}</span>
                                        <span className="flex items-center gap-1 group-hover:text-white transition-colors">Ler Mais <ArrowRight className="w-3 h-3" /></span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                </div>

                <div className="lg:col-span-4 space-y-6">

                    <div className="bg-[#0a0f16]/60 border border-white/10 rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
                            <h3 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                <Sparkles className="w-3 h-3 text-hytale-accent" /> Novidades do Launcher
                            </h3>
                        </div>
                        <div className="p-1">
                            {launcherUpdates.map((update, i) => (
                                <div key={i} className="p-3 hover:bg-white/5 rounded-lg transition-colors group cursor-default">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-black text-hytale-accent uppercase tracking-wider">{update.version}</span>
                                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-wider">{update.date}</span>
                                    </div>
                                    <p className="text-xs font-bold text-white uppercase tracking-tight mb-0.5">{update.title}</p>
                                    <p className="text-[10px] text-white/40 leading-snug">{update.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div className="p-3 border-t border-white/5 bg-white/[0.01]">
                            <button className="w-full py-2 bg-white/5 hover:bg-white/10 rounded border border-white/5 text-[9px] font-black text-white/40 hover:text-white uppercase tracking-widest transition-all">
                                Ver Changelog Completo
                            </button>
                        </div>
                    </div>

                    <div className="bg-[#0a0f16]/60 border border-white/10 rounded-xl overflow-hidden p-4 space-y-3">
                        <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-2">Links Oficiais</h3>
                        <button
                            onClick={() => openExternal('https://hytale.com/news')}
                            className="w-full flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-lg hover:border-hytale-accent/50 hover:bg-hytale-accent/5 group transition-all"
                        >
                            <span className="text-xs font-bold text-white uppercase tracking-wide">Hytale Blog</span>
                            <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-hytale-accent" />
                        </button>
                        <button
                            onClick={() => openExternal('https://github.com/D4rkks/hytale-modloader/issues')}
                            className="w-full flex items-center justify-between p-3 bg-white/5 border border-white/5 rounded-lg hover:border-hytale-accent/50 hover:bg-hytale-accent/5 group transition-all"
                        >
                            <span className="text-xs font-bold text-white uppercase tracking-wide">Reportar Bug</span>
                            <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-hytale-accent" />
                        </button>
                    </div>

                    {isOfflineMode ? (
                        <div className="p-4 border rounded-xl flex items-center gap-4 transition-colors bg-white/5 border-white/10">
                            <div className="w-2 h-2 rounded-full shrink-0 bg-white/20"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/40">Modo Offline</p>
                                <p className="text-[10px] uppercase tracking-wide text-white/20">Sem conexão • Recursos limitados</p>
                            </div>
                        </div>
                    ) : isConnected ? (
                        <div className="p-4 border rounded-xl flex items-center gap-4 transition-colors bg-hytale-emerald/10 border-hytale-emerald/20">
                            <div className="w-2 h-2 rounded-full shrink-0 bg-hytale-emerald animate-pulse"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-hytale-emerald">Rede Orbis Online</p>
                                <p className="text-[10px] uppercase tracking-wide text-hytale-emerald/60">Conectado • Chat e amigos disponíveis</p>
                            </div>
                        </div>
                    ) : connectionError ? (
                        <div className="p-4 border rounded-xl flex items-center gap-4 transition-colors bg-red-500/10 border-red-500/20">
                            <div className="w-2 h-2 rounded-full shrink-0 bg-red-500"></div>
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-red-400">Erro de Conexão</p>
                                <p className="text-[10px] uppercase tracking-wide text-red-400/60">Não foi possível conectar à Rede Orbis</p>
                            </div>
                        </div>
                    ) : (
                        <div className="p-4 border rounded-xl flex items-center gap-4 transition-colors bg-hytale-accent/10 border-hytale-accent/20">
                            <Loader2 className="w-4 h-4 text-hytale-accent animate-spin" />
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-hytale-accent">Conectando...</p>
                                <p className="text-[10px] uppercase tracking-wide text-hytale-accent/60">Estabelecendo conexão com a Rede Orbis</p>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
};

export default Dashboard;

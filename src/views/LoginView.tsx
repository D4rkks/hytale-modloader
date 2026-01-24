import React, { useState, useEffect } from 'react';
import { Github, ShieldCheck, ArrowLeft } from 'lucide-react';

interface LoginViewProps {
    onLogin: (userData: any) => void;
    onBack?: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onLogin, onBack }) => {
    const [isLoggingIn, setIsLoggingIn] = useState(false);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    const [nickname, setNickname] = useState('');

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isOfflineMode) {
                    setIsOfflineMode(false);
                } else if (onBack) {
                    onBack();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onBack, isOfflineMode]);

    const handleHytaleLogin = async () => {
        setIsLoggingIn(true);
        const electron = (window as any).electronAPI;
        if (electron) {
            try {
                const result = await electron.startHytaleOAuth();
                if (result.success) {
                    onLogin(result.account);
                } else {
                    console.error("Hytale Login failed:", result.error);
                }
            } catch (err) {
                console.error("Hytale Login error:", err);
            }
        } else {
            // Dev simulation
            setTimeout(() => {
                onLogin({ username: 'HytalePlayer', uuid: 'hytale-uuid', type: 'hytale' });
                setIsLoggingIn(false);
            }, 1000);
        }
        setIsLoggingIn(false);
    };

    const handleGuestLogin = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!nickname.trim()) return;

        setIsLoggingIn(true);
        const electron = (window as any).electronAPI;
        if (electron) {
            const result = await electron.addOfflineAccount(nickname);
            if (result.success) {
                onLogin(result.account);
            }
        } else {
            setTimeout(() => {
                onLogin({ username: nickname, uuid: 'guest-uuid', type: 'offline' });
                setIsLoggingIn(false);
            }, 1000);
        }
        setIsLoggingIn(false);
    };

    return (
        <div className="flex-1 relative flex items-center justify-center bg-[#0a0f16] overflow-hidden">
            <div className="absolute inset-0 z-0">
                <div className="w-full h-full bg-gradient-to-br from-[#1a1f2e] via-[#0d1117] to-[#0a0f16]" />
                <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f16] via-[#0a0f16]/60 to-[#0a0f16]/90"></div>
            </div>

            <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 w-full max-w-6xl h-[700px] orbis-panel rounded-[40px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-8 duration-1000 border border-white/5">

                <div className="hidden lg:flex flex-col justify-between p-20 relative overflow-hidden bg-white/[0.02]">
                    <div className="relative z-10">
                        <div className="flex items-center gap-4 mb-16">
                            <div className="w-12 h-12 bg-hytale-accent rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(245,184,65,0.2)]">
                                <ShieldCheck className="w-7 h-7 text-black" />
                            </div>
                            <span className="text-[11px] font-bold text-white uppercase tracking-[0.4em] opacity-50">Portal do Explorador</span>
                        </div>

                        <h1 className="text-7xl font-black text-white uppercase tracking-tighter leading-[0.9] mb-10">
                            BEM-VINDO A <br /><span className="text-hytale-accent">ORBIS</span>
                        </h1>

                        <p className="text-lg text-white/40 font-normal max-w-sm leading-relaxed border-l-2 border-white/10 pl-6">
                            Sua porta de entrada para o universo de Hytale começa aqui. Autentique-se para gerenciar seus mundos e mods.
                        </p>
                    </div>

                    <div className="relative z-10">
                        <div className="flex items-center gap-6 text-white/30 text-[9px] font-black uppercase tracking-[0.4em]">
                            <span className="flex items-center gap-2 text-hytale-accent/60">
                                <div className="w-1.5 h-1.5 bg-hytale-accent rounded-full animate-pulse"></div>
                                Segurança Ativa
                            </span>
                            <span className="w-1 h-1 bg-white/10 rounded-full"></span>
                            <span>Criptografia Orbis</span>
                        </div>
                    </div>

                    <div className="absolute -bottom-10 -right-10 opacity-[0.03]">
                        <ShieldCheck className="w-[500px] h-[500px] rotate-12" />
                    </div>
                </div>

                <div className="p-20 flex flex-col justify-center items-center bg-[#0a141d]/40 backdrop-blur-3xl border-l border-white/5 relative">
                    {(onBack || isOfflineMode) && (
                        <button
                            onClick={() => isOfflineMode ? setIsOfflineMode(false) : onBack?.()}
                            className="absolute top-10 right-10 p-4 text-white/20 hover:text-white hover:bg-white/5 rounded-2xl transition-all flex items-center gap-3 group border border-transparent hover:border-white/10"
                        >
                            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Voltar</span>
                        </button>
                    )}

                    <div className="max-w-sm w-full space-y-16">
                        <div className="space-y-4 text-center">
                            <h2 className="text-5xl font-black text-white uppercase tracking-[0.1em]">Acesso</h2>
                            <p className="text-white/30 text-[11px] font-normal uppercase tracking-[0.2em] leading-relaxed mx-auto max-w-[280px]">
                                {isOfflineMode ? 'Defina sua identidade para a aventura.' : 'Use sua conta oficial para uma experiência completa em Orbis.'}
                            </p>
                        </div>

                        {isOfflineMode ? (
                            <form onSubmit={handleGuestLogin} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] ml-2">Nickname</label>
                                    <input
                                        type="text"
                                        value={nickname}
                                        onChange={(e) => setNickname(e.target.value)}
                                        placeholder="Ex: Aventureiro"
                                        className="w-full bg-[#0a0f16]/50 border-2 border-white/5 focus:border-hytale-accent/50 rounded-2xl px-6 py-4 text-white placeholder:text-white/10 text-sm font-bold tracking-wider outline-none transition-all text-center"
                                        autoFocus
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={!nickname.trim() || isLoggingIn}
                                    className="w-full py-4 bg-white/5 hover:bg-hytale-accent text-white hover:text-black rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all border border-white/10 hover:border-hytale-accent active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoggingIn ? 'Entrando...' : 'Confirmar Identidade'}
                                </button>
                            </form>
                        ) : (
                            <>
                                <div className="relative group text-center">
                                    <div className="absolute inset-0 bg-hytale-accent/10 blur-[80px] rounded-full group-hover:bg-hytale-accent/20 transition-all duration-700"></div>
                                    <button
                                        onClick={handleHytaleLogin}
                                        disabled={isLoggingIn}
                                        className="relative w-full h-28 bg-hytale-accent hover:bg-[#ffc65c] text-black font-black uppercase tracking-[0.3em] text-base rounded-[32px] transition-all shadow-[0_25px_60px_rgba(0,0,0,0.4),0_15px_30px_rgba(245,184,65,0.2)] flex flex-col items-center justify-center gap-3 active:scale-[0.98] border-b-[6px] border-black/10 group overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none"></div>
                                        <ShieldCheck className="w-9 h-9 group-hover:scale-110 transition-transform duration-500" />
                                        <span className="relative">{isLoggingIn ? 'Conectando...' : 'Entrar via Hytale'}</span>
                                    </button>
                                </div>

                                <div className="space-y-8 text-center pt-8">
                                    <div className="flex flex-col items-center gap-4">
                                        <p className="text-[9px] text-white/10 font-normal uppercase tracking-[0.5em]">
                                            Integrado com Orbis Shield v2.4
                                        </p>
                                        <div className="w-12 h-[1px] bg-white/5"></div>
                                        <button className="p-4 bg-white/[0.02] rounded-2xl hover:bg-white/5 transition-all border border-white/5 group opacity-30 hover:opacity-100 flex items-center gap-3">
                                            <Github className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                                            <span className="text-[8px] font-black text-white uppercase tracking-[0.3em]">GitHub Repo</span>
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => setIsOfflineMode(true)}
                                        className="text-[10px] font-black text-white/20 uppercase tracking-[0.2em] hover:text-hytale-accent transition-colors border-b border-transparent hover:border-hytale-accent/30 pb-1"
                                    >
                                        Jogar em Modo Offline
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="absolute bottom-12 left-0 right-0 text-center">
                        <span className="text-[9px] font-black text-white/[0.03] uppercase tracking-[1.5em]">LAUNCHER v1.0.0</span>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default LoginView;

import React, { useState } from 'react';
import { Globe, X } from 'lucide-react';
import SupabaseService from '../services/SupabaseService';

interface OrbisLoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const OrbisLoginModal = ({ isOpen, onClose, onSuccess }: OrbisLoginModalProps) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [username, setUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (mode === 'login') {
                await SupabaseService.login(email, password);
            } else {
                if (!username || username.length < 3) {
                    throw new Error('Username deve ter pelo menos 3 caracteres');
                }
                await SupabaseService.registerUser(email, password, username);
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Erro ao processar');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-8 backdrop-blur-xl bg-[#0a0f16]/95 animate-in fade-in duration-300">
            <div className="w-full max-w-md bg-[#0a0f16] border border-white/10 rounded-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl relative">

                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 text-white/20 hover:text-white/60 transition-colors rounded-full hover:bg-white/5"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="text-center space-y-2">
                    <div className="w-16 h-16 bg-hytale-accent/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Globe className="w-8 h-8 text-hytale-accent" />
                    </div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-widest">
                        Rede Orbis
                    </h2>
                    <p className="text-xs text-white/40 font-bold uppercase tracking-wide">
                        {mode === 'login' ? 'Entre na sua conta' : 'Criar nova conta'}
                    </p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                        <p className="text-xs text-red-400 text-center">{error}</p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'register' && (
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block pl-1">
                                Username
                            </label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="escolha_seu_nome"
                                className="w-full bg-[#05080b] border border-white/10 p-4 rounded text-white focus:outline-none focus:border-hytale-accent transition-all font-bold placeholder:text-white/10 text-sm"
                                required
                            />
                        </div>
                    )}

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block pl-1">
                            Email
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            className="w-full bg-[#05080b] border border-white/10 p-4 rounded text-white focus:outline-none focus:border-hytale-accent transition-all font-bold placeholder:text-white/10 text-sm"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-white/40 uppercase tracking-widest block pl-1">
                            Senha
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full bg-[#05080b] border border-white/10 p-4 rounded text-white focus:outline-none focus:border-hytale-accent transition-all font-bold placeholder:text-white/10 text-sm"
                            required
                            minLength={8}
                        />
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 rounded font-black uppercase tracking-widest text-[10px] text-white/40 hover:text-white transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-hytale-accent text-black font-black uppercase tracking-widest text-[10px] rounded hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Carregando...' : (mode === 'login' ? 'Entrar' : 'Criar Conta')}
                        </button>
                    </div>
                </form>

                <div className="text-center pt-2 border-t border-white/5">
                    <button
                        type="button"
                        onClick={() => {
                            setMode(mode === 'login' ? 'register' : 'login');
                            setError('');
                        }}
                        className="text-xs text-white/40 hover:text-hytale-accent transition-colors font-bold uppercase tracking-wide"
                    >
                        {mode === 'login' ? 'Não tem conta? Criar agora' : 'Já tem conta? Fazer login'}
                    </button>
                </div>

            </div>
        </div>
    );
};

export default OrbisLoginModal;

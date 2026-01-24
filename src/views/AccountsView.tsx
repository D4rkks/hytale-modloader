import React, { useState, useEffect } from 'react';
import { Users, Trash2, UserPlus, ShieldCheck, Star, ArrowLeft } from 'lucide-react';

interface Account {
    id: string;
    username: string;
    uuid: string;
    type: string;
}

interface AccountsViewProps {
    activeUser: { username: string; uuid: string } | null;
    onSwitch: (userData: any) => void;
    onAdd: () => void;
    onLogout: () => void;
    onBack?: () => void;
    isGameRunning?: boolean;
}

const AccountsView: React.FC<AccountsViewProps> = ({ activeUser, onSwitch, onAdd, onLogout, onBack, isGameRunning }) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchAccounts = async () => {
        const electron = (window as any).electronAPI;
        if (electron) {
            const list = await electron.getAccounts();
            setAccounts(list);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleRemove = async (id: string) => {
        const electron = (window as any).electronAPI;
        if (electron) {
            const accountToDelete = accounts.find(a => a.id === id);
            await electron.removeAccount(id);

            if (activeUser && accountToDelete && accountToDelete.uuid === activeUser.uuid) {
                onLogout();
            } else {
                const newList = await electron.getAccounts();
                setAccounts(newList);
                if (newList.length === 0) {
                    onLogout();
                }
            }
        }
    };

    const handleSwitch = async (account: Account) => {
        const electron = (window as any).electronAPI;
        if (electron) {
            await electron.setActiveAccount(account.id);
            onSwitch(account);
        }
    };



    return (
        <div className="h-full flex flex-col animate-in fade-in duration-700 relative">
            {onBack && (
                <button
                    onClick={onBack}
                    className="absolute -top-20 left-0 p-4 text-white/20 hover:text-white hover:bg-white/5 rounded-2xl transition-all flex items-center gap-3 group border border-transparent hover:border-white/10"
                >
                    <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Voltar</span>
                </button>
            )}
            <div className="flex items-center justify-between mb-12">
                <div>
                    <h2 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">Perfis de <span className="text-hytale-accent">Explorador</span></h2>
                    <p className="text-white/40 italic font-medium">Gerencie suas identidades Orbis e alterne entre elas com facilidade.</p>
                </div>
                <button
                    onClick={() => !isGameRunning && onAdd()}
                    disabled={isGameRunning}
                    className={`flex items-center gap-3 px-6 py-3 rounded-lg font-black uppercase tracking-widest text-[10px] transition-all ${isGameRunning
                        ? 'bg-white/5 text-white/20 cursor-not-allowed border border-white/5'
                        : 'bg-hytale-accent hover:brightness-110 text-black shadow-[0_5px_15px_rgba(245,184,65,0.1)] active:scale-95'}`}
                    title={isGameRunning ? "Jogo em execução" : "Adicionar nova conta"}
                >
                    <UserPlus className="w-4 h-4" /> Novo Usuário
                </button>
            </div>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-hytale-accent/20 border-t-hytale-accent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-12">
                    {accounts.map((account) => {
                        const isActive = activeUser?.uuid === account.uuid;
                        return (
                            <div
                                key={account.id}
                                onClick={() => {
                                    if (isActive && onBack) {
                                        onBack();
                                    } else if (!isGameRunning && !isActive) {
                                        handleSwitch(account);
                                    }
                                }}
                                className={`orbis-panel group relative overflow-hidden flex flex-col p-6 transition-all duration-500 ${isGameRunning && !isActive ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:scale-[1.02] hover:shadow-[0_0_40px_rgba(245,184,65,0.1)]'} ${isActive ? 'border-hytale-accent/50 bg-hytale-accent/[0.03] shadow-[0_0_30px_rgba(245,184,65,0.05)]' : 'border-white/5 hover:border-white/20'}`}
                            >
                                <div className="flex items-start justify-between mb-6">
                                    <div className="relative">
                                        <div className="w-16 h-16 rounded-xl bg-[#1c2635] border border-white/10 overflow-hidden flex items-center justify-center p-1">
                                            <img
                                                src={`https://hyvatar.io/render/${account.type === 'offline' ? 'Varyn' : account.username}?size=128&rotate=0`}
                                                className="w-full h-full object-contain"
                                                alt={account.username}
                                                onError={(e) => {
                                                    if (account.type !== 'offline') {
                                                        e.currentTarget.src = `https://hyvatar.io/render/Varyn?size=128&rotate=0`;
                                                    }
                                                }}
                                            />
                                        </div>
                                        {isActive && (
                                            <div className="absolute -top-2 -right-2 w-6 h-6 bg-hytale-accent rounded-full flex items-center justify-center shadow-lg">
                                                <Star className="w-3.5 h-3.5 text-black fill-current" />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); !isGameRunning && handleRemove(account.id); }}
                                        disabled={isGameRunning}
                                        className={`p-2 rounded-lg transition-all ${isGameRunning ? 'text-white/5 cursor-not-allowed' : 'text-white/10 hover:text-red-500 hover:bg-red-500/10'}`}
                                        title={isGameRunning ? "Jogo em execução" : "Remover conta"}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-1">
                                    <h3 className="text-xl font-black text-white uppercase tracking-tight">{account.username}</h3>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-1.5 h-1.5 rounded-full ${account.type === 'offline' ? 'bg-red-500' : (isActive ? 'bg-hytale-emerald animate-pulse' : 'bg-white/20')}`}></div>
                                        <span className={`text-[9px] font-black uppercase tracking-[0.2em] ${account.type === 'offline' ? 'text-red-500' : (isActive ? 'text-hytale-emerald' : 'text-white/20')}`}>
                                            {account.type === 'offline' ? 'Offline' : (isActive ? 'Ativo' : 'Salvo local')}
                                        </span>
                                    </div>
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/5 flex items-center h-10">
                                    <div className="flex-1">
                                        {account.type === 'hytale' ? (
                                            <div className="flex items-center gap-2 text-[8px] font-bold text-hytale-accent uppercase tracking-widest">
                                                <ShieldCheck className="w-3 h-3" /> Verificado
                                            </div>
                                        ) : (
                                            <div className="inline-flex items-center gap-2 text-[8px] font-bold text-red-500 uppercase tracking-widest bg-red-500/5 px-2 py-1 rounded border border-red-500/10">
                                                <div className="w-1.5 h-1.5 bg-red-500 rounded-sm"></div> Não Verificado
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}

                    {accounts.length === 0 && (
                        <div className="col-span-full py-20 flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-[32px] bg-white/[0.01] space-y-8 animate-in fade-in zoom-in duration-1000">
                            <div className="relative">
                                <div className="absolute inset-0 bg-hytale-accent/5 blur-[40px] rounded-full animate-pulse"></div>
                                <Users className="w-20 h-20 text-white/5 relative z-10" />
                            </div>
                            <div className="text-center space-y-2">
                                <p className="text-white/40 font-black uppercase tracking-[0.4em] text-sm leading-relaxed">Nenhuma conta salva</p>
                                <p className="text-white/10 text-[10px] font-bold uppercase tracking-[0.2em]">Crie um perfil Orbis para começar sua jornada.</p>
                            </div>
                            <button
                                onClick={() => onAdd()}
                                className="group relative px-10 py-5 bg-white/5 hover:bg-hytale-accent text-white/50 hover:text-black rounded-2xl border border-white/10 hover:border-hytale-accent transition-all duration-500 flex items-center gap-4 overflow-hidden active:scale-95 shadow-xl hover:shadow-hytale-accent/20"
                            >
                                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <UserPlus className="w-5 h-5 group-hover:scale-110 transition-transform" />
                                <span className="text-xs font-black uppercase tracking-[0.3em] relative z-10">Vincular Conta Hytale</span>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AccountsView;

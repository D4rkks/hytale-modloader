
import React from 'react';
import { X, Search, UserPlus } from 'lucide-react';

interface Friend {
    id: string;
    username: string;
    avatar: string;
    status: string;
}

interface FriendSelectorModalProps {
    friends: Friend[];
    onSelect: (friendId: string) => void;
    onClose: () => void;
}

export default function FriendSelectorModal({ friends, onSelect, onClose }: FriendSelectorModalProps) {
    const [search, setSearch] = React.useState('');

    const filteredFriends = friends.filter(f =>
        f.username.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-[400px] bg-[#0F131A] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-hytale-accent/10 rounded-lg">
                            <UserPlus className="w-5 h-5 text-hytale-accent" />
                        </div>
                        <div>
                            <h3 className="text-sm font-black text-white uppercase tracking-wide">Convidar Amigo</h3>
                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Selecione um amigo para o grupo</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-lg transition-colors text-white/40 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 border-b border-white/5">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 group-focus-within:text-hytale-accent transition-colors" />
                        <input
                            type="text"
                            placeholder="Buscar amigos..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full bg-black/20 border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-hytale-accent/50 transition-all placeholder:text-white/20"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="max-h-[300px] overflow-y-auto custom-scrollbar p-2 space-y-1">
                    {filteredFriends.length === 0 ? (
                        <div className="p-8 text-center flex flex-col items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                <Search className="w-5 h-5 text-white/20" />
                            </div>
                            <p className="text-white/30 text-xs italic">
                                {friends.length === 0 ? 'Nenhum amigo online disponível.' : 'Nenhum amigo encontrado.'}
                            </p>
                        </div>
                    ) : (
                        filteredFriends.map(friend => (
                            <button
                                key={friend.id}
                                onClick={() => onSelect(friend.id)}
                                className="w-full p-2 flex items-center gap-3 hover:bg-white/5 rounded-xl group transition-all"
                            >
                                <div className="relative">
                                    <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 group-hover:border-hytale-accent/30 transition-colors">
                                        <img src={friend.avatar} alt={friend.username} className="w-full h-full object-cover" />
                                    </div>
                                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-[#0F131A] ${friend.status === 'Online' ? 'bg-hytale-emerald' : 'bg-white/20'
                                        }`}></div>
                                </div>

                                <div className="flex-1 text-left">
                                    <span className="block text-sm font-bold text-white group-hover:text-hytale-accent transition-colors">
                                        {friend.username}
                                    </span>
                                    <span className="text-[10px] text-white/30 uppercase tracking-wider font-bold">
                                        {friend.status}
                                    </span>
                                </div>

                                <div className="px-3 py-1.5 bg-white/5 rounded-lg text-[10px] font-bold text-white/40 group-hover:bg-hytale-accent group-hover:text-black transition-all uppercase tracking-wide">
                                    Convidar
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

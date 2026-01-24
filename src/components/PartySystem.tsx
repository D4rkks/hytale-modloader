import { X, Crown, MessageSquare, LogOut } from 'lucide-react';

export interface PartyMember {
  id: string;
  name: string;
  username: string;
  avatar: string;
  status: string;
  isLeader: boolean;
  isAdmin?: boolean;
}

interface PartySystemProps {
  members: PartyMember[];
  onRemoveMember: (memberId: string, memberName: string) => void;
  onLeaveParty: () => void;
  onOpenChat: () => void;
}

export default function PartySystem({ members, onRemoveMember, onLeaveParty, onOpenChat }: PartySystemProps) {
  return (
    <div className="border-t border-white/5 bg-black/20">
      <div className="p-4 flex items-center justify-between">
        <h3 className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] flex items-center gap-2">
          Grupo <span className="text-hytale-accent">{members.length}/4</span>
        </h3>
        <div className="flex gap-1">
          <button
            onClick={onOpenChat}
            className="p-1.5 hover:bg-white/10 rounded transition-colors text-white/40 hover:text-hytale-accent"
            title="Abrir Chat do Grupo"
          >
            <MessageSquare className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onLeaveParty}
            className="p-1.5 hover:bg-red-500/10 rounded transition-colors text-white/40 hover:text-red-500"
            title="Sair do Grupo"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-4 space-y-1">
        {members.map((member) => (
          <div key={member.name} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg group transition-colors">
            <div className="relative w-8 h-8 rounded-lg bg-black/40 border border-white/5 overflow-hidden">
              <img src={member.avatar} alt={member.name} className="w-full h-full object-cover" />
              {member.isLeader && (
                <div className="absolute top-0 right-0 bg-black/60 p-0.5 rounded-bl">
                  <Crown className="w-2.5 h-2.5 text-hytale-accent fill-hytale-accent" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-white uppercase truncate">{member.name}</p>
              <p className={`text-[8px] font-bold uppercase tracking-widest ${member.status === 'Online' ? 'text-hytale-emerald' : 'text-white/20'}`}>
                {member.status}
              </p>
            </div>

            {!member.isLeader && (
              <button
                onClick={() => onRemoveMember(member.id, member.name)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded text-white/20 hover:text-red-400 transition-all"
                title="Expulsar"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

import { Check, X } from 'lucide-react';

interface PartyInviteProps {
  inviter: { name: string; avatar: string };
  onAccept: () => void;
  onDecline: () => void;
}

export default function PartyInvite({ inviter, onAccept, onDecline }: PartyInviteProps) {
  return (
    <div className="fixed bottom-20 right-20 z-50 animate-in slide-in-from-right duration-300">
      <div className="bg-[#0a0f16] border border-hytale-accent/30 rounded-xl shadow-2xl p-4 w-[280px] relative overflow-hidden group">
        <div className="absolute top-0 left-0 w-1 h-full bg-hytale-accent"></div>

        <div className="flex items-start gap-4 mb-3">
          <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 shrink-0">
            <img src={inviter.avatar} alt={inviter.name} className="w-full h-full object-cover" />
          </div>
          <div>
            <h4 className="text-[10px] font-black text-hytale-accent uppercase tracking-widest mb-1">Convite de Grupo</h4>
            <p className="text-xs text-white leading-tight">
              <span className="font-bold">{inviter.name}</span> te convidou para jogar!
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 bg-hytale-emerald text-black py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center gap-2"
          >
            <Check className="w-3 h-3" /> Aceitar
          </button>
          <button
            onClick={onDecline}
            className="flex-1 bg-white/5 text-white/60 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-white/10 hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <X className="w-3 h-3" /> Recusar
          </button>
        </div>
      </div>
    </div>
  );
}

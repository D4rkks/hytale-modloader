import { MessageSquare, Users, UserMinus } from 'lucide-react';
import { useLayoutEffect, useRef, useState, useEffect } from 'react';

interface FriendContextMenuProps {
  position: { x: number; y: number };
  onOpenChat: () => void;
  onInviteToParty: () => void;
  onRemoveFriend: () => void;
  onClose: () => void;
}

export default function FriendContextMenu({
  position,
  onOpenChat,
  onInviteToParty,
  onRemoveFriend,
  onClose
}: FriendContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [isVisible, setIsVisible] = useState(false);

  useLayoutEffect(() => {
    if (menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      const padding = 8;
      let { x, y } = position;

      if (x + menuRect.width > window.innerWidth - padding) {
        x = window.innerWidth - menuRect.width - padding;
      }

      if (y + menuRect.height > window.innerHeight - padding) {
        y = window.innerHeight - menuRect.height - padding;
      }

      setAdjustedPosition({ x, y });
      setIsVisible(true);
    }
  }, [position]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('contextmenu', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 bg-[#0a0f16] border border-white/10 rounded-lg shadow-2xl py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100 ${!isVisible ? 'opacity-0' : 'opacity-100'
        }`}
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`
      }}
    >
      <button
        onClick={() => {
          onOpenChat();
          onClose();
        }}
        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
      >
        <MessageSquare className="w-4 h-4 text-hytale-accent" />
        <span className="text-xs font-bold text-white/80">Abrir Chat</span>
      </button>
      <button
        onClick={() => {
          onInviteToParty();
          onClose();
        }}
        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-white/5 transition-colors text-left"
      >
        <Users className="w-4 h-4 text-hytale-mana" />
        <span className="text-xs font-bold text-white/80">Convidar para Party</span>
      </button>
      <div className="h-px bg-white/5 my-1" />
      <button
        onClick={() => {
          onRemoveFriend();
          onClose();
        }}
        className="w-full px-4 py-2 flex items-center gap-3 hover:bg-red-500/10 transition-colors text-left"
      >
        <UserMinus className="w-4 h-4 text-red-500" />
        <span className="text-xs font-bold text-red-500">Remover Amigo</span>
      </button>
    </div>
  );
}

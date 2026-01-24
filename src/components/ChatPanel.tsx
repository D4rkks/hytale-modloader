import { X, Send, Minimize2, Users as UsersIcon, Copy, Trash2, Check, Clock, AlertCircle } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import SupabaseService from '../services/SupabaseService';

interface Message {
  id: string;
  sender: string;
  text: string;
  timestamp: Date;
  isOwn: boolean;
  senderAvatar?: string;
  status?: 'sending' | 'sent' | 'error';
  readAt?: Date;
}

interface ChatPanelProps {
  friend?: {
    name: string;
    status: string;
    avatar: string;
    game?: string;
    id?: string; // Friend's user ID for messaging
  };
  partyId?: string; // If set, this is a party chat
  currentUserAvatar?: string;
  onClose: () => void;
  onInviteToParty?: () => void;
  onMessageReceived?: (friendId: string) => void;
  className?: string;
}

export default function ChatPanel({ friend, partyId, currentUserAvatar, onClose, onInviteToParty, onMessageReceived, className = '' }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadWhileMinimized, setUnreadWhileMinimized] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [messageContextMenu, setMessageContextMenu] = useState<{ x: number, y: number, message: Message } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load message history when chat opens
  useEffect(() => {
    const loadHistory = async () => {
      setIsLoading(true);
      try {
        let history = [];
        const currentUserId = SupabaseService.getCurrentUserId();

        if (partyId) {
          history = await SupabaseService.getPartyMessages(partyId);
        } else if (friend?.id) {
          history = await SupabaseService.getMessages(friend.id);
        }

        const formattedMessages: Message[] = history.map((msg: any) => ({
          id: msg.id,
          sender: msg.sender_id === currentUserId ? 'Você' : (msg.profiles?.username || 'Unknown'),
          text: msg.content,
          timestamp: new Date(msg.created_at),
          isOwn: msg.sender_id === currentUserId,
          senderAvatar: msg.sender_id === currentUserId ? currentUserAvatar : (friend?.avatar || `https://hyvatar.io/render/${msg.profiles?.username}?size=128`),
          status: 'sent' as const,
          readAt: msg.read_at ? new Date(msg.read_at) : undefined
        }));

        setMessages(formattedMessages);
      } catch (err) {
        console.error('Failed to load message history:', err);
      } finally {
        setIsLoading(false);
      }
    };

    loadHistory();
  }, [friend?.id, friend?.name, partyId, currentUserAvatar]);

  // Subscribe to conversation (both sent and received messages)
  useEffect(() => {
    const currentUserId = SupabaseService.getCurrentUserId();

    const handleNewMessage = (newMsg: any) => {
      // Logic for Friend Chat
      if (friend?.id) {
        const isFromThisFriend = newMsg.sender_id === friend.id;
        if (isFromThisFriend) setIsTyping(false);
        if (isMinimized && isFromThisFriend) setUnreadWhileMinimized(prev => prev + 1);
        if (!isMinimized && isFromThisFriend) onMessageReceived?.(friend.id);
      }

      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;

        // Remove optimistic message if this is our sent message
        const filtered = prev.filter(m => {
          if (m.isOwn && m.text === newMsg.content && (new Date().getTime() - m.timestamp.getTime() < 10000)) {
            return false; // Remove optimistic, replace with real
          }
          return true;
        });

        const isOwn = newMsg.sender_id === currentUserId;
        // Determine sender name/avatar
        let senderName = isOwn ? 'Você' : (newMsg.profiles?.username || 'Unknown');
        let senderAvatar = isOwn ? currentUserAvatar : (newMsg.profiles?.avatar_url || `https://hyvatar.io/render/${newMsg.profiles?.username}?size=128`);

        if (friend && newMsg.sender_id === friend.id) {
          senderName = friend.name;
          senderAvatar = friend.avatar;
        }

        return [...filtered, {
          id: newMsg.id,
          sender: senderName,
          text: newMsg.content || newMsg.encrypted_content, // Fallback
          timestamp: new Date(newMsg.created_at),
          isOwn,
          senderAvatar,
          status: 'sent' as const,
          readAt: newMsg.read_at ? new Date(newMsg.read_at) : undefined
        }].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      });
    };

    let subscription: any;

    if (partyId) {
      subscription = SupabaseService.subscribeToPartyMessages(partyId, handleNewMessage);
    } else if (friend?.id) {
      subscription = SupabaseService.subscribeToConversation(friend.id, handleNewMessage, (deletedId) => {
        setMessages(prev => prev.filter(m => m.id !== deletedId && !m.id.startsWith('temp-')));
      });
    }

    return () => {
      if (typeof subscription === 'function') {
        subscription();
      } else {
        subscription?.unsubscribe();
      }
    };
  }, [friend?.id, partyId, isMinimized, currentUserAvatar, onMessageReceived]);

  // Subscribe to typing indicator
  useEffect(() => {
    if (!friend?.id) return;

    const unsubscribe = SupabaseService.subscribeToTyping(friend.id, (typing: boolean) => {
      setIsTyping(typing);
    });

    return () => {
      unsubscribe?.();
    };
  }, [friend?.id]);

  // Mark as read when active
  useEffect(() => {
    if (friend?.id && !isMinimized && messages.length > 0) {
      SupabaseService.markMessagesAsRead(friend.id);
    }
  }, [friend?.id, isMinimized, messages.length]);

  // Scroll to bottom when messages change or typing indicator appears
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Handle outside click for context menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMessageContextMenu(null);
      }
    };
    if (messageContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [messageContextMenu]);

  const handleMessageRightClick = (e: React.MouseEvent, message: Message) => {
    e.preventDefault();
    e.stopPropagation();
    setMessageContextMenu({
      x: e.clientX,
      y: e.clientY,
      message
    });
  };

  const handleCopyMessage = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessageContextMenu(null);
  };

  const handleDeleteMessage = async (messageId: string) => {
    // Store original messages for revert
    const originalMessages = [...messages];

    // Optimistic UI update
    setMessages(prev => prev.filter(m => m.id !== messageId));
    setMessageContextMenu(null);

    try {
      // If it's a temporary ID, it's already gone from UI, just return
      if (messageId.startsWith('temp-')) {
        console.log('🗑️ Removing temporary message from UI:', messageId);
        return;
      }

      console.log('🗑️ Sending delete request to backend for message:', messageId);
      await SupabaseService.deleteMessage(messageId);

      // Success - no further action needed as UI is already updated
    } catch (err: any) {
      console.error('❌ Failed to delete message on server:', err);
      // Revert UI change
      setMessages(originalMessages);
      // Show toast or alert (using a simple alert or console for now, maybe toast if passed)
      // Assuming parent might handle toast, but here just log and revert
      alert(`Erro ao deletar mensagem: ${err.message}`);
    }
  };

  // Handle typing indicator
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length > 2500) return; // Character limit

    setInput(value);

    if (partyId) return; // Typing indicator not implemented for party chat

    if (!friend?.id || !value.trim()) return;

    const now = Date.now();
    // Only send typing indicator every 2 seconds to avoid spam
    if (now - lastTypingSentRef.current > 2000) {
      lastTypingSentRef.current = now;
      SupabaseService.sendTypingIndicator(friend.id, true);
    }

    // Clear typing after 3 seconds of inactivity
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      if (friend.id) {
        SupabaseService.sendTypingIndicator(friend.id, false);
      }
    }, 3000);
  }, [friend?.id, partyId]);

  // Message Queue System
  const messageQueue = useRef<Array<{
    tempId: string;
    text: string;
    targetId: string;
    isParty: boolean;
  }>>([]);
  const isProcessingQueue = useRef(false);

  const processQueue = async () => {
    if (isProcessingQueue.current || messageQueue.current.length === 0) return;

    isProcessingQueue.current = true;

    while (messageQueue.current.length > 0) {
      const item = messageQueue.current[0]; // Peek

      try {
        let sentMessage: any;

        if (item.isParty) {
          sentMessage = await SupabaseService.sendPartyMessage(item.targetId, item.text);
        } else {
          sentMessage = await SupabaseService.sendMessage(item.targetId, item.text);
        }

        // Success: Update status to sent AND update ID to real DB ID
        if (sentMessage && sentMessage.id) {
          setMessages(prev => prev.map(m =>
            m.id === item.tempId ? { ...m, status: 'sent', id: sentMessage.id } : m
          ));
        } else {
          // Fallback if no ID returned (shouldn't happen with new service logic)
          setMessages(prev => prev.map(m =>
            m.id === item.tempId ? { ...m, status: 'sent' } : m
          ));
        }

        // Remove from queue
        messageQueue.current.shift();

      } catch (err) {
        console.error('Failed to send message:', err);
        // On error, mark as error and remove from queue (or retry logic could go here)
        // For now, removing to prevent blocking, user sees red icon
        setMessages(prev => prev.map(m =>
          m.id === item.tempId ? { ...m, status: 'error' } : m
        ));
        messageQueue.current.shift();

        // Small delay before next attempt if there are errors, to avoid spamming fails
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    isProcessingQueue.current = false;
  };

  const handleSend = async () => {
    if (!input.trim() || input.length > 2500) return;

    // Rate limit removed in favor of queue
    const textToSend = input;
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Stop typing indicator
    if (!partyId) {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (friend?.id) SupabaseService.sendTypingIndicator(friend.id, false);
    }

    // Optimistic UI update
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setMessages(prev => [...prev, {
      id: tempId,
      sender: 'Você',
      text: textToSend,
      timestamp: new Date(),
      isOwn: true,
      senderAvatar: currentUserAvatar,
      status: 'sending'
    }]);

    // Add to queue
    const targetId = partyId || friend?.id;
    if (targetId) {
      messageQueue.current.push({
        tempId,
        text: textToSend,
        targetId,
        isParty: !!partyId
      });
      processQueue();
    } else {
      console.error('Cannot send message: no target ID');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExpand = () => {
    setIsMinimized(false);
    setUnreadWhileMinimized(0);
    if (friend?.id) {
      onMessageReceived?.(friend.id);
    }
  };

  const shouldShowAvatar = (index: number): boolean => {
    if (index === 0) return true;
    const current = messages[index];
    const prev = messages[index - 1];
    return current.isOwn !== prev.isOwn;
  };

  const shouldShowTimestamp = (index: number): boolean => {
    const current = messages[index];
    const next = messages[index + 1];

    if (!next) return true;

    if (current.isOwn !== next.isOwn) return true;

    const timeDiff = next.timestamp.getTime() - current.timestamp.getTime();
    if (timeDiff > 600000) return true;

    return false;
  };

  const displayName = partyId ? 'Chat do Grupo' : friend?.name;
  const displayAvatar = partyId ? 'https://img.icons8.com/?size=512&id=124436&format=png' : friend?.avatar; // Group Icon fallback

  return (
    <div className={`
      flex flex-col 
      ${isMinimized ? 'h-[70px]' : 'h-[520px]'} 
      w-[400px] 
      bg-[#0F131A] 
      border-x border-t border-white/10 
      rounded-t-xl 
      shadow-2xl shadow-black/80
      transition-all duration-300 ease-in-out
      ${className}
    `}>
      <div
        className={`p-4 border-b border-white/5 bg-black/20 flex items-center justify-between rounded-t-xl flex-shrink-0 ${isMinimized ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
        onClick={() => isMinimized && handleExpand()}
      >
        <div className="flex items-center gap-3">
          <div className={`relative w-10 h-10 rounded-xl overflow-hidden border border-white/10 ${!partyId && friend?.status === 'Offline' ? 'grayscale opacity-60' : ''}`}>
            {partyId ? (
              <div className="w-full h-full bg-white/10 flex items-center justify-center">
                <UsersIcon size={20} className="text-white/70" />
              </div>
            ) : (
              <img src={displayAvatar} alt={displayName} className="w-full h-full object-cover" />
            )}

            {isMinimized && unreadWhileMinimized > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                <span className="text-[10px] font-bold text-white">{unreadWhileMinimized > 9 ? '9+' : unreadWhileMinimized}</span>
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-wide">{displayName}</p>
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest mt-0.5">
              {partyId ? 'Membros do Grupo' : (
                <>
                  <span className={friend?.status === 'Online' ? 'text-hytale-emerald' : 'text-white/20'}>
                    {friend?.status}
                  </span>
                  {friend?.status === 'Online' && friend?.game && friend.game !== 'No Menu' && (
                    <span className={friend.game.startsWith('Jogando') ? 'text-hytale-mana' : 'text-white/20'}>
                      {' • '}{friend.game}
                    </span>
                  )}
                </>
              )}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            className="p-1.5 hover:bg-white/5 rounded transition-colors"
            title={isMinimized ? "Expandir" : "Minimizar"}
          >
            <Minimize2 className="w-4 h-4 text-white/40" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onClose(); }}
            className="p-1.5 hover:bg-white/5 rounded transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4 text-white/40" />
          </button>
        </div>
      </div >

      < div className={`flex-1 flex flex-col overflow-hidden transition-opacity duration-300 ${isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'}`
      }>
        {!isMinimized && (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-hytale-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-hytale-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-hytale-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <div className="w-16 h-16 rounded-2xl overflow-hidden border border-white/10 opacity-50">
                    <img src={friend?.avatar} alt={friend?.name} className="w-full h-full object-cover" />
                  </div>
                  <p className="text-white/30 text-xs">Nenhuma mensagem ainda</p>
                  <p className="text-white/20 text-[10px]">Diga olá para {friend?.name}! 👋</p>
                </div>
              ) : (
                <>
                  {messages.map((msg, index) => (
                    <div
                      key={msg.id}
                      className={`flex gap-2 ${msg.isOwn ? 'flex-row-reverse' : 'flex-row'} ${shouldShowAvatar(index) ? 'mt-3' : 'mt-0.5'}`}
                    >
                      <div className={`flex-shrink-0 w-8 ${shouldShowAvatar(index) ? 'visible' : 'invisible'}`}>
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                          <img
                            src={msg.senderAvatar || (msg.isOwn ? currentUserAvatar : friend?.avatar)}
                            alt={msg.sender}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      <div className={`flex flex-col ${msg.isOwn ? 'items-end' : 'items-start'} max-w-[70%] min-w-0`}>
                        <div
                          onContextMenu={(e) => handleMessageRightClick(e, msg)}
                          className={`relative px-3 py-2 rounded-2xl overflow-hidden cursor-context-menu transition-all active:scale-[0.98] ${msg.isOwn
                            ? 'bg-hytale-accent text-black rounded-br-md hover:brightness-105 pr-8'
                            : 'bg-white/10 text-white rounded-bl-md hover:bg-white/15'
                            } ${msg.status === 'error' ? 'border border-red-500/50' : ''}`}
                        >
                          <p className={`text-[13px] leading-relaxed break-all whitespace-pre-wrap ${msg.status === 'sending' ? 'opacity-70' : ''}`}>{msg.text}</p>

                          {msg.isOwn && (
                            <div className={`absolute bottom-1 right-2 ${msg.status ? 'flex' : 'hidden'}`}>
                              {msg.status === 'sending' && <Clock className="w-3 h-3 text-black/40 animate-pulse" />}
                              {msg.status === 'sent' && (
                                <Check className={`w-3 h-3 ${msg.readAt ? 'text-blue-600' : 'text-black/60'}`} />
                              )}
                              {msg.status === 'error' && <AlertCircle className="w-3 h-3 text-red-600" />}
                            </div>
                          )}
                        </div>
                        {shouldShowTimestamp(index) && (
                          <span className="text-[9px] text-white/20 mt-0.5 px-1 font-mono flex items-center gap-1">
                            {msg.timestamp.toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                            {!shouldShowAvatar(index) && msg.isOwn && (
                              <>
                                {msg.status === 'sending' && <Clock className="w-2.5 h-2.5 text-white/20" />}
                                {msg.status === 'sent' && (
                                  <Check className={`w-2.5 h-2.5 ${msg.readAt ? 'text-blue-400' : 'text-white/20'}`} />
                                )}
                                {msg.status === 'error' && <AlertCircle className="w-2.5 h-2.5 text-red-500" />}
                              </>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                  {isTyping && (
                    <div className="flex gap-2 items-end mt-3 animate-in fade-in duration-300">
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                        <img src={friend?.avatar} alt={friend?.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="bg-white/10 px-4 py-3 rounded-2xl rounded-bl-md">
                        <div className="flex gap-1">
                          <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                          <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                          <span className="w-2 h-2 bg-white/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="px-4 py-2 border-t border-white/5">
              <button
                onClick={onInviteToParty}
                className="w-full flex items-center justify-center gap-2 p-2 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-black uppercase tracking-widest text-white/60 hover:text-hytale-accent transition-all"
              >
                <UsersIcon className="w-3.5 h-3.5" />
                Convidar para Party
              </button>
            </div>

            <div className="p-4 bg-black/40 border-t border-white/5 flex-shrink-0">
              <div className="relative flex items-end gap-3 max-w-full">
                <div className="relative flex-1 group">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={handleInputChange}
                    onKeyDown={handleKeyPress}
                    placeholder="Digite uma mensagem..."
                    rows={1}
                    className="w-full bg-[#1A1F2E]/80 text-white text-[13px] py-3 px-4 rounded-xl border border-white/5 focus:border-hytale-accent/50 focus:outline-none transition-all placeholder:text-white/10 group-hover:bg-[#1A1F2E] resize-none overflow-hidden max-h-32 custom-scrollbar"
                    style={{ height: 'auto', minHeight: '44px' }}
                    onInput={(e) => {
                      const target = e.target as HTMLTextAreaElement;
                      target.style.height = 'auto';
                      target.style.height = `${target.scrollHeight}px`;
                    }}
                  />
                  <div className="absolute top-1/2 -translate-y-1/2 right-3 text-[10px] font-mono text-white/10 opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none">
                    {input.length}/2500
                  </div>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || input.length > 2500}
                  className={`flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-all ${input.trim() && input.length <= 2500
                    ? 'bg-hytale-accent text-black shadow-lg shadow-hytale-accent/20 hover:scale-105 active:scale-95'
                    : 'bg-white/5 text-white/20'
                    }`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
        {
          messageContextMenu && (
            <div
              ref={menuRef}
              className="fixed z-[100] bg-[#0a0f16] border border-white/10 rounded-lg shadow-2xl py-1 min-w-[140px] animate-in fade-in zoom-in-95 duration-100"
              style={{
                left: `${Math.min(messageContextMenu.x, window.innerWidth - 150)}px`,
                top: `${Math.min(messageContextMenu.y, window.innerHeight - 100)}px`
              }}
            >
              <button
                onClick={() => handleCopyMessage(messageContextMenu.message.text)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/5 transition-colors"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Mensagem</span>
              </button>

              {messageContextMenu.message.isOwn && (
                <button
                  onClick={() => handleDeleteMessage(messageContextMenu.message.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Deletar Mensagem</span>
                </button>
              )}
            </div>
          )
        }
      </div>
    </div>
  );
}

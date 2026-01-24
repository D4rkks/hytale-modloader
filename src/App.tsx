import { useState, useEffect, useRef } from 'react';
import './index.css';
import Dashboard from './views/Dashboard';
import SettingsView from './views/Settings';
import ModsView from './views/Mods';
import InstanceList from './components/InstanceList';
import TitleBar from './components/TitleBar';
import BootLoader from './components/BootLoader';
import LoginView from './views/LoginView';
import AccountsView from './views/AccountsView';
import WorldGuide from './views/WorldGuide';
import { Play, Bell, ChevronRight, ChevronLeft, Box, Zap, Globe, Settings as SettingsIcon, LayoutGrid, Users, Plus, Search, Circle, LogOut, ChevronDown, X, MessageSquare, AlertCircle, CheckCircle, Check, Map } from 'lucide-react';
import { instanceIcons } from './utils/instanceIcons';
import ChatPanel from './components/ChatPanel';
import type { PartyMember } from './components/PartySystem';
import PartyInvite from './components/PartyInvite';
import FriendContextMenu from './components/FriendContextMenu';
import FriendSelectorModal from './components/FriendSelectorModal';
import SupabaseService from './services/SupabaseService';


const AppPhase = {
  LOADING: 'loading',
  LOGIN: 'login',
  SELECT_ACCOUNT: 'select_account',
  READY: 'ready'
} as const;
type AppPhaseType = typeof AppPhase[keyof typeof AppPhase];

const View = {
  DASHBOARD: 'dashboard',
  LIBRARY: 'library',
  MODS: 'mods',
  COMMUNITY: 'community',
  SETTINGS: 'settings',
  ACCOUNTS: 'accounts',
  WORLD_GUIDE: 'world_guide'
} as const;
type ViewType = typeof View[keyof typeof View];

function App() {
  const [phase, setPhase] = useState<AppPhaseType>(AppPhase.LOADING);
  const [activeView, setActiveView] = useState<ViewType>(View.DASHBOARD);
  const [selectedInstance, setSelectedInstance] = useState("Orbis Odyssey");
  const [user, setUser] = useState<{ username: string; uuid: string; type?: string } | null>(null);
  const [launchStatus, setLaunchStatus] = useState<string | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isGameRunning, setIsGameRunning] = useState(false);

  const [initProgress, setInitProgress] = useState(0);
  const [initStatus, setInitStatus] = useState("Iniciando...");
  const [accountsCount, setAccountsCount] = useState(0);

  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: number;
    title: string;
    msg: string;
    time: string;
    unread: boolean;
    type?: 'party_invite' | 'info';
    partyInviteData?: { inviteId: string; partyId: string; from: string; avatar: string };
  }>>([
    { id: 3, title: 'Bem-vindo!', msg: 'Configure sua conta para acessar a Rede Orbis.', time: '1d', unread: false, type: 'info' },
  ]);

  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(false);

  useEffect(() => {
    const updateOnlineStatus = () => {
      if (!navigator.onLine) setIsConnected(false);
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    // Cleanup presence on window close
    const handleBeforeUnload = async () => {
      SupabaseService.cleanup();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [instances, setInstances] = useState<any[]>([]);
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null);
  const [isInstanceDropdownOpen, setIsInstanceDropdownOpen] = useState(false);

  useEffect(() => {
    loadInstances();
  }, []);

  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (electron?.onAppClosing) {
      electron.onAppClosing(() => {
        console.log('[App] App closing - performing cleanup...');
        SupabaseService.cleanup().catch(err => console.error('Cleanup error:', err));
      });
    }
  }, []);

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendInput, setFriendInput] = useState("");

  const [openChat, setOpenChat] = useState<string | null>(null);
  const [unreadPartyMessages, setUnreadPartyMessages] = useState(0);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [partyMembers, setPartyMembers] = useState<PartyMember[]>([]);
  const [pendingInvite, setPendingInvite] = useState<{ id: string, partyId: string, from: string; avatar: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; friend: any } | null>(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const [myActivity, setMyActivity] = useState<string>("No Menu");

  const lastInviteTime = useRef<number>(0);

  const loadInstances = async () => {
    try {
      const electron = (window as any).electronAPI;
      if (electron && electron.getInstances) {
        const list = await electron.getInstances();
        setInstances(list || []);

        const currentInstance = list?.find((i: any) => i.id === activeInstanceId);

        if (list && list.length > 0) {
          if (!activeInstanceId || !currentInstance) {
            setActiveInstanceId(list[0].id);
            setSelectedInstance(list[0].name);
          } else if (currentInstance) {
            setSelectedInstance(currentInstance.name);
          }
        } else {
          setActiveInstanceId(null);
          setSelectedInstance("");
        }
      }
    } catch (e) {
      console.error("Failed to load instances in App", e);
    }
  };
  useEffect(() => {
    const electron = (window as any).electronAPI;
    if (electron && electron.onLaunchProgress) {
      const removeListener = electron.onLaunchProgress((_event: any, data: any) => {
        console.log("[Launch] Data received:", data);
        const msg = (data && data.message || "").toUpperCase().trim();

        if (msg === 'IDLE') {
          console.log("[Launch] Resetting to IDLE state");
          setIsGameRunning(false);
          setIsLaunching(false);
          setLaunchStatus(null);
          SupabaseService.updateActivity('online', 'No Menu');
          setMyActivity('No Menu');
        } else if (data.percent === 100 || msg === 'RODANDO..' || msg === 'GAME LAUNCHED!') {
          console.log("[Launch] Game is now running");
          setIsLaunching(false);
          setIsGameRunning(true);
          setLaunchStatus(null);
          const activeInstance = instances.find(i => i.id === activeInstanceId);
          const act = `Jogando ${activeInstance?.name || 'Hytale'}`;
          SupabaseService.updateActivity('online', act);
          setMyActivity(act);
        } else if (data.percent === -1) {
          console.log("[Launch] Error detected");
          setIsLaunching(false);
          setIsGameRunning(false);
          SupabaseService.updateActivity('online', 'No Menu');
          setMyActivity('No Menu');
        } else {
          setLaunchStatus(data.message);
        }
      });
      return () => {
        if (typeof removeListener === 'function') removeListener();
      };
    }
  }, [instances, activeInstanceId]);

  useEffect(() => {
    const init = async () => {
      try {
        setInitStatus("Verificando atualizações...");
        setInitProgress(20);
        await new Promise(r => setTimeout(r, 600));

        setInitStatus("Carregando configurações...");
        setInitProgress(40);
        await new Promise(r => setTimeout(r, 400));

        const electron = (window as any).electronAPI;
        let activeUser = null;

        if (electron) {
          setInitStatus("Autenticando sessão...");
          setInitProgress(65);
          const active = await electron.getActiveAccount();
          const accounts = await electron.getAccounts();

          setAccountsCount(accounts?.length || 0);
          if (active) {
            setUser(active);
            activeUser = active;
          }
        }

        setInitStatus("Sincronizando instâncias...");
        setInitProgress(85);
        await new Promise(r => setTimeout(r, 500));

        if (activeUser && activeUser.uuid && activeUser.type !== 'offline' && navigator.onLine) {
          setInitStatus("Conectando à Rede Orbis...");
          try {
            const connected = await SupabaseService.loginWithHytale(
              activeUser.username,
              activeUser.uuid
            );
            if (connected) {
              console.log('✅ Auto-conectado à Rede Orbis');
              setIsConnected(true);
            }
          } catch (err) {
            console.log('⚠️ Não foi possível auto-conectar à Rede Orbis:', err);
            setIsConnected(false);
          }
        }

        setInitStatus("Inicialização concluída.");
        setInitProgress(100);
      } catch (e) {
        console.error("Initialization error", e);
        setInitProgress(100);
      }
    };
    init();
  }, []);

  const handleLaunch = async (identifier?: string | { instanceId: string, worldName?: string }) => {
    if (isLaunching || isGameRunning) return;

    let targetInstanceId: string | undefined;
    let targetWorldName: string | undefined;

    if (typeof identifier === 'string') {
      targetInstanceId = identifier;
    } else if (typeof identifier === 'object') {
      targetInstanceId = identifier.instanceId;
      targetWorldName = identifier.worldName;
    }

    if (!targetInstanceId) return;

    setIsLaunching(true);
    setIsGameRunning(false);
    setLaunchStatus('Prep...');

    const instance = instances.find(i => i.id === targetInstanceId);
    const gameName = instance?.name || 'Hytale';

    try {
      const electron = (window as any).electronAPI;
      if (electron) {
        const payload = targetWorldName
          ? { instanceId: targetInstanceId, worldName: targetWorldName }
          : targetInstanceId;

        console.log(`[App] Launching with payload:`, payload);
        const result = await electron.launchGame(payload);
        console.log("Launch Result:", result);
        if (!result.success) {
          setLaunchStatus(result.error || 'Falha');
          setIsLaunching(false);
          SupabaseService.updateActivity('online', 'No Menu');
          setMyActivity('No Menu');
        }
      } else {
        setTimeout(() => {
          setIsLaunching(false);
          setIsGameRunning(true);
          setLaunchStatus("Running");
          const act = `Jogando ${gameName}`;
          SupabaseService.updateActivity('online', act);
          setMyActivity(act);
          setTimeout(() => {
            setIsGameRunning(false);
            setLaunchStatus(null);
            SupabaseService.updateActivity('online', 'No Menu');
            setMyActivity('No Menu');
          }, 5000);
        }, 1000);
      }
    } catch (err: any) {
      console.error("Launch Error:", err);
      setLaunchStatus(`Erro: ${err.message}`);
      setIsLaunching(false);
      SupabaseService.updateActivity('online', 'No Menu');
      setMyActivity('No Menu');
    }
  };

  const handleLogin = async (userData: any) => {
    if (isGameRunning) return;
    setUser(userData);
    setPhase(AppPhase.READY);
    setIsConnected(false);
    setConnectionError(false);
    const electron = (window as any).electronAPI;
    if (electron) {
      const accounts = await electron.getAccounts();
      const account = accounts.find((a: any) => a.uuid === userData.uuid);
      if (account) {
        await electron.setActiveAccount(account.id);
      }
      setAccountsCount(accounts?.length || 0);
    }

    if (navigator.onLine && userData.type !== 'offline' && userData.uuid) {
      console.log('🔐 Auto-connecting to Orbis Network...');

      try {
        const connected = await SupabaseService.loginWithHytale(
          userData.username,
          userData.uuid
        );

        if (connected) {
          console.log('Conectado à Rede Orbis');
          setIsConnected(true);
          setConnectionError(false);
        } else {
          console.log('Não foi possível conectar à Rede Orbis');
          setIsConnected(false);
          setConnectionError(false);
        }
      } catch (err: any) {
        console.error('Erro ao conectar à Rede Orbis:', err);
        setIsConnected(false);
        setConnectionError(err.message !== 'No active session - user must login');
      }
    } else {
      console.log('Modo offline ou sem internet - Rede Orbis desabilitada');
      setIsConnected(false);
    }
  };

  const handleLogout = async () => {
    const electron = (window as any).electronAPI;
    if (electron) {
      await electron.setActiveAccount(null);
      const accounts = await electron.getAccounts();
      setAccountsCount(accounts?.length || 0);
      if (accounts && accounts.length > 0) {
        setPhase(AppPhase.SELECT_ACCOUNT);
        setUser(null);
        return;
      }
    }
    setUser(null);
    setPhase(AppPhase.LOGIN);
  };

  const handleAddAccount = () => {
    setPhase(AppPhase.LOGIN);
  };

  const menuItems = [
    { id: View.DASHBOARD, label: 'Início', icon: LayoutGrid },
    { id: View.LIBRARY, label: 'Instâncias', icon: Box },
    { id: View.MODS, label: 'Mods', icon: Zap },
    { id: View.WORLD_GUIDE, label: 'Novo Mundo', icon: Plus },
    { id: View.COMMUNITY, label: 'Servidores', icon: Globe },
    { id: View.SETTINGS, label: 'Ajustes', icon: SettingsIcon },
  ];

  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [_partyInvites, setPartyInvites] = useState<any[]>([]);
  const [activePartyId, setActivePartyId] = useState<string | null>(null);
  const [presenceMap, setPresenceMap] = useState<Record<string, any>>({});
  const [persistedPresence, setPersistedPresence] = useState<Record<string, any>>({});

  useEffect(() => {
    if (user && phase === AppPhase.READY && isConnected) {
      const fetchRequests = () => {
        SupabaseService.getFriendRequests().then(reqs => {
          const currentUserId = SupabaseService.getCurrentUserId();
          const incoming = reqs.filter((r: any) =>
            r.status === 'pending' &&
            r.recipient_id === currentUserId &&
            r.sender?.username
          ).map((r: any) => ({
            id: r.id,
            username: r.sender.username,
            avatar: `https://hyvatar.io/render/${r.sender.username}?size=128&rotate=0`
          }));

          setPendingRequests(prev => {
            const newReqs = incoming.filter((n: any) => !prev.some(p => p.id === n.id));
            if (newReqs.length > 0) {
              const notifs = newReqs.map((req: any) => ({
                id: Date.now() + Math.random(),
                title: 'Pedido de Amizade',
                msg: `${req.username} quer ser seu amigo!`,
                time: 'Agora',
                unread: true
              }));
              setNotifications(current => [...notifs, ...current]);
            }
            return incoming;
          });
        });
      };

      const fetchFriends = () => {
        SupabaseService.getFriends().then(friendsList => {
          const formatted = friendsList.map((p: any) => ({
            id: p.id || p.user_id,
            username: p.username,
            name: p.username,
            status: 'Offline',
            avatar: `https://hyvatar.io/render/${p.username}?size=128&rotate=0`,
            game: ''
          }));

          setFriends(formatted);
        }).catch(() => {
          setFriends([]);
        });
      };

      const fetchPartyInvites = () => {
        try {
          if (typeof SupabaseService.fetchMyPartyInvites !== 'function') {
            console.warn("fetchMyPartyInvites not available yet");
            return;
          }
          SupabaseService.fetchMyPartyInvites().then(invites => {
            if (!invites) return;
            setPartyInvites(prev => {
              const newInvites = invites.filter((inv: any) => !prev.some(p => p.id === inv.id));
              if (newInvites.length > 0) {
                const notifs = newInvites.map((inv: any) => ({
                  id: Date.now() + Math.random(),
                  title: 'Convite de Grupo',
                  msg: `${inv.sender.username} te convidou para um grupo!`,
                  time: 'Agora',
                  unread: true,
                  type: 'party_invite' as const,
                  partyInviteData: {
                    inviteId: inv.id,
                    partyId: inv.party_id,
                    from: inv.sender.username,
                    avatar: `https://hyvatar.io/render/${inv.sender.username}?size=128&rotate=0`
                  }
                }));
                setNotifications(current => [...notifs, ...current]);

                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification('Convite de Grupo - Orbis Launcher', {
                    body: `${newInvites[0].sender.username} te convidou para um grupo!`,
                    icon: `https://hyvatar.io/render/${newInvites[0].sender.username}?size=128&rotate=0`
                  });
                } else if ('Notification' in window && Notification.permission !== 'denied') {
                  Notification.requestPermission();
                }

                const last = newInvites[0];
                setPendingInvite({
                  id: last.id,
                  partyId: last.party_id,
                  from: last.sender.username,
                  avatar: `https://hyvatar.io/render/${last.sender.username}?size=128&rotate=0`
                });
              }
              return invites;
            });
          }).catch(err => {
            console.warn('Error fetching party invites:', err);
          });
        } catch (e) {
          console.warn('CRITICAL: fetchPartyInvites crashed:', e);
        }
      };

      fetchFriends();
      fetchRequests();
      fetchPartyInvites();
      const reqSubscription = SupabaseService.subscribeToFriendRequests(() => {
        console.log('🔄 Refreshing friend data...');
        fetchRequests();
        fetchFriends();
      });

      const partySub = SupabaseService.subscribeToPartyInvites(() => {
        console.log('🔄 New party invite received...');
        fetchPartyInvites();
      });

      SupabaseService.subscribeToMessages((newMsg: any) => {
        const currentUserId = SupabaseService.getCurrentUserId();
        if (newMsg.sender_id !== currentUserId) {
          const senderId = newMsg.sender_id;
          setUnreadMessages(prev => ({
            ...prev,
            [senderId]: (prev[senderId] || 0) + 1
          }));
        }
      });

      let heartbeat: any;
      if (user?.username) {
        SupabaseService.trackPresence(user.username);
        SupabaseService.updateActivity('online', myActivity);

        heartbeat = setInterval(() => {
          SupabaseService.updateActivity('online', myActivity);
        }, 45000);
      }

      const presenceChannel = SupabaseService.subscribeToPresence((onlineUsers) => {
        console.log('📡 Realtime online users received:', onlineUsers.length);
        const map: Record<string, any> = {};
        onlineUsers.forEach(u => {
          const key = u.username.toLowerCase();
          map[key] = {
            status: u.status === 'online' ? 'Online' : 'Offline',
            activity: u.activity || 'No Menu'
          };
        });
        console.log('📡 Updated Presence Map Keys:', Object.keys(map));
        setPresenceMap(map);
      });

      return () => {
        reqSubscription?.unsubscribe();
        partySub?.unsubscribe();
        presenceChannel?.unsubscribe();
        if (heartbeat) clearInterval(heartbeat);
      };
    } else {
      setFriends([]);
      setPresenceMap({});
    }
  }, [user, phase, isConnected, myActivity]);

  useEffect(() => {
    if (!isConnected || friends.length === 0) return;

    const fetchFallback = async () => {
      const friendIds = friends.map(f => f.id).filter(Boolean);
      if (friendIds.length > 0) {
        console.log(`📡 Fetching database fallback for ${friendIds.length} friends...`);
        const pMap = await SupabaseService.getPersistedPresence(friendIds);
        setPersistedPresence(pMap);
      }
    };

    fetchFallback();

    const interval = setInterval(fetchFallback, 10000);

    const handleUnload = () => {
      SupabaseService.markOffline().catch(err => console.error('Failed to mark offline on unload:', err));
    };
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, [friends, isConnected]);

  useEffect(() => {
    if (!activePartyId || !isConnected || !user?.uuid) {
      setPartyMembers([]);
      setUnreadPartyMessages(0);
      return;
    }

    const refreshMembers = async () => {
      if (!activePartyId) return;
      console.log('🔄 Re-fetching party members for realtime sync...');
      const members = await SupabaseService.getPartyMembers(activePartyId);

      const currentUserId = SupabaseService.getCurrentUserId();
      console.log(`📋 Party members received: ${members.length}, checking if ${currentUserId} is still member...`);

      const stillMember = members.length > 0 && members.some((m: any) => {
        const memberId = m.id || m.user_id;
        return memberId === currentUserId;
      });

      console.log(`🔍 Still member: ${stillMember}`);

      if (!stillMember) {
        console.log('🚪 You are no longer in this party (kicked or dissolved)');
        setActivePartyId(null);
        setPartyMembers([]);
        if (openChat === '@PARTY') setOpenChat(null);
        setToast({ message: 'Você não faz mais parte deste grupo.', type: 'error' });
        return;
      }

      setPartyMembers(members.map((m: any) => ({
        id: m.id,
        name: m.username,
        username: m.username,
        avatar: m.avatar,
        status: m.status || 'Offline',
        isLeader: m.isLeader,
        isAdmin: m.isLeader
      })));
    };

    refreshMembers();

    const membersSub = SupabaseService.subscribeToPartyMembers(activePartyId, refreshMembers);

    const partyUpdateSub = SupabaseService.subscribeToPartyUpdate(activePartyId, refreshMembers);

    const partyMsgSub = SupabaseService.subscribeToPartyMessages(activePartyId, (msg) => {
      if (msg.sender_id !== user.uuid) {
        if (openChat !== '@PARTY') {
          setUnreadPartyMessages(prev => prev + 1);
          setToast({ message: `Nova mensagem no grupo de ${msg.profiles?.username || 'Alguém'}`, type: 'success' });
        }
      }
    });
    console.log('✅ Subscribed to Party Messages');

    const pollingInterval = setInterval(() => {
      console.log('📊 Polling party members (fallback)...');
      refreshMembers();
    }, 5000);

    return () => {
      membersSub?.unsubscribe();
      partyUpdateSub?.unsubscribe();
      partyMsgSub?.unsubscribe();
      clearInterval(pollingInterval);
    };
  }, [activePartyId, isConnected, user?.uuid, openChat]);

  const _displayFriends = friends.map(f => {
    let live = presenceMap[f.username.toLowerCase()];
    const persisted = persistedPresence[f.id];
    const isRecentlySeen = persisted && (new Date().getTime() - new Date(persisted.last_seen).getTime() < 90000);
    const dbSaysOffline = persisted?.status === 'offline';

    const isOnline = !!live || (isRecentlySeen && persisted?.status === 'online' && !dbSaysOffline);

    return {
      ...f,
      status: isOnline ? (live?.status || 'Online') : 'Offline',
      game: live ? live.activity : (isOnline && isRecentlySeen ? persisted.activity : '')
    };
  });

  const displayFriends = _displayFriends.sort((a, b) => {
    const aIngame = a.game && a.game.startsWith('Jogando');
    const bIngame = b.game && b.game.startsWith('Jogando');
    const aOnline = a.status === 'Online';
    const bOnline = b.status === 'Online';

    if (aIngame && !bIngame) return -1;
    if (!aIngame && bIngame) return 1;
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;
    return a.name.localeCompare(b.name);
  });

  const handleOpenChat = (friendName: string) => {
    setOpenChat(friendName);
    const friend = friends.find(f => f.name === friendName);
    if (friend?.id) {
      setUnreadMessages(prev => {
        const updated = { ...prev };
        delete updated[friend.id];
        return updated;
      });
    }
  };

  const handleInviteToParty = async (friendId?: string) => {
    const now = Date.now();
    if (now - lastInviteTime.current < 5000) {
      setToast({ message: "Aguarde alguns segundos antes de convidar novamente.", type: 'error' });
      return;
    }
    lastInviteTime.current = now;

    if (!activePartyId) {
      const newPartyId = await SupabaseService.createParty();
      if (newPartyId) {
        setActivePartyId(newPartyId);
        if (friendId) {
          await SupabaseService.inviteToParty(newPartyId, friendId);
          setToast({ message: 'Convite enviado!', type: 'success' });
        } else {
          setToast({ message: 'Grupo criado!', type: 'success' });
        }
      }
    } else {
      if (friendId) {
        await SupabaseService.inviteToParty(activePartyId, friendId);
        setToast({ message: 'Convite enviado!', type: 'success' });
      } else {
        setShowInviteModal(true);
        setShowInviteModal(true);
      }
    }
  };

  const handleAcceptPartyInvite = async () => {
    if (!pendingInvite) return;

    if (openChat === '@PARTY') setOpenChat(null);

    const success = await SupabaseService.respondToPartyInvite(pendingInvite.id, true, pendingInvite.partyId);

    if (success) {
      setActivePartyId(pendingInvite.partyId);
      const members = await SupabaseService.getPartyMembers(pendingInvite.partyId);
      setPartyMembers(members.map((m: any) => ({
        id: m.user_id || m.id,
        name: m.username,
        username: m.username,
        avatar: m.avatar,
        status: m.status || 'Online',
        isLeader: m.isLeader,
        isAdmin: m.isLeader
      })));
    }
    setPendingInvite(null);
  };

  const handleLeaveParty = async () => {
    if (!activePartyId) return;
    await SupabaseService.leaveParty(activePartyId);
    setActivePartyId(null);
    setPartyMembers([]);
    if (openChat === '@PARTY') setOpenChat(null);
  };

  const handleRemoveFromParty = async (userId: string, memberName: string) => {
    if (!activePartyId) return;

    console.log(`🎯 handleRemoveFromParty called with userId=${userId}, memberName=${memberName}, partyId=${activePartyId}`);

    setPartyMembers(prev => prev.filter(m => m.name !== memberName));

    try {
      console.log(`🔹 Calling SupabaseService.kickFromParty...`);
      const success = await SupabaseService.kickFromParty(activePartyId, userId);

      if (!success) {
        console.error('❌ Kick failed: SupabaseService returned false (RLS or not found)');
        setToast({ message: `Falha: ${memberName} não foi removido (verifique RLS ou já saiu).`, type: 'error' });
        const members = await SupabaseService.getPartyMembers(activePartyId);
        setPartyMembers(members.map((m: any) => ({
          id: m.user_id || m.id,
          name: m.username,
          username: m.username,
          avatar: m.avatar,
          status: m.status || 'Online',
          isLeader: m.isLeader,
          isAdmin: m.isLeader
        })));
        return;
      }

      console.log(`✅ Kick successful via Service`);
      setToast({ message: `${memberName} foi removido do grupo.`, type: 'success' });
    } catch (err: any) {
      console.error('Kick failed with exception:', err);
      setToast({ message: `Erro ao remover ${memberName}: ${err.message}`, type: 'error' });
    }
  };


  const handleRightClick = (e: React.MouseEvent, friend: any) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      friend
    });
  };

  if (phase === AppPhase.LOADING) {
    return (
      <div className="h-screen w-full relative overflow-hidden bg-transparent">
        <BootLoader
          externalProgress={initProgress}
          externalStatus={initStatus}
          onComplete={async () => {
            const electron = (window as any).electronAPI;
            if (electron) {
              electron.resizeWindow(1360, 800);
              await new Promise(r => setTimeout(r, 150));
            }

            if (accountsCount > 1) {
              setUser(null);
              setPhase(AppPhase.SELECT_ACCOUNT);
            } else if (user) {
              setPhase(AppPhase.READY);
            } else {
              setPhase(AppPhase.SELECT_ACCOUNT);
            }
          }}
        />
      </div>
    );
  }

  if (phase === AppPhase.SELECT_ACCOUNT) {
    return (
      <div className="h-screen w-full relative flex flex-col overflow-hidden bg-[#0a0f16]">
        <TitleBar />
        <div className="absolute inset-0 z-0 opacity-20 blur-sm">
          <div className="w-full h-full bg-gradient-to-br from-[#1a1f2e] via-[#0d1117] to-[#0a0f16]" />
        </div>
        <div className="relative z-10 flex-1 flex items-center justify-center p-20">
          <div className="w-full max-w-6xl">
            <AccountsView
              activeUser={user}
              onSwitch={handleLogin}
              onAdd={handleAddAccount}
              onLogout={handleLogout}
              onBack={user ? () => setPhase(AppPhase.READY) : undefined}
            />
          </div>
        </div>
      </div>
    );
  }

  if (phase === AppPhase.LOGIN) {
    return (
      <div className="h-screen w-full relative overflow-hidden bg-[#0a0f16] flex flex-col">
        <TitleBar />
        <LoginView
          onLogin={handleLogin}
          onBack={
            user
              ? () => setPhase(AppPhase.READY)
              : (accountsCount > 0 ? () => setPhase(AppPhase.SELECT_ACCOUNT) : undefined)
          }
        />
      </div>
    );
  }

  const handleRespondToRequest = async (requestId: string, accept: boolean, username: string) => {
    try {
      await SupabaseService.respondToFriendRequest(requestId, accept);

      setToast({
        message: accept ? `Agora você é amigo de ${username}!` : `Solicitação de ${username} recusada.`,
        type: accept ? 'success' : 'error'
      });

      setPendingRequests(prev => prev.filter(r => r.id !== requestId));

      if (accept) {
        const friendsList = await SupabaseService.getFriends();
        const formatted = friendsList.map((p: any) => ({
          id: p.id || p.user_id,
          username: p.username,
          name: p.username,
          status: 'Offline',
          avatar: `https://hyvatar.io/render/${p.username}?size=128&rotate=0`,
          game: ''
        }));
        setFriends(formatted);
      }

    } catch (err: any) {
      setToast({ message: 'Erro ao processar solicitação.', type: 'error' });
    }
  };

  return (
    <div className="h-screen w-full relative flex flex-col overflow-hidden bg-[#0a0f16] animate-in fade-in duration-1000">

      <TitleBar />

      {/* Global Toast */}
      {toast && (
        <div className={`fixed top-10 left-[calc(50%-150px)] -translate-x-1/2 z-[9999] pl-3 pr-6 py-3 rounded-lg border backdrop-blur-xl flex items-center gap-3 shadow-[0_8px_30px_rgb(0,0,0,0.5)] animate-in slide-in-from-top-4 fade-in duration-300 ${toast.type === 'error'
          ? 'bg-[#0f1115]/95 border-red-500/20'
          : 'bg-[#0f1115]/95 border-hytale-emerald/20'
          }`}>
          <div className={`p-2 rounded-full ${toast.type === 'error' ? 'bg-red-500/10' : 'bg-hytale-emerald/10'}`}>
            {toast.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
            ) : (
              <CheckCircle className="w-5 h-5 text-hytale-emerald drop-shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
            )}
          </div>
          <div className="flex flex-col">
            <h4 className={`text-[10px] font-black uppercase tracking-widest ${toast.type === 'error' ? 'text-red-400' : 'text-hytale-emerald'}`}>
              {toast.type === 'error' ? 'Erro' : 'Sucesso'}
            </h4>
            <span className="text-xs font-bold text-white/90 drop-shadow-sm">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="flex-1 relative flex overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="w-full h-full bg-gradient-to-br from-[#1a1f2e] via-[#0d1117] to-[#0a0f16] opacity-30" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0a0f16] via-[#0a0f16]/80 to-transparent"></div>
        </div>

        <div className="relative z-10 w-full flex">

          <aside className="w-72 h-full flex flex-col p-8 justify-between border-r border-white/5 backdrop-blur-md bg-[#0a0f16]/40">
            <div className="space-y-10">
              <div className="group cursor-pointer flex items-center gap-3" onClick={() => setActiveView(View.DASHBOARD)}>
                <Box className="w-6 h-6 text-hytale-accent transition-transform duration-[600ms] ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:[transform:rotateY(180deg)]" />
                <h1 className="logo-orbis text-xl text-white uppercase tracking-wide leading-none">
                  ORBIS <span className="text-hytale-accent">LAUNCHER</span>
                </h1>
              </div>

              <nav className="flex flex-col gap-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveView(item.id)}
                    className={`nav-link-orbis flex items-center p-3 rounded-lg group transition-all border border-transparent ${activeView === item.id ? 'active bg-white/5 border-white/10' : 'hover:bg-white/5'
                      }`}
                  >
                    <item.icon className={`w-4 h-4 mr-4 transition-colors ${activeView === item.id ? 'text-hytale-accent' : 'text-white/20'}`} />
                    <span className="text-xs font-bold uppercase tracking-widest">{item.label}</span>
                    {activeView === item.id && <ChevronRight className="w-3 h-3 ml-auto text-hytale-accent" />}
                  </button>
                ))}
              </nav>
            </div>

            <div className="space-y-4">
              <div className="relative group">
                {isInstanceDropdownOpen && (
                  <div className="absolute bottom-full left-0 w-full mb-2 bg-[#0a0f16] border border-white/10 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
                    <div className="p-2 border-b border-white/5 bg-black/20">
                      <h3 className="text-[9px] font-black text-white/40 uppercase tracking-widest text-center">Selecionar Jornada</h3>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar p-1 space-y-1">
                      {instances.length === 0 ? (
                        <div className="p-3 text-center text-[10px] text-white/20 italic">Nenhuma instância</div>
                      ) : (
                        instances.map(inst => (
                          <button
                            key={inst.id}
                            onClick={() => {
                              setActiveInstanceId(inst.id);
                              setSelectedInstance(inst.name);
                              setIsInstanceDropdownOpen(false);
                            }}
                            className={`w-full text-left p-3 rounded flex items-center gap-3 transition-colors ${activeInstanceId === inst.id ? 'bg-hytale-accent/10' : 'hover:bg-white/5'}`}
                          >
                            {(() => {
                              const Icon = instanceIcons[inst.icon || 'box'] || Box;
                              return <Icon className={`w-4 h-4 ${activeInstanceId === inst.id ? 'text-hytale-accent' : 'text-white/20'}`} />;
                            })()}
                            <span className={`text-[10px] font-bold uppercase tracking-wide truncate ${activeInstanceId === inst.id ? 'text-hytale-accent' : 'text-white/60'}`}>{inst.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="flex w-full btn-play-orbis overflow-hidden rounded-lg">
                  <button
                    disabled={isLaunching || isGameRunning || !activeInstanceId}
                    onClick={() => handleLaunch(activeInstanceId || undefined)}
                    className={`flex-1 py-4 flex flex-col items-center justify-center pl-8 pr-4 border-r border-black/10 transition-all hover:brightness-110 ${(isLaunching || isGameRunning || !activeInstanceId) ? 'opacity-50 cursor-not-allowed filter grayscale-[0.5]' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center gap-2 w-full justify-center">
                      <Play className={`w-3.5 h-3.5 fill-current ${isGameRunning ? 'animate-pulse' : ''}`} />
                      <span className="text-sm font-black truncate max-w-[100px]">
                        {isGameRunning ? 'Jogando' : isLaunching ? 'Carregando' : 'Jogar'}
                      </span>
                    </div>
                    <div className="text-[7px] font-black text-black/50 uppercase tracking-[0.2em] mt-0.5 truncate max-w-[120px]">
                      {activeInstanceId ? selectedInstance : 'SELECIONE'}
                    </div>
                  </button>
                  <button
                    onClick={() => setIsInstanceDropdownOpen(!isInstanceDropdownOpen)}
                    className="px-3 flex items-center justify-center bg-black/5 hover:bg-black/10 transition-colors group/arrow cursor-pointer"
                  >
                    <ChevronDown className={`w-5 h-5 text-black/40 group-hover:text-black transition-transform ${isInstanceDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
              </div>

              <p className="text-[9px] text-white/20 font-bold uppercase tracking-[0.3em] text-center">
                LAUNCHER v1.0.0 • STABLE
              </p>
            </div>
          </aside>

          <main className="flex-1 h-full p-12 overflow-y-auto bg-gradient-to-b from-transparent to-[#0a0f16]/60 custom-scrollbar">
            <div key={activeView} className="h-full max-w-5xl mx-auto fade-in">
              {activeView === View.DASHBOARD && <Dashboard
                isConnected={user?.type !== 'offline' && isConnected}
                isOfflineMode={user?.type === 'offline'}
                connectionError={connectionError}
                onConnect={() => {
                  setIsConnected(true);
                  setConnectionError(false);
                }}
              />}
              {activeView === View.LIBRARY && (
                <InstanceList
                  instances={instances}
                  onRefresh={loadInstances}
                  onLaunch={(id) => handleLaunch(id)}
                  isLaunching={isLaunching}
                  selectedId={activeInstanceId}
                  onSelect={(id) => {
                    setActiveInstanceId(id);
                    const inst = instances.find(i => i.id === id);
                    if (inst) setSelectedInstance(inst.name);
                  }}
                />
              )}
              {activeView === View.WORLD_GUIDE && (
                <WorldGuide
                  activeInstanceId={activeInstanceId}
                  onLaunch={handleLaunch}
                  onInstanceSelect={(id) => {
                    setActiveInstanceId(id);
                    const inst = instances.find(i => i.id === id);
                    if (inst) setSelectedInstance(inst.name);
                  }}
                  onInstanceCreated={() => { loadInstances(); }}
                />
              )}
              {activeView === View.MODS && (
                <ModsView
                  instances={instances}
                  activeInstanceId={activeInstanceId}
                  onInstanceSelect={(id) => {
                    setActiveInstanceId(id);
                    const inst = instances.find(i => i.id === id);
                    if (inst) setSelectedInstance(inst.name);
                  }}
                />
              )}
              {activeView === View.SETTINGS && <SettingsView />}
              {activeView === View.ACCOUNTS && <AccountsView
                activeUser={user}
                onSwitch={handleLogin}
                onAdd={handleAddAccount}
                onLogout={handleLogout}
                onBack={() => setActiveView(View.DASHBOARD)}
                isGameRunning={isGameRunning}
              />}
              {activeView === View.COMMUNITY && (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <div className="orbis-panel p-16 space-y-8 max-w-lg rounded-xl">
                    <Globe className="w-12 h-12 text-hytale-accent mx-auto" />
                    <h2 className="text-3xl font-black text-white uppercase tracking-widest">Lista de Servidores</h2>
                    <p className="text-white/40 italic">A integração com Orbis Network está em manutenção. Use a conexão direta para entrar em reinos externos.</p>
                    <button className="bg-white/5 border border-white/10 px-8 py-3 rounded text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all">Conexão Direta</button>
                  </div>
                </div>
              )}
            </div>
          </main>

          {openChat && (() => {
            if (openChat === '@PARTY' && activePartyId) {
              const currentUserAvatar = `https://hyvatar.io/render/${user?.type === 'offline' ? 'Varyn' : (user?.username || 'D4rkks')}?size=128&rotate=0`;
              return (
                <ChatPanel
                  partyId={activePartyId}
                  currentUserAvatar={currentUserAvatar}
                  onClose={() => setOpenChat(null)}
                  onInviteToParty={() => setShowInviteModal(true)}
                  className={`fixed bottom-0 z-40 transition-all duration-300 ${isSidebarCollapsed ? 'right-[5.5rem]' : 'right-[21rem]'}`}
                />
              );
            }

            const chatFriend = displayFriends.find(f => f.name === openChat);
            const currentUserAvatar = `https://hyvatar.io/render/${user?.type === 'offline' ? 'Varyn' : (user?.username || 'D4rkks')}?size=128&rotate=0`;
            return chatFriend ? (
              <ChatPanel
                friend={chatFriend}
                currentUserAvatar={currentUserAvatar}
                onClose={() => setOpenChat(null)}
                onInviteToParty={() => handleInviteToParty(chatFriend.id)}
                onMessageReceived={(friendId) => {
                  setUnreadMessages(prev => {
                    const updated = { ...prev };
                    delete updated[friendId];
                    return updated;
                  });
                }}
                className={`fixed bottom-0 z-40 transition-all duration-300 ${isSidebarCollapsed ? 'right-[5.5rem]' : 'right-[21rem]'}`}
              />
            ) : null;
          })()}

          <aside className={`${isSidebarCollapsed ? 'w-14' : 'w-80'} h-full flex flex-col border-l border-white/5 backdrop-blur-md bg-[#0a0f16]/50 relative transition-all duration-300`}>
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="absolute -left-3 top-1/2 -translate-y-1/2 z-50 w-6 h-12 bg-[#0a0f16] border border-white/10 rounded-l-lg flex items-center justify-center hover:bg-white/5 transition-all group"
            >
              {isSidebarCollapsed ? (
                <ChevronLeft className="w-4 h-4 text-white/40 group-hover:text-hytale-accent transition-colors" />
              ) : (
                <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-hytale-accent transition-colors" />
              )}
            </button>

            {isSidebarCollapsed ? (
              <div className="flex flex-col items-center py-6 gap-4">
                <div className="p-2 rounded-lg bg-white/5">
                  <Users className="w-4 h-4 text-hytale-accent" />
                </div>
                <div className="relative">
                  <div className="w-8 h-8 rounded bg-[#1c2635] overflow-hidden border border-white/10">
                    <img src={`https://hyvatar.io/render/${user?.type === 'offline' ? 'Varyn' : (user?.username || 'D4rkks')}?size=128&rotate=0`} className="w-full h-full" alt="Avatar" />
                  </div>
                  <Circle className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 text-[#0a0f16] stroke-[3px] ${user?.type === 'offline' ? 'fill-[#4b5563]' : 'fill-hytale-emerald'}`} />
                </div>

                {partyMembers.filter(m => m.id !== SupabaseService.getCurrentUserId()).map((member) => (
                  <div key={member.id} className="relative group cursor-pointer" onClick={() => { setIsSidebarCollapsed(false); handleOpenChat(member.name); }}>
                    <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/5 overflow-hidden group-hover:border-hytale-accent/50 transition-all">
                      <img src={member.avatar} className="w-full h-full" alt={member.name} />
                    </div>
                    <Circle className="absolute -bottom-0.5 -right-0.5 w-3 h-3 stroke-[3px] text-[#0a0f16] fill-hytale-emerald" />
                  </div>
                ))}

                <div className="w-6 h-px bg-white/10"></div>
                {displayFriends.filter(f => !partyMembers.some(pm => pm.id === f.id)).slice(0, 4).map((friend, i) => (
                  <div key={i} className="relative group cursor-pointer" onClick={() => { setIsSidebarCollapsed(false); handleOpenChat(friend.name); }}>
                    <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/5 overflow-hidden group-hover:border-hytale-accent/50 transition-all">
                      <img src={friend.avatar} className="w-full h-full" alt={friend.name} />
                    </div>
                    <Circle className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 stroke-[3px] text-[#0a0f16] ${friend.status === 'Online' ? (friend.game?.startsWith('Jogando') ? 'fill-hytale-mana' : 'fill-hytale-emerald') : 'fill-white/10'
                      }`} />
                    {friend.id && unreadMessages[friend.id] > 0 && (
                      <div className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-500 rounded-full flex items-center justify-center">
                        <span className="text-[9px] font-bold text-white">{unreadMessages[friend.id]}</span>
                      </div>
                    )}
                  </div>
                ))}
                {displayFriends.filter(f => !partyMembers.some(pm => pm.id === f.id)).length > 4 && (
                  <span className="text-[8px] text-white/30 font-bold">+{displayFriends.filter(f => !partyMembers.some(pm => pm.id === f.id)).length - 4}</span>
                )}
              </div>
            ) : (
              <>
                {showInviteModal && (
                  <FriendSelectorModal
                    friends={displayFriends.filter(f => !partyMembers.some(m => m.name === f.username))}
                    onSelect={(friendId) => {
                      handleInviteToParty(friendId);
                      setShowInviteModal(false);
                    }}
                    onClose={() => setShowInviteModal(false)}
                  />
                )}

                <div className="p-6 border-b border-white/5">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <Users className="w-4 h-4 text-hytale-accent" />
                      <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em]">Rede Orbis</span>
                    </div>
                    <div className="flex gap-3 relative">
                      <button
                        onClick={() => setShowNotifications(!showNotifications)}
                        className={`p-2 rounded-lg transition-all relative ${showNotifications ? 'bg-white/10 text-white' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}
                      >
                        <Bell className="w-4 h-4" />
                        {notifications.some(n => n.unread) && (
                          <span className="absolute top-1 right-1 w-2 h-2 bg-hytale-accent rounded-full border-2 border-[#0a0f16]"></span>
                        )}
                      </button>

                      {showNotifications && (
                        <div className="absolute top-full right-0 mt-4 w-96 z-50 animate-in fade-in zoom-in-95 duration-200">
                          <div className="bg-[#0a0f16] border border-white/10 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[400px]">
                            <div className="p-4 border-b border-white/5 bg-black/20 flex justify-between items-center">
                              <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Notificações</h3>
                              <button onClick={() => setNotifications(prev => prev.map(n => ({ ...n, unread: false })))} className="text-[9px] text-hytale-accent hover:underline cursor-pointer font-bold uppercase tracking-wide">
                                Marcar lidas
                              </button>
                            </div>

                            <div className="overflow-y-auto custom-scrollbar">
                              {notifications.length === 0 ? (
                                <div className="p-8 text-center text-white/20 text-xs italic">Nenhuma notificação nova.</div>
                              ) : (
                                notifications.map((notif) => (
                                  <div key={notif.id} className={`p-4 border-b border-white/5 hover:bg-white/5 transition-colors flex gap-4 ${notif.unread ? 'bg-hytale-accent/5' : ''}`}>
                                    <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${notif.unread ? 'bg-hytale-accent' : 'bg-white/10'}`}></div>
                                    <div className="flex-1 min-w-0">
                                      <h4 className={`text-xs font-bold leading-tight mb-1 ${notif.unread ? 'text-white' : 'text-white/60'}`}>{notif.title}</h4>
                                      <p className="text-[10px] text-white/40 leading-relaxed break-words">{notif.msg}</p>
                                      <span className="text-[9px] text-white/20 mt-2 block font-mono">{notif.time} ago</span>

                                      {notif.type === 'party_invite' && notif.partyInviteData && (
                                        <div className="flex gap-2 mt-3">
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              const data = notif.partyInviteData!;
                                              setPendingInvite({
                                                id: data.inviteId,
                                                partyId: data.partyId,
                                                from: data.from,
                                                avatar: data.avatar
                                              });
                                              setNotifications(prev => prev.filter(n => n.id !== notif.id));
                                              const success = await SupabaseService.respondToPartyInvite(data.inviteId, true, data.partyId);
                                              if (success) {
                                                setActivePartyId(data.partyId);
                                                const members = await SupabaseService.getPartyMembers(data.partyId);
                                                setPartyMembers(members.map((m: any) => ({
                                                  id: m.user_id || m.id,
                                                  name: m.username,
                                                  username: m.username,
                                                  avatar: m.avatar,
                                                  status: m.status || 'Online',
                                                  isLeader: m.isLeader,
                                                  isAdmin: m.isLeader
                                                })));
                                                setToast({ message: `Você entrou no grupo de ${data.from}!`, type: 'success' });
                                              }
                                              setPendingInvite(null);
                                            }}
                                            className="flex-1 py-1.5 px-3 bg-hytale-emerald/10 text-hytale-emerald text-[9px] font-bold uppercase tracking-wide rounded hover:bg-hytale-emerald hover:text-black transition-all flex items-center justify-center gap-1"
                                          >
                                            <Check className="w-3 h-3" /> Aceitar
                                          </button>
                                          <button
                                            onClick={async (e) => {
                                              e.stopPropagation();
                                              const data = notif.partyInviteData!;
                                              await SupabaseService.respondToPartyInvite(data.inviteId, false, data.partyId);
                                              setNotifications(prev => prev.filter(n => n.id !== notif.id));
                                              setToast({ message: 'Convite recusado.', type: 'error' });
                                            }}
                                            className="flex-1 py-1.5 px-3 bg-red-500/10 text-red-500 text-[9px] font-bold uppercase tracking-wide rounded hover:bg-red-500 hover:text-black transition-all flex items-center justify-center gap-1"
                                          >
                                            <X className="w-3 h-3" /> Recusar
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setNotifications(prev => prev.filter(n => n.id !== notif.id));
                                      }}
                                      className="self-start p-1 hover:bg-white/10 rounded transition-colors text-white/20 hover:text-red-400"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => setShowAddFriend(true)}
                        className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-all text-white/40 hover:text-white"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div
                    onClick={() => setActiveView(View.ACCOUNTS)}
                    className={`orbis-panel p-4 flex items-center gap-4 group cursor-pointer hover:border-hytale-accent/30 transition-all rounded-xl ${activeView === View.ACCOUNTS ? 'border-hytale-accent shadow-[0_0_15px_rgba(245,184,65,0.1)]' : 'border-white/10'}`}
                  >
                    <div className="relative">
                      <div className="w-12 h-12 rounded bg-[#1c2635] overflow-hidden border border-white/10 flex items-center justify-center">
                        <img src={`https://hyvatar.io/render/${user?.type === 'offline' ? 'Varyn' : (user?.username || 'D4rkks')}?size=128&rotate=0`} className="w-full h-full" alt="Avatar" />
                      </div>
                      <Circle className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 text-[#0a0f16] stroke-[3px] ${user?.type === 'offline' ? 'fill-[#4b5563]' : 'fill-hytale-emerald'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-white uppercase tracking-widest group-hover:text-hytale-accent transition-colors truncate">{user?.username || 'Guest'}</p>
                      <p className="text-[9px] font-bold uppercase tracking-widest flex items-center gap-1.5 min-w-0">
                        <span className={user?.type === 'offline' ? 'text-white/20' : 'text-hytale-emerald'}>
                          {user?.type === 'offline' ? 'Offline' : 'Online'}
                        </span>
                        {isConnected && myActivity && myActivity !== 'No Menu' && (
                          <span className="text-white/20 truncate max-w-[150px]"> - {myActivity}</span>
                        )}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLogout();
                      }}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors group/logout"
                    >
                      <LogOut className="w-4 h-4 text-white/20 group-hover/logout:text-red-500 transition-colors" />
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-h-0">
                  {user?.type === 'offline' ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center opacity-40">
                      <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-4">
                        <Globe className="w-5 h-5 text-white" />
                      </div>
                      <h3 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">Modo Offline</h3>
                      <p className="text-[9px] font-bold text-white/60">Recursos sociais estão desabilitados.</p>
                    </div>
                  ) : (
                    <>
                      <div className="p-6 pb-2">
                        <div className="relative mb-6">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                          <input
                            type="text"
                            placeholder="Buscar amigos..."
                            className="w-full bg-white/5 border border-white/5 rounded-lg pl-10 pr-4 py-2 text-[10px] uppercase font-bold tracking-widest focus:outline-none focus:border-hytale-accent/30 text-white placeholder:text-white/20"
                          />
                        </div>
                        {pendingRequests.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 flex items-center gap-2 px-6">
                              Solicitações <span className="w-1 h-1 rounded-full bg-hytale-accent"></span> {pendingRequests.length}
                            </h3>
                            <div className="space-y-1 px-4">
                              {pendingRequests.map((req) => (
                                <div key={req.id} className="p-3 bg-white/5 rounded-xl flex items-center gap-3 group border border-transparent hover:border-white/10 transition-all">
                                  <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/5 overflow-hidden shrink-0">
                                    <img src={req.avatar} className="w-full h-full" alt={req.username} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-white uppercase tracking-wide truncate">{req.username}</p>
                                    <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">Quer ser seu amigo</p>
                                  </div>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => handleRespondToRequest(req.id, true, req.username)}
                                      className="p-1.5 bg-hytale-emerald/10 text-hytale-emerald rounded hover:bg-hytale-emerald hover:text-black transition-all"
                                      title="Aceitar"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => handleRespondToRequest(req.id, false, req.username)}
                                      className="p-1.5 bg-red-500/10 text-red-500 rounded hover:bg-red-500 hover:text-black transition-all"
                                      title="Recusar"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {partyMembers.length > 0 && (
                          <div className="mb-6">
                            <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 flex items-center justify-between px-6">
                              <span className="flex items-center gap-2">
                                Grupo <span className="w-1 h-1 rounded-full bg-hytale-mana"></span> {partyMembers.length}/4
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    setOpenChat(openChat === '@PARTY' ? null : '@PARTY');
                                    if (openChat !== '@PARTY') setUnreadPartyMessages(0);
                                  }}
                                  title="Chat do Grupo"
                                  className="p-1.5 hover:bg-white/5 rounded transition-all text-white/40 hover:text-hytale-accent relative"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  {unreadPartyMessages > 0 && (
                                    <div className="absolute top-[4px] right-[2px] min-w-[8px] h-[8px] bg-red-500 rounded-full animate-pulse shadow-lg pointer-events-none border border-[#0F131A]"></div>
                                  )}
                                </button>
                                <button
                                  onClick={handleLeaveParty}
                                  className="p-1.5 hover:bg-red-500/10 rounded transition-all text-white/40 hover:text-red-500"
                                  title="Sair do Grupo"
                                >
                                  <LogOut className="w-3 h-3" />
                                </button>
                              </div>
                            </h3>
                            <div className="space-y-1 px-4">
                              {partyMembers.map((member) => (
                                <div key={member.id} className="p-3 bg-white/5 rounded-xl flex items-center gap-3 group border border-transparent hover:border-hytale-mana/30 transition-all relative">
                                  <div className="w-8 h-8 rounded-lg bg-black/40 border border-white/5 overflow-hidden shrink-0">
                                    <img src={`https://hyvatar.io/render/${member.username}?size=128&rotate=0`} className="w-full h-full" alt={member.username} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[10px] font-black text-white uppercase tracking-wide truncate group-hover:text-hytale-mana transition-colors">
                                      {member.username}
                                      {member.isLeader && <span className="text-hytale-mana ml-1 text-[8px]">👑</span>}
                                    </p>
                                    <p className="text-[8px] font-bold text-white/40 uppercase tracking-widest">{member.isAdmin ? 'Líder' : 'Membro'}</p>
                                  </div>

                                  {partyMembers.find(m => m.id === SupabaseService.getCurrentUserId())?.isLeader && !member.isLeader && (
                                    <button
                                      onClick={() => handleRemoveFromParty(member.id, member.username)}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-red-500/10 text-red-500 rounded opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-black"
                                      title="Remover do grupo"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <h3 className="text-[10px] font-black text-white/20 uppercase tracking-[0.3em] mb-4 flex items-center gap-2 px-6">
                          Amigos <span className="w-1 h-1 rounded-full bg-white/20"></span> {displayFriends.length}
                        </h3>
                      </div>

                      <div className="flex-1 overflow-y-auto px-6 space-y-2 pb-6 custom-scrollbar">
                        {displayFriends.map((friend, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all cursor-pointer group relative"
                            onClick={() => handleOpenChat(friend.name)}
                            onContextMenu={(e) => handleRightClick(e, friend)}
                          >
                            <div className="relative flex-shrink-0">
                              <div className={`w-10 h-10 rounded-lg bg-black/40 border border-white/5 overflow-hidden ${friend.status === 'Offline' ? 'grayscale opacity-60' : ''}`}>
                                <img src={friend.avatar} className="w-full h-full" alt={friend.name} />
                              </div>
                              <Circle className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 stroke-[3px] text-[#0a0f16] ${friend.status === 'Online' ? (friend.game?.startsWith('Jogando') ? 'fill-hytale-mana' : 'fill-hytale-emerald') : 'fill-white/10'
                                }`} />
                              {friend.id && unreadMessages[friend.id] > 0 && (
                                <div className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                  <span className="text-[10px] font-bold text-white">{unreadMessages[friend.id] > 9 ? '9+' : unreadMessages[friend.id]}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-black text-white/80 uppercase tracking-tight truncate group-hover:text-white transition-colors">{friend.name}</p>
                              <p className="text-[9px] font-bold uppercase truncate tracking-widest">
                                <span className={friend.status === 'Online' ? 'text-hytale-emerald' : 'text-white/20'}>
                                  {friend.status}
                                </span>
                                {friend.game && friend.game !== 'No Menu' && (
                                  <span className={friend.game.startsWith('Jogando') ? 'text-hytale-mana' : 'text-white/20'}>
                                    {' • '}{friend.game}
                                  </span>
                                )}
                              </p>
                            </div>
                            <MessageSquare className="w-4 h-4 text-white/0 group-hover:text-hytale-accent transition-colors" />
                          </div>
                        ))}

                        <button onClick={() => setShowAddFriend(true)} className="w-full mt-4 flex items-center justify-center gap-2 p-3 border border-dashed border-white/5 rounded-xl text-white/20 hover:text-white/40 hover:border-white/10 transition-all text-[10px] font-black uppercase tracking-widest group">
                          <Plus className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform" /> Adicionar Amigo
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </aside>


          {pendingInvite && (
            <PartyInvite
              inviter={{ name: pendingInvite.from, avatar: pendingInvite.avatar }}
              onAccept={handleAcceptPartyInvite}
              onDecline={() => setPendingInvite(null)}
            />
          )}

          {contextMenu && (
            <FriendContextMenu
              position={{ x: contextMenu.x, y: contextMenu.y }}
              onOpenChat={() => handleOpenChat(contextMenu.friend.name)}
              onInviteToParty={() => handleInviteToParty(contextMenu.friend.name)}
              onRemoveFriend={async () => {
                try {
                  const friend = friends.find(f => f.name === contextMenu.friend.name);
                  if (friend?.id) {
                    await SupabaseService.removeFriend(friend.id);
                    const friendsList = await SupabaseService.getFriends();
                    const formatted = friendsList.map((p: any) => ({
                      id: p.id || p.user_id,
                      username: p.username,
                      name: p.username,
                      status: 'Offline',
                      avatar: `https://hyvatar.io/render/${p.username}?size=128&rotate=0`,
                      game: ''
                    }));
                    setFriends(formatted);
                    console.log('✅ Friend removed:', contextMenu.friend.name);
                  }
                } catch (error) {
                  console.error('Failed to remove friend:', error);
                }
                setContextMenu(null);
              }}
              onClose={() => setContextMenu(null)}
            />
          )}
        </div>
        {showAddFriend && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-8 backdrop-blur-xl bg-[#0a0f16]/95 animate-in fade-in duration-300">
            <div className="w-full max-w-sm bg-[#0a0f16] border border-white/10 rounded-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl relative overflow-hidden">
              <div className="relative z-10 flex items-center justify-between">
                <h3 className="text-xl font-black text-white uppercase tracking-widest">Adicionar Amigo</h3>
                <button onClick={() => setShowAddFriend(false)} className="p-2 hover:bg-white/5 rounded-lg transition-all">
                  <X className="w-5 h-5 text-white/20" />
                </button>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-white/40 uppercase tracking-widest">Nome de Usuário</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ex: KweebecFan"
                  value={friendInput}
                  onChange={(e) => setFriendInput(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (!friendInput.trim()) return;

                      const { exists, userId, actualUsername } = await SupabaseService.validateUserForFriendRequest(friendInput);

                      if (!exists) {
                        setToast({ message: `Usuário "${friendInput}" não encontrado.`, type: 'error' });
                        setShowAddFriend(false);
                        setFriendInput("");
                        return;
                      }

                      try {
                        await SupabaseService.sendFriendRequest(userId!);
                        setToast({ message: `Solicitação enviada para ${actualUsername || friendInput}.`, type: 'success' });
                      } catch (err: any) {
                        setToast({ message: err.message || 'Falha na solicitação', type: 'error' });
                      }

                      setShowAddFriend(false);
                      setFriendInput("");
                    }
                  }}
                  className="w-full bg-[#05080b] border border-white/10 p-4 rounded text-white focus:outline-none focus:border-hytale-accent transition-all font-bold placeholder:text-white/10"
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setShowAddFriend(false)}
                  className="flex-1 px-6 py-3 bg-white/5 hover:bg-white/10 rounded font-black uppercase tracking-widest text-[10px] text-white/40 hover:text-white transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={async () => {
                    if (!friendInput.trim()) return;

                    const { exists, userId, actualUsername } = await SupabaseService.validateUserForFriendRequest(friendInput);

                    if (!exists) {
                      setToast({ message: `Usuário "${friendInput}" não encontrado.`, type: 'error' });
                      setShowAddFriend(false);
                      setFriendInput("");
                      return;
                    }

                    try {
                      await SupabaseService.sendFriendRequest(userId!);

                      setToast({ message: `Solicitação enviada para ${actualUsername || friendInput}.`, type: 'success' });
                    } catch (err: any) {
                      setToast({ message: err.message || 'Falha na solicitação', type: 'error' });
                    }

                    setShowAddFriend(false);
                    setFriendInput("");
                  }}
                  className="flex-1 px-6 py-3 bg-hytale-accent text-black font-black uppercase tracking-widest text-[10px] rounded hover:brightness-110 transition-all font-black"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

// SupabaseService.ts - SECURE VERSION v2.0 (FORCE REFRESH)
import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

declare global {
    interface Window {
        __supabaseService?: SupabaseService;
    }
}

export class SupabaseService {
    private supabase: SupabaseClient;
    private presenceChannel: RealtimeChannel | null = null;
    private currentUserId: string | null = null;
    private currentPartyId: string | null = null;

    private currentPartyKey: string | null = null;
    private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

    private constructor() {
        this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: true
            }
        });
    }

    static getInstance(): SupabaseService {
        if (!window.__supabaseService) {
            window.__supabaseService = new SupabaseService();
        }
        return window.__supabaseService;
    }

    getCurrentUserId(): string | null {
        return this.currentUserId;
    }
    getClient(): SupabaseClient {
        return this.supabase;
    }

    async checkSession(): Promise<boolean> {
        try {
            const { data: { session } } = await this.supabase.auth.getSession();

            if (session?.user) {
                console.log('✅ Active session found');
                this.currentUserId = session.user.id;
                await this.setupUserProfile();
                await this.initializeE2EE(session.user.id);
                return true;
            }

            console.log('ℹ️ No active session');
            return false;

        } catch (error) {
            console.error('Session check failed:', error);
            return false;
        }
    }

    async loginWithHytale(username: string, uuid: string): Promise<boolean> {
        try {
            if (!uuid || uuid.length < 10) throw new Error('Invalid UUID');
            if (!username || !this.validateUsername(username)) throw new Error('Invalid username');

            const email = `${uuid.toLowerCase()}@hytale.orbis.internal`;
            const password = await this.deriveSecurePassword(uuid);

            console.log('🔐 Connecting to Orbis Network with Hytale account:', username);

            const { data: { session } } = await this.supabase.auth.getSession();
            if (session?.user) {
                console.log('✅ Existing Orbis session found');
                this.currentUserId = session.user.id;
                await this.setupUserProfile();
                return true;
            }

            const { data: loginData, error: loginError } = await this.supabase.auth.signInWithPassword({ email, password });

            if (loginData?.user) {
                console.log('✅ Logged into Orbis Network');
                this.currentUserId = loginData.user.id;
                await this.setupUserProfile();
                await this.initializeE2EE(loginData.user.id);
                return true;
            }

            if (loginError) {
                console.log('📝 Creating new Orbis account for:', username);
                const { data: existingUser } = await this.supabase.from('profiles').select('username').ilike('username', username).maybeSingle();

                if (existingUser) {
                    const uniqueUsername = `${username}_${uuid.slice(0, 4)}`;
                    console.log('⚠️ Username taken, using:', uniqueUsername);
                    username = uniqueUsername;
                }

                const { data: signUpData, error: signUpError } = await this.supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            username: username,
                            hytale_uuid: uuid,
                            created_via: 'hytale_oauth',
                            created_at: new Date().toISOString()
                        }
                    }
                });

                if (signUpError) throw signUpError;

                if (signUpData?.user) {
                    console.log('✅ Orbis account created successfully');
                    this.currentUserId = signUpData.user.id;
                    await this.setupUserProfile();
                    await this.initializeE2EE(signUpData.user.id);
                    return true;
                }
            }

            return false;
        } catch (error) {
            console.error('❌ Orbis connection failed:', error);
            throw error;
        }
    }

    private async deriveSecurePassword(uuid: string): Promise<string> {
        const encoder = new TextEncoder();
        const salt = import.meta.env.VITE_APP_SECRET_SALT || 'fallback-salt-change-in-prod';
        const data = encoder.encode(uuid.toLowerCase() + salt);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        return `orbis_${hashHex.slice(0, 32)}`;
    }

    private validateUsername(username: string): boolean {
        return /^[a-zA-Z0-9_]{3,20}$/.test(username);
    }

    async login(email: string, password: string): Promise<void> {
        try {
            const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (!data.user) throw new Error('Login failed');
            this.currentUserId = data.user.id;
            await this.setupUserProfile();
        } catch (error: any) {
            console.error('Login failed:', error);
            throw error;
        }
    }

    async registerUser(email: string, password: string, username: string): Promise<void> {
        try {
            if (!this.validateUsername(username)) throw new Error('Invalid username');
            const { data, error } = await this.supabase.auth.signUp({
                email,
                password,
                options: { data: { username: username } }
            });
            if (error) throw error;
            if (!data.user) throw new Error('Registration failed');
            this.currentUserId = data.user.id;
            await this.setupUserProfile();
        } catch (error: any) {
            console.error('Registration failed:', error);
            throw error;
        }
    }
    async logout(): Promise<void> {
        try {
            await this.cleanup();
            await this.supabase.auth.signOut();
            this.currentUserId = null;
            console.log('✅ Logout successful');
        } catch (error) {
            console.error('Logout failed:', error);
            throw error;
        }
    }

    private async setupUserProfile(): Promise<void> {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            const username = user.user_metadata?.username || user.email?.split('@')[0] || `user_${user.id.slice(0, 8)}`;

            const { data: profile } = await this.supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();

            if (!profile) {
                console.log('📝 Creating profile for user:', user.id);
                const { CryptoService } = await import('./CryptoService');
                let keys = await CryptoService.getKeys();

                if (!keys) {
                    const identityKeys = await CryptoService.generateIdentityKeyPair();
                    const preKeys = await CryptoService.generatePreKey();
                    await CryptoService.saveKeys(identityKeys);
                    await CryptoService.savePreKeys(preKeys);
                    await this.supabase.from('profiles').insert({
                        id: user.id,
                        username: username,
                        identity_key: identityKeys.publicKey,
                        signed_pre_key: preKeys.publicKey
                    });
                } else {
                    let preKeys = await CryptoService.getPreKeys() || await CryptoService.generatePreKey();
                    await CryptoService.savePreKeys(preKeys);
                    await this.supabase.from('profiles').insert({
                        id: user.id,
                        username: username,
                        identity_key: keys.publicKey,
                        signed_pre_key: preKeys.publicKey
                    });
                }
            }
            console.log('✅ Profile setup complete');
            this.startHeartbeat();
        } catch (error) {
            console.warn('⚠️ Profile setup error:', error);
        }
    }

    private async initializeE2EE(userId: string): Promise<void> {
        try {
            const { CryptoService } = await import('./CryptoService');
            let identityKeys = await CryptoService.getKeys() || await CryptoService.generateIdentityKeyPair();
            await CryptoService.saveKeys(identityKeys);
            let preKeys = await CryptoService.getPreKeys() || await CryptoService.generatePreKey();
            await CryptoService.savePreKeys(preKeys);

            await this.supabase.from('profiles').update({
                identity_key: identityKeys.publicKey,
                signed_pre_key: preKeys.publicKey
            }).eq('id', userId);
        } catch (error) { console.warn('⚠️ E2EE init failed:', error); }
    }

    async searchUsers(query: string): Promise<any[]> {
        try {
            if (query.length < 2) return [];
            const { data, error } = await this.supabase
                .from('user_directory')
                .select('username')
                .ilike('username', `%${query}%`)
                .eq('searchable', true)
                .limit(10);
            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }

    async validateUserForFriendRequest(username: string): Promise<{ exists: boolean; userId?: string; actualUsername?: string }> {
        try {
            const { data, error } = await this.supabase
                .from('user_directory')
                .select('user_id, username')
                .ilike('username', username)
                .eq('searchable', true)
                .maybeSingle();
            if (error) throw error;
            return {
                exists: !!data,
                userId: data?.user_id,
                actualUsername: data?.username
            };
        } catch (error) {
            console.error('User validation failed:', error);
            return { exists: false };
        }
    }

    async checkUserExists(username: string): Promise<boolean> {
        const { exists } = await this.validateUserForFriendRequest(username);
        return exists;
    }

    async sendFriendRequest(recipientId: string): Promise<void> {
        try {
            if (!this.currentUserId) throw new Error('Not authenticated');
            if (recipientId === this.currentUserId) throw new Error('Cannot send request to yourself');

            const { data: existing } = await this.supabase
                .from('friend_requests')
                .select('*')
                .or(`and(sender_id.eq.${this.currentUserId},recipient_id.eq.${recipientId}),and(sender_id.eq.${recipientId},recipient_id.eq.${this.currentUserId})`)
                .maybeSingle();

            if (existing) {
                if (existing.status === 'pending') {
                    if (existing.sender_id === this.currentUserId) throw new Error('Friend request already pending');
                    if (existing.recipient_id === this.currentUserId) {
                        await this.respondToFriendRequest(existing.id, true);
                        return;
                    }
                }
                if (existing.status === 'accepted') throw new Error('Already friends');
                if (existing.status === 'declined') {
                    await this.supabase.from('friend_requests').delete().eq('id', existing.id);
                }
            }

            const { error } = await this.supabase
                .from('friend_requests')
                .insert({
                    sender_id: this.currentUserId,
                    recipient_id: recipientId,
                    status: 'pending'
                });

            if (error) throw error;
        } catch (error: any) {
            console.error('Send friend request failed:', error);
            throw error;
        }
    }

    subscribeToFriendRequests(onUpdate: () => void) {
        if (!this.currentUserId) return;
        return this.supabase.channel(`friend_requests:${this.currentUserId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friend_requests'
            }, (payload) => {
                const record = payload.new as any || payload.old as any;
                if (payload.eventType === 'DELETE' || (record && (record.sender_id === this.currentUserId || record.recipient_id === this.currentUserId))) {
                    console.log('🔔 Friend request update, refreshing...');
                    onUpdate();
                }
            })
            .subscribe();
    }

    async getFriendRequests(): Promise<any[]> {
        try {
            if (!this.currentUserId) return [];
            const { data: requests, error } = await this.supabase
                .from('friend_requests')
                .select('id, sender_id, recipient_id, status, created_at')
                .or(`sender_id.eq.${this.currentUserId},recipient_id.eq.${this.currentUserId}`)
                .order('created_at', { ascending: false });

            if (error) throw error;
            if (!requests || requests.length === 0) return [];

            const userIds = new Set<string>();
            requests.forEach((r: any) => {
                userIds.add(r.sender_id);
                userIds.add(r.recipient_id);
            });

            const { data: profiles, error: profilesError } = await this.supabase
                .from('profiles')
                .select('id, username')
                .in('id', Array.from(userIds));

            if (profilesError) throw profilesError;

            return requests.map((r: any) => {
                const sender = profiles?.find(p => p.id === r.sender_id);
                const recipient = profiles?.find(p => p.id === r.recipient_id);
                return {
                    ...r,
                    sender: sender ? { username: sender.username } : null,
                    recipient: recipient ? { username: recipient.username } : null
                };
            });
        } catch (error) {
            console.error('Get friend requests failed:', error);
            return [];
        }
    }

    async respondToFriendRequest(requestId: string, accept: boolean): Promise<void> {
        try {
            const { error } = await this.supabase
                .from('friend_requests')
                .update({ status: accept ? 'accepted' : 'declined' })
                .eq('id', requestId);
            if (error) throw error;
        } catch (error) {
            console.error('Respond to friend request failed:', error);
            throw error;
        }
    }

    async getFriends(): Promise<any[]> {
        if (!this.currentUserId) return [];
        const { data } = await this.supabase.from('friend_requests').select('sender_id, recipient_id').eq('status', 'accepted').or(`sender_id.eq.${this.currentUserId},recipient_id.eq.${this.currentUserId}`);
        if (!data) return [];
        const friendIds = data.map((req: any) => req.sender_id === this.currentUserId ? req.recipient_id : req.sender_id);
        const { data: profiles } = await this.supabase.from('profiles').select('id, username').in('id', friendIds);
        return profiles || [];
    }

    async removeFriend(friendId: string): Promise<void> {
        try {
            if (!this.currentUserId) throw new Error('Not authenticated');
            const { data: request, error: findError } = await this.supabase
                .from('friend_requests')
                .select('id')
                .eq('status', 'accepted')
                .or(`and(sender_id.eq.${this.currentUserId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${this.currentUserId})`)
                .maybeSingle();
            if (findError) throw findError;
            if (!request) throw new Error('Friendship not found');
            const { error: deleteError } = await this.supabase.from('friend_requests').delete().eq('id', request.id);
            if (deleteError) throw deleteError;
        } catch (error) {
            console.error('Remove friend failed:', error);
            throw error;
        }
    }

    async getAllProfiles() {
        try {
            const { data: users, error } = await this.supabase
                .from('user_directory')
                .select('user_id, username')
                .eq('searchable', true)
                .neq('user_id', this.currentUserId || '0')
                .limit(20);
            if (error) throw error;
            return users?.map(u => ({ id: u.user_id, username: u.username })) || [];
        } catch (e) {
            return [];
        }
    }

    startHeartbeat(): void {
        if (this.heartbeatInterval || !this.currentUserId) return;
        this.updateHeartbeat();
        this.heartbeatInterval = setInterval(() => this.updateHeartbeat(), 60000);
    }

    private async updateHeartbeat(): Promise<void> {
        if (!this.currentUserId) return;
        await this.supabase.from('user_presence').update({ last_seen: new Date().toISOString() }).eq('user_id', this.currentUserId);
    }

    stopHeartbeat(): void {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    async cleanup(): Promise<void> {
        this.stopHeartbeat();
        if (this.currentPartyId) await this.leaveParty(this.currentPartyId);
        await this.markOffline();
        if (this.presenceChannel) await this.presenceChannel.unsubscribe();
    }

    async markOffline(): Promise<void> {
        if (!this.currentUserId) return;
        console.log('📡 Marking user as offline...');
        
        if (this.presenceChannel) {
            await this.presenceChannel.untrack();
            await this.presenceChannel.unsubscribe();
            this.presenceChannel = null;
        }

        const { error } = await this.supabase.from('user_presence').upsert({
            user_id: this.currentUserId,
            status: 'offline',
            activity: 'Offline',
            last_seen: new Date().toISOString()
        }, { onConflict: 'user_id' });

        if (error) console.error('❌ Failed to mark offline in DB:', error);
    }

    subscribeToPresence(onSync: (users: any[]) => void): RealtimeChannel {
        if (!this.presenceChannel) this.presenceChannel = this.supabase.channel('orbis_presence');

        const extractUsers = () => {
            const state = this.presenceChannel!.presenceState();
            const users: any[] = [];
            Object.keys(state).forEach(key => {
                const presences = state[key] as any[];
                if (presences?.length > 0) {
                    const latest = presences[presences.length - 1];
                    if (latest.username) users.push({
                        user_id: latest.user_id,
                        username: latest.username,
                        status: latest.status || 'online',
                        activity: latest.activity || 'No Menu'
                    });
                }
            });
            return users;
        };

        this.presenceChannel.on('presence', { event: 'sync' }, () => {
            console.log('📡 Presence sync event');
            onSync(extractUsers());
        });
        this.presenceChannel.on('presence', { event: 'join' }, ({ key, newPresences }) => {
            console.log(`📡 User joined presence: ${key}`, newPresences);
            onSync(extractUsers());
        });

        this.presenceChannel.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
            console.log(`📡 User left presence: ${key}`, leftPresences);
            onSync(extractUsers());
        });

        if (this.presenceChannel.state !== 'joined') this.presenceChannel.subscribe();
        return this.presenceChannel;
    }

    async getMessages(friendId: string, limit: number = 50): Promise<any[]> {
        const { data } = await this.supabase.from('messages')
            .select('id, sender_id, recipient_id, content, encrypted_content, nonce, encrypted, created_at, read_at')
            .or(`and(sender_id.eq.${this.currentUserId},recipient_id.eq.${friendId}),and(sender_id.eq.${friendId},recipient_id.eq.${this.currentUserId})`)
            .order('created_at', { ascending: true }).limit(limit);
        if (!data) return [];
        const { CryptoService } = await import('./CryptoService');
        const myKeys = await CryptoService.getPreKeys();
        const friendProfile = await this.getProfileById(friendId);
        return await Promise.all(data.map(async (msg) => {
            if (msg.encrypted && msg.encrypted_content && msg.nonce && myKeys?.privateKey && friendProfile?.signed_pre_key) {
                try {
                    const decrypted = await CryptoService.decryptMessage(msg.encrypted_content, msg.nonce, friendProfile.signed_pre_key, myKeys.privateKey);
                    return { ...msg, content: decrypted };
                } catch (e) { return { ...msg, content: '[Erro ao descriptografar]' }; }
            }
            return msg;
        }));
    }

    async getProfileById(userId: string) {
        const { data } = await this.supabase.from('profiles').select('id, username, signed_pre_key, identity_key').eq('id', userId).single();
        return data;
    }

    async markMessagesAsRead(senderId: string): Promise<void> {
        if (!this.currentUserId) return;
        await this.supabase.from('messages').update({ read_at: new Date().toISOString() }).match({ sender_id: senderId, recipient_id: this.currentUserId }).is('read_at', null);
    }

    async getMyPartyId(): Promise<string | null> {
        if (!this.currentUserId) return null;
        const { data } = await this.supabase.from('party_members').select('party_id, encrypted_key').eq('user_id', this.currentUserId).maybeSingle();

        if (data && data.encrypted_key && !this.currentPartyKey) {
            try {
                const { CryptoService } = await import('./CryptoService');
                const myKeys = await CryptoService.getKeys();
                if (myKeys?.privateKey) {
                    const parsed = JSON.parse(data.encrypted_key);
                    if (parsed.ciphertext && parsed.nonce && myKeys.publicKey) {
                        this.currentPartyKey = await CryptoService.decryptMessage(
                            parsed.ciphertext,
                            parsed.nonce,
                            myKeys.publicKey,
                            myKeys.privateKey
                        );
                        console.log('🔐 Restored Party Key');
                    }
                }
            } catch (e) {
                console.warn('Failed to restore party key', e);
            }
        }

        return data?.party_id || null;
    }

    async createParty(): Promise<string | null> {
        if (!this.currentUserId) return null;
        const existingId = await this.getMyPartyId();
        if (existingId) return existingId;

        const { data: party } = await this.supabase.from('parties').insert({ leader_id: this.currentUserId }).select().single();
        if (!party) return null;

        let encryptedKeyForMe = null;
        try {
            const { CryptoService } = await import('./CryptoService');
            const partyKey = await CryptoService.generateSymmetricKey();
            this.currentPartyKey = partyKey;

            const myKeys = await CryptoService.getKeys();
            if (myKeys && myKeys.publicKey) {
                const { ciphertext, nonce } = await CryptoService.encryptMessage(partyKey, myKeys.publicKey, myKeys.privateKey);
                encryptedKeyForMe = JSON.stringify({ ciphertext, nonce });
            }
        } catch (e) { console.error('E2EE Setup failed for party:', e); }

        await this.supabase.from('party_members').insert({
            party_id: party.id,
            user_id: this.currentUserId,
            encrypted_key: encryptedKeyForMe
        });
        this.currentPartyId = party.id;
        return party.id;
    }

    async inviteToParty(partyId: string, friendId: string): Promise<boolean> {
        if (!this.currentUserId || !this.currentPartyKey) {
            console.error('Cannot invite: No party key available (E2EE)');
            // Fallback for unencrypted? No, strict security.
            return false;
        }
        console.log(`✉️ Sending invite to ${friendId} for party ${partyId}...`);

        let encryptedKeyForRecipient = null;
        try {
            const { CryptoService } = await import('./CryptoService');
            const myKeys = await CryptoService.getKeys();
            const friendProfile = await this.getProfileById(friendId);

            if (myKeys?.privateKey && friendProfile?.signed_pre_key) {
                const { ciphertext, nonce } = await CryptoService.encryptMessage(
                    this.currentPartyKey,
                    friendProfile.signed_pre_key,
                    myKeys.privateKey
                );
                encryptedKeyForRecipient = JSON.stringify({ ciphertext, nonce, senderKey: myKeys.publicKey });
            } else {
                console.warn('Cannot encrypt invite: missing keys');
            }
        } catch (e) {
            console.error('Failed to encrypt invite key:', e);
            throw e;
        }

        await this.supabase.from('party_invites').delete().match({
            party_id: partyId,
            recipient_id: friendId,
            status: 'pending'
        });

        const { error } = await this.supabase.from('party_invites').insert({
            party_id: partyId,
            sender_id: this.currentUserId,
            recipient_id: friendId,
            status: 'pending',
            encrypted_key: encryptedKeyForRecipient
        });

        if (error) throw error;
        return true;
    }

    async getPartyMembers(partyId: string): Promise<any[]> {
        try {
            const { data: members } = await this.supabase.from('party_members').select('user_id, profiles:user_id(username)').eq('party_id', partyId);
            if (!members) return [];

            const userIds = members.map(m => m.user_id);
            const { data: presences } = await this.supabase.from('user_presence').select('user_id, status, last_seen').in('user_id', userIds);
            const presenceMap = (presences || []).reduce((acc: any, p: any) => { acc[p.user_id] = p; return acc; }, {});
            const { data: party } = await this.supabase.from('parties').select('leader_id').eq('id', partyId).maybeSingle();

            return members.map((m: any) => {
                const presence = presenceMap[m.user_id] || {};
                const lastSeen = presence.last_seen ? new Date(presence.last_seen).getTime() : 0;
                const status = (Date.now() - lastSeen) < 3 * 60 * 1000 ? (presence.status || 'Online') : 'Offline';
                return {
                    id: m.user_id,
                    username: m.profiles?.username || 'Unknown',
                    isLeader: m.user_id === party?.leader_id,
                    status: status,
                    avatar: `https://hyvatar.io/render/${m.profiles?.username || 'none'}?size=128&rotate=0`
                };
            });
        } catch (err) { return []; }
    }

    async leaveParty(partyId: string): Promise<void> {
        if (!this.currentUserId) return;
        try {
            console.log(`🚪 leaveParty called for partyId=${partyId}, userId=${this.currentUserId}`);

            const { data: party } = await this.supabase.from('parties').select('leader_id').eq('id', partyId).maybeSingle();
            const wasLeader = party?.leader_id === this.currentUserId;
            console.log(`👑 Was leader: ${wasLeader}, party leader_id: ${party?.leader_id}`);

            const { error: delError, data: delData } = await this.supabase.from('party_members').delete().match({ party_id: partyId, user_id: this.currentUserId }).select();
            if (delError) {
                console.error('❌ Failed to remove self from party:', delError);
                throw delError;
            }
            console.log(`✅ Removed self from party, deleted rows:`, delData);

            if (wasLeader) {
                const { data: remainingMembers, error: fetchError } = await this.supabase.from('party_members')
                    .select('user_id')
                    .eq('party_id', partyId)
                    .limit(1);

                if (fetchError) {
                    console.error('❌ Failed to fetch remaining members:', fetchError);
                }

                console.log(`📋 Remaining members:`, remainingMembers);

                if (remainingMembers && remainingMembers.length > 0) {
                    const newLeaderId = remainingMembers[0].user_id;
                    console.log(`👑 Handing over leadership to ${newLeaderId}...`);

                    const { error: updateError, data: updateData } = await this.supabase.from('parties').update({ leader_id: newLeaderId }).eq('id', partyId).select();

                    if (updateError) {
                        console.error('❌ Failed to transfer leadership (RLS blocking?):', updateError);
                    } else {
                        console.log(`✅ Leadership transferred successfully:`, updateData);
                    }
                } else {
                    console.log('🚮 No remaining members, dissolving empty party...');
                    const { error: deleteError } = await this.supabase.from('parties').delete().eq('id', partyId);
                    if (deleteError) {
                        console.error('❌ Failed to delete empty party:', deleteError);
                    } else {
                        console.log('✅ Party dissolved');
                    }
                }
            }

            if (this.currentPartyId === partyId) this.currentPartyId = null;
            console.log(`✅ Left party ${partyId}`);
        } catch (err) {
            console.error('❌ Failed to leave party:', err);
            throw err;
        }
    }

    subscribeToPartyMembers(partyId: string, onUpdate: () => void) {
        return this.supabase.channel(`party-members:${partyId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'party_members',
                filter: `party_id=eq.${partyId}`
            }, (payload) => {
                console.log('🔔 Party member change detected:', payload.eventType, 'payload:', payload);
                if (payload.eventType === 'DELETE' && payload.old) {
                    console.log('🚪 Member removed from party:', (payload.old as any).user_id);
                }
                onUpdate();
            }).subscribe();
    }

    subscribeToPartyUpdate(partyId: string, onUpdate: () => void) {
        return this.supabase.channel(`party-update:${partyId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'parties',
                filter: `id=eq.${partyId}`
            }, () => {
                console.log('🔔 Party leadership/data update detected');
                onUpdate();
            }).subscribe();
    }

    async fetchMyPartyInvites(): Promise<any[]> {
        if (!this.currentUserId) return [];
        const { data } = await this.supabase.from('party_invites').select('id, party_id, encrypted_key, sender:sender_id(username, signed_pre_key, identity_key), parties(leader_id)')
            .eq('recipient_id', this.currentUserId).eq('status', 'pending').gt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());
        return data || [];
    }

    async respondToPartyInvite(inviteId: string, accept: boolean, partyId: string): Promise<boolean> {
        if (!this.currentUserId) return false;

        let encryptedKeyForMe = null;
        if (accept) {
            const { data: invite } = await this.supabase.from('party_invites').select('encrypted_key, sender_id').eq('id', inviteId).single();
            if (invite?.encrypted_key) {
                try {
                    const { CryptoService } = await import('./CryptoService');
                    const myKeys = await CryptoService.getKeys();
                    const senderProfile = await this.getProfileById(invite.sender_id);

                    const parsed = JSON.parse(invite.encrypted_key);
                    if (myKeys?.privateKey && parsed.nonce && parsed.ciphertext && senderProfile?.signed_pre_key) {
                        const senderPub = parsed.senderKey || senderProfile.signed_pre_key;

                        const partyKey = await CryptoService.decryptMessage(
                            parsed.ciphertext,
                            parsed.nonce,
                            senderPub,
                            myKeys.privateKey
                        );

                        this.currentPartyKey = partyKey;

                        if (myKeys.publicKey) {
                            const { ciphertext, nonce } = await CryptoService.encryptMessage(partyKey, myKeys.publicKey, myKeys.privateKey);
                            encryptedKeyForMe = JSON.stringify({ ciphertext, nonce });
                        }
                    }
                } catch (e) {
                    console.error('Failed to process party key accept:', e);
                }
            }
        }

        const status = accept ? 'accepted' : 'rejected';
        await this.supabase.from('party_invites').update({ status }).eq('id', inviteId);
        if (accept) {
            const existingPartyId = await this.getMyPartyId();
            if (existingPartyId && existingPartyId !== partyId) {
                console.log('🚪 Leaving current party before joining new one...');
                await this.leaveParty(existingPartyId);
            }
            await this.supabase.from('party_members').insert({
                party_id: partyId,
                user_id: this.currentUserId,
                encrypted_key: encryptedKeyForMe
            });
            this.currentPartyId = partyId;
        }
        return true;
    }

    subscribeToPartyInvites(onInvite: () => void) {
        if (!this.currentUserId) return;
        return this.supabase.channel('my-party-invites').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_invites', filter: `recipient_id=eq.${this.currentUserId}` }, () => onInvite()).subscribe();
    }

    async trackPresence(username: string): Promise<void> {
        try {
            if (!this.currentUserId) return;
            if (!this.presenceChannel) {
                this.presenceChannel = this.supabase.channel('orbis_presence', {
                    config: { presence: { key: username.toLowerCase() } }
                });
            }
            const trackData = {
                user_id: this.currentUserId,
                username: username,
                status: 'online',
                activity: 'No Menu',
                online_at: new Date().toISOString()
            };
            await this.supabase.from('user_presence').upsert({
                user_id: this.currentUserId,
                status: 'online',
                activity: 'No Menu',
                last_seen: new Date().toISOString()
            }, { onConflict: 'user_id' });

            if (this.presenceChannel.state === 'joined') {
                await this.presenceChannel.track(trackData);
            } else {
                this.presenceChannel.subscribe(async (status) => {
                    if (status === 'SUBSCRIBED') await this.presenceChannel?.track(trackData);
                });
            }
        } catch (error) { console.error('Presence tracking failed:', error); }
    }

    async updateActivity(status: string, activity?: string): Promise<void> {
        if (!this.currentUserId) return;
        const { data: { user } } = await this.supabase.auth.getUser();
        const username = user?.user_metadata?.username;

        if (this.presenceChannel && this.presenceChannel.state === 'joined') {
            await this.presenceChannel.track({
                user_id: this.currentUserId,
                username: username,
                status: status,
                activity: activity || 'No Menu',
                updated_at: new Date().toISOString()
            });
        }
        await this.supabase.from('user_presence').upsert({
            user_id: this.currentUserId,
            status: status,
            activity: activity || 'No Menu',
            last_seen: new Date().toISOString()
        }, { onConflict: 'user_id' });
    }

    async getPersistedPresence(userIds: string[]): Promise<Record<string, any>> {
        try {
            const { data } = await this.supabase.from('user_presence').select('*').in('user_id', userIds);
            const map: Record<string, any> = {};
            data?.forEach(p => { map[p.user_id] = p; });
            return map;
        } catch (error) { return {}; }
    }

    async sendMessage(recipientId: string, plaintext: string): Promise<any> {
        try {
            if (!this.currentUserId) throw new Error('Not authenticated');
            const recipientProfile = await this.getProfileById(recipientId);
            const recipientPublicKey = recipientProfile?.signed_pre_key;
            const { CryptoService } = await import('./CryptoService');
            const myKeys = await CryptoService.getPreKeys();

            let messageData: any;
            if (recipientPublicKey && myKeys?.privateKey) {
                const { ciphertext, nonce } = await CryptoService.encryptMessage(plaintext, recipientPublicKey, myKeys.privateKey);
                messageData = {
                    sender_id: this.currentUserId,
                    recipient_id: recipientId,
                    content: '[Encrypted]',
                    encrypted_content: ciphertext,
                    nonce: nonce,
                    encrypted: true
                };
            } else {
                messageData = {
                    sender_id: this.currentUserId,
                    recipient_id: recipientId,
                    content: plaintext,
                    encrypted: false
                };
            }
            const { data, error } = await this.supabase.from('messages').insert(messageData).select().single();
            if (error) throw error;
            return data;
        } catch (error) { throw error; }
    }

    async deleteMessage(messageId: string): Promise<void> {
        try {
            if (!this.currentUserId) throw new Error('Not authenticated');

            console.log(`🗑️ Executing Supabase delete for ${messageId}...`);

            const { error, count } = await this.supabase
                .from('messages')
                .delete({ count: 'exact' })
                .eq('id', messageId);

            if (error) {
                console.error('❌ Supabase delete error:', error);
                throw error;
            }

            console.log(`✅ Supabase delete completed. Count: ${count}`);

            if (count === 0) {
                console.warn('⚠️ Delete operation affected 0 rows (RLS blocking or already deleted).');
                throw new Error('Message could not be deleted on server (Permissão negada ou já deletado).');
            }
        } catch (error) {
            console.error('❌ Exception in deleteMessage:', error);
            throw error;
        }
    }

    subscribeToConversation(friendId: string, onMessage: (msg: any) => void, onDelete?: (msgId: string) => void) {
        if (!this.currentUserId) return;
        const channelName = `conversation:${[this.currentUserId, friendId].sort().join('-')}`;
        const decryptAndCallback = async (rawMsg: any) => {
            try {
                if (rawMsg.encrypted && rawMsg.encrypted_content && rawMsg.nonce) {
                    const { CryptoService } = await import('./CryptoService');
                    const myKeys = await CryptoService.getPreKeys();
                    const friendProfile = await this.getProfileById(friendId);
                    if (myKeys?.privateKey && friendProfile?.signed_pre_key) {
                        const decrypted = await CryptoService.decryptMessage(rawMsg.encrypted_content, rawMsg.nonce, friendProfile.signed_pre_key, myKeys.privateKey);
                        onMessage({ ...rawMsg, content: decrypted });
                        return;
                    }
                }
                onMessage(rawMsg);
            } catch (e) { onMessage({ ...rawMsg, content: '[Erro ao descriptografar]' }); }
        };

        const channel = this.supabase.channel(channelName)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `sender_id=eq.${friendId}` }, (payload) => {
                if ((payload.new as any).recipient_id === this.currentUserId) decryptAndCallback(payload.new);
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `sender_id=eq.${this.currentUserId}` }, (payload) => {
                if ((payload.new as any).recipient_id === friendId && (payload.new as any).read_at) onMessage(payload.new);
            })
            .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, (payload) => {
                if (onDelete) onDelete((payload.old as any).id);
            })
            .subscribe();
        return () => { channel.unsubscribe(); };
    }

    async sendTypingIndicator(friendId: string, isTyping: boolean) {
        if (!this.currentUserId) return;
        const channelName = `typing:${[this.currentUserId, friendId].sort().join('-')}`;
        const channel = this.supabase.channel(channelName, { config: { presence: { key: this.currentUserId } } });
        await channel.subscribe();
        await channel.track({ typing: isTyping, user_id: this.currentUserId, timestamp: Date.now() });
    }

    subscribeToTyping(friendId: string, onTyping: (isTyping: boolean) => void) {
        if (!this.currentUserId) return;
        const channelName = `typing:${[this.currentUserId, friendId].sort().join('-')}`;
        const channel = this.supabase.channel(channelName, { config: { presence: { key: this.currentUserId } } });
        channel.on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            const friendState = state[friendId];
            onTyping(friendState && (friendState[friendState.length - 1] as any).typing === true);
        });
        channel.subscribe();
        return () => { channel.unsubscribe(); };
    }

    async kickFromParty(partyId: string, userId: string): Promise<boolean> {
        console.log(`🔨 Attempting to kick user ${userId} from party ${partyId}...`);
        const { data, error } = await this.supabase.from('party_members').delete().match({ party_id: partyId, user_id: userId }).select();
        if (error) {
            console.error('❌ Kick failed with error:', error);
            return false;
        }
        if (!data || data.length === 0) {
            console.error('❌ Kick failed: No rows deleted (user may not be in party or RLS policy blocking)');
            return false;
        }
        console.log(`✅ Kick successful, deleted ${data.length} row(s):`, data);
        return true;
    }

    async sendPartyMessage(partyId: string, content: string): Promise<any> {
        if (!this.currentUserId) return;

        let finalContent = content;
        let encryptedContent: string | null = null;
        let nonce: string | null = null;
        let encrypted = false;

        if (this.currentPartyKey) {
            try {
                const { CryptoService } = await import('./CryptoService');
                const result = await CryptoService.encryptWithSymmetricKey(content, this.currentPartyKey);
                encryptedContent = result.ciphertext;
                nonce = result.nonce;
                finalContent = '[Encrypted Party Message]';
                encrypted = true;
            } catch (e) {
                console.error('Failed to encrypt party message:', e);
            }
        }

        const { data, error } = await this.supabase.from('party_messages').insert({
            party_id: partyId,
            sender_id: this.currentUserId,
            content: finalContent,
            encrypted_content: encryptedContent,
            nonce: nonce,
            encrypted: encrypted
        }).select().single();
        if (error) console.error('Error sending party message:', error);
        return data;
    }

    async getPartyMessages(partyId: string): Promise<any[]> {
        const { data } = await this.supabase.from('party_messages').select('id, content, encrypted_content, nonce, encrypted, created_at, sender_id, profiles:sender_id(username)').eq('party_id', partyId).order('created_at', { ascending: true });

        if (!data) return [];

        if (this.currentPartyKey) {
            try {
                const { CryptoService } = await import('./CryptoService');
                return await Promise.all(data.map(async (msg) => {
                    if (msg.encrypted && msg.encrypted_content && msg.nonce && this.currentPartyKey) {
                        try {
                            const decrypted = await CryptoService.decryptWithSymmetricKey(msg.encrypted_content, msg.nonce, this.currentPartyKey);
                            return { ...msg, content: decrypted };
                        } catch (e) { return { ...msg, content: '[Erro ao descriptografar]' }; }
                    }
                    return msg;
                }));
            } catch (e) { return data; }
        }

        return data || [];
    }

    subscribeToPartyMessages(partyId: string, onMessage: (msg: any) => void) {
        return this.supabase.channel(`party:${partyId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'party_messages', filter: `party_id=eq.${partyId}` }, async (payload) => {
            let msg = payload.new;
            if (msg.encrypted && msg.encrypted_content && msg.nonce && this.currentPartyKey) {
                try {
                    const { CryptoService } = await import('./CryptoService');
                    const decrypted = await CryptoService.decryptWithSymmetricKey(msg.encrypted_content, msg.nonce, this.currentPartyKey);
                    msg = { ...msg, content: decrypted };
                } catch (e) {
                    msg = { ...msg, content: '[Erro ao descriptografar]' };
                }
            }
            onMessage(msg);
        }).subscribe();
    }

    subscribeToMessages(onMessage: (msg: any) => void) {
        if (!this.currentUserId) return;
        return this.supabase.channel('messages_all_unread')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'messages',
                filter: `recipient_id=eq.${this.currentUserId}`
            }, (payload) => onMessage(payload.new))
            .subscribe();
    }
}

export default SupabaseService.getInstance();

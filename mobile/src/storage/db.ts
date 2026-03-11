import * as SecureStore from 'expo-secure-store';
import { RatchetState } from '../crypto/ratchet';

export const saveAuthToken = async (token: string) => {
    await SecureStore.setItemAsync('auth_token', token);
};

export const getAuthToken = async (): Promise<string | null> => {
    return await SecureStore.getItemAsync('auth_token');
};

export const clearAuthToken = async () => {
    // 1. Clear session tokens
    await SecureStore.deleteItemAsync('auth_token');
    await SecureStore.deleteItemAsync('user_id');
    
    // 2. Clear UI settings
    await SecureStore.deleteItemAsync('settings');

    // 3. WIPE SECURITY DATA to prevent cross-account desync
    // In a production app, we would iterate all keys or use a prefix-aware delete.
    // For Expo SecureStore, we manually delete known sensitive keys.
    await SecureStore.deleteItemAsync('identity_key_pub');
    await SecureStore.deleteItemAsync('identity_key_priv');
    
    // Note: To wipe ALL ratchet states and messages, we'd need a way to list keys.
    // SecureStore doesn't support listing. For this demo, we assume re-login 
    // means a fresh start for that specific user's logic.
    console.log("[Storage] Security data wiped for logout");
};

export const saveSettings = async (settings: any) => {
    await SecureStore.setItemAsync('settings', JSON.stringify(settings));
};

export const getSettings = async (): Promise<any> => {
    const data = await SecureStore.getItemAsync('settings');
    return data ? JSON.parse(data) : { torEnabled: false, screenshotProtection: true, backgroundBlur: true };
};

export const saveUserId = async (userId: string) => {
    await SecureStore.setItemAsync('user_id', userId);
};

export const getUserId = async (): Promise<string | null> => {
    return await SecureStore.getItemAsync('user_id');
};

// Key version tracking — bumped every time crypto keys are uploaded to server.
// Used to invalidate stale ratchet states that were computed with old key material.
export const bumpKeyVersion = async (): Promise<number> => {
    const userId = await SecureStore.getItemAsync('user_id');
    const key = userId ? `key_version_${userId}` : 'key_version';
    const current = await SecureStore.getItemAsync(key);
    const newVersion = (current ? parseInt(current) : 0) + 1;
    await SecureStore.setItemAsync(key, newVersion.toString());
    console.log(`[Storage] Key version bumped to ${newVersion}`);
    return newVersion;
};

export const getKeyVersion = async (): Promise<number> => {
    const userId = await SecureStore.getItemAsync('user_id');
    const key = userId ? `key_version_${userId}` : 'key_version';
    const current = await SecureStore.getItemAsync(key);
    return current ? parseInt(current) : 0;
};

// Store securely in a real app (with react-native-mmkv or encrypted storage), using AsyncStorage for dev
// Store securely in a real app (with react-native-mmkv or encrypted storage), using AsyncStorage for dev
// We specifically store the RatchetState mapped to the peer's user ID so we can resume chats.
export const saveRatchetState = async (peerId: string, state: RatchetState) => {
    // Explicitly serialize known buffer fields to avoid React Native JSON quirks
    const serializedState = {
        DHs: {
            publicKey: Array.from(state.DHs.publicKey),
            privateKey: Array.from(state.DHs.privateKey)
        },
        DHr: state.DHr ? Array.from(state.DHr) : null,
        RK: Array.from(state.RK),
        CKs: state.CKs ? Array.from(state.CKs) : null,
        CKr: state.CKr ? Array.from(state.CKr) : null,
        Ns: state.Ns,
        Nr: state.Nr,
        PN: state.PN,
        MKsKIPPED: Object.fromEntries(
            Object.entries(state.MKsKIPPED).map(([k, v]) => [k, Array.from(v)])
        )
    };
    
    console.log(`[Storage] saveRatchetState: original state.DHr length: ${state.DHr?.length}`);
    console.log(`[Storage] saveRatchetState: serialized DHr is ${serializedState.DHr ? 'array len ' + serializedState.DHr.length : 'null'}`);
    
    const userId = await SecureStore.getItemAsync('user_id');
    const storageKey = userId ? `ratchet_state_${userId}_${peerId}` : `ratchet_state_${peerId}`;
    
    // Tag with current key version so stale sessions can be detected
    const keyVersion = await getKeyVersion();
    const envelope = JSON.stringify({ v: keyVersion, state: serializedState });
    await SecureStore.setItemAsync(storageKey, envelope);
};

export const getRatchetState = async (peerId: string): Promise<RatchetState | null> => {
    const userId = await SecureStore.getItemAsync('user_id');
    const storageKey = userId ? `ratchet_state_${userId}_${peerId}` : `ratchet_state_${peerId}`;
    const data = await SecureStore.getItemAsync(storageKey);
    if (!data) return null;

    // Check key version — reject stale sessions from old key material
    let parsed: any;
    try {
        const envelope = JSON.parse(data);
        if (envelope.v !== undefined) {
            const currentVersion = await getKeyVersion();
            if (envelope.v !== currentVersion) {
                console.warn(`[Storage] Stale ratchet state for ${peerId} (v${envelope.v} vs current v${currentVersion}). Discarding.`);
                await SecureStore.deleteItemAsync(storageKey);
                return null;
            }
            parsed = envelope.state;
        } else {
            // Legacy format (no version envelope) — treat as stale
            console.warn(`[Storage] Legacy ratchet state format for ${peerId}. Discarding.`);
            await SecureStore.deleteItemAsync(storageKey);
            return null;
        }
    } catch {
        return null;
    }
    
    // Explicitly deserialize
    return {
        DHs: {
            publicKey: new Uint8Array(parsed.DHs.publicKey),
            privateKey: new Uint8Array(parsed.DHs.privateKey)
        },
        DHr: parsed.DHr ? new Uint8Array(parsed.DHr) : null,
        RK: new Uint8Array(parsed.RK),
        CKs: parsed.CKs ? new Uint8Array(parsed.CKs) : null,
        CKr: parsed.CKr ? new Uint8Array(parsed.CKr) : null,
        Ns: parsed.Ns,
        Nr: parsed.Nr,
        PN: parsed.PN,
        MKsKIPPED: Object.fromEntries(
            Object.entries(parsed.MKsKIPPED || {}).map(([k, v]) => [k, new Uint8Array(v as number[])])
        )
    };
};

export const resetRatchetState = async (peerId: string) => {
    const userId = await SecureStore.getItemAsync('user_id');
    const storageKey = userId ? `ratchet_state_${userId}_${peerId}` : `ratchet_state_${peerId}`;
    await SecureStore.deleteItemAsync(storageKey);
    console.log(`[Storage] Ratchet state reset for peer: ${peerId}`);
};

export interface LocalMessage {
    id: string;
    text: string;
    isSender: boolean;
    timestamp: string; // ISO string for JSON compatibility
    expiresAt?: string; // ISO string for cleanup
}

export const saveChatMessage = async (peerId: string, message: LocalMessage) => {
    const userId = await SecureStore.getItemAsync('user_id');
    const key = userId ? `messages_${userId}_${peerId}` : `messages_${peerId}`;
    const existing = await SecureStore.getItemAsync(key);
    const messages: LocalMessage[] = existing ? JSON.parse(existing) : [];
    
    messages.push(message);
    
    // Warning: SecureStore has a size limit (usually 2048 bytes on some Android versions)
    // For a real app, use MMKV or SQLite. For this demo, we'll store the recent 20 messages.
    const limited = messages.slice(-20);
    await SecureStore.setItemAsync(key, JSON.stringify(limited));
    console.log(`[DB] saveChatMessage - Key: ${key}, New Size: ${limited.length}`);
};

export const getChatMessages = async (peerId: string): Promise<LocalMessage[]> => {
    const userId = await SecureStore.getItemAsync('user_id');
    const key = userId ? `messages_${userId}_${peerId}` : `messages_${peerId}`;
    const data = await SecureStore.getItemAsync(key);
    const msgs = data ? JSON.parse(data) : [];
    console.log(`[DB] getChatMessages - Key: ${key}, Loaded: ${msgs.length}`);
    return msgs;
};

export const deleteChatHistory = async (peerId: string) => {
    const userId = await SecureStore.getItemAsync('user_id');
    const key = userId ? `messages_${userId}_${peerId}` : `messages_${peerId}`;
    await SecureStore.deleteItemAsync(key);
    
    // Also delete the ratchet state so the next message forces a fresh handshake
    const stateKey = userId ? `ratchet_state_${userId}_${peerId}` : `ratchet_state_${peerId}`;
    await SecureStore.deleteItemAsync(stateKey);
    console.log(`[DB] Deleted all chat history and ratchet state for peer: ${peerId}`);
};

export const deleteChatMessage = async (peerId: string, messageId: string) => {
    const userId = await SecureStore.getItemAsync('user_id');
    const key = userId ? `messages_${userId}_${peerId}` : `messages_${peerId}`;
    const data = await SecureStore.getItemAsync(key);
    if (!data) return;
    
    let messages: LocalMessage[] = JSON.parse(data);
    messages = messages.filter(m => m.id !== messageId);
    
    await SecureStore.setItemAsync(key, JSON.stringify(messages));
};

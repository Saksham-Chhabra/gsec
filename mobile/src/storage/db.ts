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

// Store securely in a real app (with react-native-mmkv or encrypted storage), using AsyncStorage for dev
// We specifically store the RatchetState mapped to the peer's user ID so we can resume chats.
export const saveRatchetState = async (peerId: string, state: RatchetState) => {
    // Ratchet state contains Uint8Arrays. We must serialize them to base64 or arrays before saving.
    // For simplicity of this module outline, we'll store JSON and assume the consumer maps it correctly,
    // or we build a proper replacer/reviver. We use `Buffer` or custom array conversion.
    // Given libsodium uses Uint8Array, we convert to standard arrays for JSON compatibility.
    
    // A production-grade implementation would have a robust encoding map here.
    const serialized = JSON.stringify(state, (key, value) => {
        if (value instanceof Uint8Array) {
            return { type: 'Uint8Array', data: Array.from(value) };
        }
        return value;
    });
    
    await SecureStore.setItemAsync(`ratchet_state_${peerId}`, serialized);
};

export const getRatchetState = async (peerId: string): Promise<RatchetState | null> => {
    const data = await SecureStore.getItemAsync(`ratchet_state_${peerId}`);
    if (!data) return null;

    const parsed = JSON.parse(data, (key, value) => {
        if (value && value.type === 'Uint8Array' && Array.isArray(value.data)) {
            return new Uint8Array(value.data);
        }
        return value;
    });
    
    return parsed as RatchetState;
};

export const resetRatchetState = async (peerId: string) => {
    await SecureStore.deleteItemAsync(`ratchet_state_${peerId}`);
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
    const key = `messages_${peerId}`;
    const existing = await SecureStore.getItemAsync(key);
    const messages: LocalMessage[] = existing ? JSON.parse(existing) : [];
    
    messages.push(message);
    
    // Warning: SecureStore has a size limit (usually 2048 bytes on some Android versions)
    // For a real app, use MMKV or SQLite. For this demo, we'll store the recent 20 messages.
    const limited = messages.slice(-20);
    await SecureStore.setItemAsync(key, JSON.stringify(limited));
};

export const getChatMessages = async (peerId: string): Promise<LocalMessage[]> => {
    const data = await SecureStore.getItemAsync(`messages_${peerId}`);
    return data ? JSON.parse(data) : [];
};

export const deleteChatMessage = async (peerId: string, messageId: string) => {
    const key = `messages_${peerId}`;
    const data = await SecureStore.getItemAsync(key);
    if (!data) return;
    
    let messages: LocalMessage[] = JSON.parse(data);
    messages = messages.filter(m => m.id !== messageId);
    
    await SecureStore.setItemAsync(key, JSON.stringify(messages));
};

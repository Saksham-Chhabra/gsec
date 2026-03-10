import axios from 'axios';
import { getAuthToken } from '../storage/db';
import * as SecureStore from 'expo-secure-store';

export const API_URL = 'http://172.20.10.8:3000/api'; // Physical Device local IPv4

export const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 5000, 
    headers: {
        'Content-Type': 'application/json'
    }
});

apiClient.interceptors.request.use(async (config) => {
    const token = await getAuthToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // TOR/Anonymous Mode Logic
    const settings = await SecureStore.getItemAsync('settings');
    if (settings) {
        const { torEnabled } = JSON.parse(settings);
        if (torEnabled) {
            console.log("[TOR] Routing request through anonymous tunnel...");
            config.headers['X-Anonymous-Mode'] = 'enabled';
            // In a real app, you would point Axios to a SOCKS proxy here
        }
    }

    return config;
});

export interface PeerUser {
    id: string;
    username: string;
    identityKeyPublic: string; // Base64 or Array representation
}

export const searchPeerUser = async (username: string): Promise<PeerUser | null> => {
    try {
        console.log(`[API] Searching for user: ${username} at ${API_URL}/users/search`);
        const response = await apiClient.get(`/users/search?username=${encodeURIComponent(username)}`);
        console.log(`[API] Search response:`, response.status);
        return response.data as PeerUser;
    } catch (e) {
        console.error("[API] Failed to find user:", e);
        return null;
    }
};

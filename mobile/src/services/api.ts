import axios from 'axios';
import { getAuthToken } from '../storage/db';
import * as SecureStore from 'expo-secure-store';

export const API_URL = 'http://172.20.10.8:3000/api'; // Physical Device local IPv4
const BASE_URL = 'http://172.20.10.8:3000'; // Without /api suffix

export const apiClient = axios.create({
    baseURL: API_URL,
    timeout: 5000, 
    headers: { 'Content-Type': 'application/json' }
});

apiClient.interceptors.request.use(async (config) => {
    const token = await getAuthToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

// ─────────────────────────────────────────────
//  Normal Mode APIs (direct, no Tor)
// ─────────────────────────────────────────────

export interface PeerUser {
    id: string;
    username: string;
    identityKeyPublic: string;
}

export const searchPeerUser = async (username: string): Promise<PeerUser[]> => {
    try {
        console.log(`[API] Searching for user: ${username}`);
        const response = await apiClient.get(`/users/search?username=${encodeURIComponent(username)}`);
        return response.data as PeerUser[];
    } catch (e) {
        console.error("[API] Failed to find user:", e);
        return [];
    }
};

export interface PeerKeys {
    identityKeyPublic: string;
    preKeyPublic: string;
}

export const getPeerKeys = async (userId: string): Promise<PeerKeys | null> => {
    try {
        console.log(`[API] Fetching async keys for user: ${userId}`);
        const response = await apiClient.get(`/users/${userId}/keys`);
        return response.data as PeerKeys;
    } catch (e) {
        console.error(`[API] Failed to fetch async keys for ${userId}:`, e);
        return null;
    }
};

// ─────────────────────────────────────────────
//  Friend System APIs (direct)
// ─────────────────────────────────────────────

export const sendFriendRequest = async (receiverUsername: string): Promise<boolean> => {
    try {
        await apiClient.post('/friends/request', { receiverUsername });
        return true;
    } catch (e: any) {
        console.error("[API] Send friend request failed:", e?.response?.data?.error || e);
        return false;
    }
};

export const getIncomingFriendRequests = async (): Promise<any[]> => {
    try {
        const response = await apiClient.get('/friends/requests/incoming');
        return response.data;
    } catch (e) {
        console.error("[API] Get incoming requests failed:", e);
        return [];
    }
};

export const respondToFriendRequest = async (requestId: string, action: 'accept' | 'reject'): Promise<boolean> => {
    try {
        await apiClient.post('/friends/request/respond', { requestId, action });
        return true;
    } catch (e) {
        console.error("[API] Respond to friend request failed:", e);
        return false;
    }
};

export const getFriendsList = async (): Promise<PeerUser[]> => {
    try {
        const response = await apiClient.get('/friends');
        return response.data as PeerUser[];
    } catch (e) {
        console.error("[API] Get friends list failed:", e);
        return [];
    }
};

// ─────────────────────────────────────────────
//  Anonymous Room APIs
// ─────────────────────────────────────────────

export const createAnonymousRoom = async (): Promise<{ roomId: string, password: string, myIdentity: string } | null> => {
    try {
        const response = await apiClient.post('/rooms/create');
        return response.data;
    } catch (e) {
        console.error("[API] Create anonymous room failed:", e);
        return null;
    }
};

export const joinAnonymousRoom = async (roomId: string, password: string): Promise<{ roomId: string, myIdentity: string, members: string[] } | null> => {
    try {
        const response = await apiClient.post('/rooms/join', { roomId, password });
        return response.data;
    } catch (e: any) {
        console.error("[API] Join anonymous room failed:", e?.message || e);
        throw new Error(e?.message || 'Failed to join room');
    }
};

export const leaveAnonymousRoom = async (roomId: string): Promise<boolean> => {
    try {
        await apiClient.post('/rooms/leave', { roomId });
        return true;
    } catch (e) {
        console.error("[API] Leave anonymous room failed:", e);
        return false;
    }
};

export const getAnonymousRoomDetails = async (roomId: string): Promise<{ roomId: string, members: string[] } | null> => {
    try {
        const response = await apiClient.get(`/rooms/${roomId}`);
        return response.data;
    } catch (e) {
        console.error("[API] Get anonymous room details failed:", e);
        return null;
    }
};

// HTTP long-polling for anonymous room messages
export const pollAnonymousMessages = async (roomId: string, since: number): Promise<any[]> => {
    try {
        const response = await apiClient.get(`/rooms/${roomId}/messages?since=${since}`);
        return response.data.messages || [];
    } catch (e) {
        console.error("[API] Poll anonymous messages failed:", e);
        return [];
    }
};

export const sendAnonymousMessage = async (roomId: string, text: string): Promise<boolean> => {
    try {
        await apiClient.post(`/rooms/${roomId}/message`, { text });
        return true;
    } catch (e) {
        console.error("[API] Send anonymous message failed:", e);
        return false;
    }
};




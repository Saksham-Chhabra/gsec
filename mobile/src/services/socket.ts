import { getAuthToken } from '../storage/db';
import { API_URL } from './api';

// Derived from API_URL (e.g. http://ip:port/api -> ws://ip:port)
const WS_URL = API_URL.replace('http://', 'ws://').replace('/api', '');

class WebSocketService {
    private ws: WebSocket | null = null;
    private messageListeners: Set<(payload: any) => void> = new Set();
    private reconnectTimer: any = null;
    private isConnecting = false;
    
    async connect() {
        if (this.isConnecting) return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

        this.isConnecting = true;
        const token = await getAuthToken();
        if (!token) {
            console.error("Cannot connect WebSocket: No auth token found");
            this.isConnecting = false;
            return;
        }

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        this.ws = new WebSocket(`${WS_URL}?token=${token}`);

        this.ws.onopen = () => {
            console.log("Connected to G-SEC WebSocket Server");
            this.isConnecting = false;
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log(`[Socket] Received: ${data.type} from ${data.senderId || 'unknown'}`);
                
                if (data.type === 'chat_message' || data.type === 'key_exchange' || data.type === 'key_exchange_response') {
                    this.messageListeners.forEach(listener => listener(data));
                }
            } catch (error) {
                console.error("Failed to parse incoming WS message", error);
            }
        };

        this.ws.onclose = (event) => {
            this.isConnecting = false;

            // If auth failed (4001), the token is invalid — don't retry forever
            if (event.code === 4001) {
                console.error(`WebSocket rejected: Token invalid or expired. Please re-login.`);
                // Clear the interval to avoid spam
                if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
                return;
            }

            console.log(`WebSocket Disconnected (Code: ${event.code}). Reconnecting in 5s...`);
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(), 5000);
        };
        
        this.ws.onerror = (e) => {
            console.error("WebSocket Error:", (e as any).message || e);
        };
    }

    sendChatMessage(recipientId: string, ciphertext: Uint8Array, header: any, timer: number = 0) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'chat_message',
                recipientId,
                ciphertext: Array.from(ciphertext), // Serialize to flat array for JSON
                header,
                timer
            }));
            return true;
        }
        return false;
    }

    sendHandshake(recipientId: string, payload: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                ...payload,
                recipientId
            }));
            return true;
        }
        return false;
    }

    addListener(callback: (payload: any) => void) {
        this.messageListeners.add(callback);
    }

    removeListener(callback: (payload: any) => void) {
        this.messageListeners.delete(callback);
    }
}

export const socketService = new WebSocketService();

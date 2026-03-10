import { getAuthToken } from '../storage/db';

// Adjust to match your Express machine IP
const WS_URL = 'ws://10.97.225.183:3000';  

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
                if (data.type === 'chat_message') {
                    // Route to UI / Ratchet engine
                    this.messageListeners.forEach(listener => listener(data));
                }
            } catch (error) {
                console.error("Failed to parse incoming WS message", error);
            }
        };

        this.ws.onclose = (event) => {
            this.isConnecting = false;
            console.log(`WebSocket Disconnected (Code: ${event.code}, Reason: ${event.reason}). Reconnecting in 5s...`);
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(), 5000); // Auto-reconnect
        };
        
        this.ws.onerror = (e) => {
            console.error("WebSocket Error:", (e as any).message || e);
        };
    }

    sendChatMessage(recipientId: string, ciphertext: Uint8Array, header: any) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({
                type: 'chat_message',
                recipientId,
                ciphertext: Array.from(ciphertext), // Serialize to flat array for JSON
                header
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

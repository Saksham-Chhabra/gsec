import { getAuthToken } from '../storage/db';
import { API_URL } from './api';

const WS_URL = API_URL.replace('http://', 'ws://').replace('/api', '');

class WebSocketService {
    private ws: WebSocket | null = null;
    private messageListeners: Set<(payload: any) => void> = new Set();
    private reconnectTimer: any = null;
    private isConnecting = false;
    private outboundQueue: string[] = []; // queued JSON payloads
    
    async connect() {
        if (this.isConnecting) return;
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;

        this.isConnecting = true;
        const token = await getAuthToken();
        if (!token) {
            console.error("Cannot connect WebSocket: No auth token");
            this.isConnecting = false;
            return;
        }

        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

        this.ws = new WebSocket(`${WS_URL}?token=${token}`);

        this.ws.onopen = () => {
            console.log("Connected to G-SEC WebSocket Server");
            this.isConnecting = false;
            this.flushQueue();
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                console.log(`[Socket] Received: ${data.type} from ${data.senderId || 'unknown'}`);
                if (data.type === 'chat_message' || data.type === 'anon_message') {
                    this.messageListeners.forEach(listener => listener(data));
                }
            } catch (error) {
                console.error("Failed to parse incoming WS message", error);
            }
        };

        this.ws.onclose = (event) => {
            this.isConnecting = false;
            if (event.code === 4001) {
                console.error(`WebSocket rejected: Token invalid. Please re-login.`);
                if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
                return;
            }
            console.log(`WebSocket Disconnected (Code: ${event.code}). Reconnecting in 3s...`);
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => this.connect(), 3000);
        };
        
        this.ws.onerror = (e) => {
            console.error("WebSocket Error:", (e as any).message || e);
        };
    }

    sendChatMessage(recipientId: string, ciphertext: Uint8Array, header: any, timer: number = 0): boolean {
        const payload = JSON.stringify({
            type: 'chat_message',
            recipientId,
            ciphertext: Array.from(ciphertext),
            header,
            timer
        });

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(payload);
            return true;
        }

        // Queue for later delivery
        console.log(`[Socket] WebSocket not open (state=${this.ws?.readyState}). Queuing message.`);
        this.outboundQueue.push(payload);
        // Try to reconnect
        this.connect();
        return false;
    }

    private flushQueue() {
        if (this.outboundQueue.length === 0) return;
        console.log(`[Socket] Flushing ${this.outboundQueue.length} queued messages`);
        const queue = [...this.outboundQueue];
        this.outboundQueue = [];
        for (const payload of queue) {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(payload);
            } else {
                this.outboundQueue.push(payload);
                break;
            }
        }
    }

    addListener(callback: (payload: any) => void) { this.messageListeners.add(callback); }
    removeListener(callback: (payload: any) => void) { this.messageListeners.delete(callback); }
}

export const socketService = new WebSocketService();

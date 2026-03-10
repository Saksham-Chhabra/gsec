import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { Types } from 'mongoose';
import { Session } from '../models/Session';
import { OfflineMessage } from '../models/OfflineMessage';

// Interface extending standard WebSocket with user data
interface AuthenticatedWebSocket extends WebSocket {
    userId?: string;
    deviceId?: string;
}

// Global active connections map (userId -> WS connection)
export const activeConnections = new Map<string, AuthenticatedWebSocket>();

export const setupWebSocket = (server: Server) => {
    const wss = new WebSocketServer({ server });

    wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
        // 1. Authenticate the connection via URL token
        const url = req.url || '';
        const token = url.includes('token=') ? url.split('token=')[1].split('&')[0] : null;

        if (!token) {
            ws.close(4001, 'Unauthorized: No token provided');
            return;
        }

        try {
            const session = await Session.findOne({ sessionToken: token, expiresAt: { $gt: new Date() } });
            if (!session) {
                ws.close(4001, 'Unauthorized: Invalid or expired token');
                return;
            }

            const userId = session.userId.toString();
            ws.userId = userId;
            ws.deviceId = session.deviceId;

            activeConnections.set(userId, ws);
            console.log(`User ${userId} connected via WebSocket`);

            // 1.5 Deliver offline messages
            const pendingMessages = await OfflineMessage.find({ recipientId: session.userId }).sort({ createdAt: 1 });
            if (pendingMessages.length > 0) {
                console.log(`Delivering ${pendingMessages.length} offline messages to ${userId}`);
                for (const msg of pendingMessages) {
                    const payload = JSON.parse(msg.encryptedPayload);
                    ws.send(JSON.stringify({
                        ...payload,
                        senderId: msg.senderId.toString(),
                        isOffline: true
                    }));
                }
                // Clear the queue after delivery
                await OfflineMessage.deleteMany({ _id: { $in: pendingMessages.map(m => m._id) } });
            }

            // 2. Handle incoming real-time messages
            ws.on('message', async (data: string) => {
                try {
                    const messageString = data.toString();
                    const payload = JSON.parse(messageString);
                    
                    // Route P2P message based on payload.recipientId
                    const p2pTypes = ['chat_message', 'key_exchange', 'key_exchange_response'];
                    if (p2pTypes.includes(payload.type) && payload.recipientId) {
                        const recipientWs = activeConnections.get(payload.recipientId);

                        if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                            // Relay strictly as-is to recipient
                            recipientWs.send(JSON.stringify({
                                ...payload,
                                senderId: ws.userId
                            }));
                        } else {
                            // Recipient is offline, dump encrypted ciphertext directly to MongoDB queue
                            if (ws.userId) {
                                await OfflineMessage.create({
                                    recipientId: new Types.ObjectId(payload.recipientId as string),
                                    senderId: new Types.ObjectId(ws.userId as string),
                                    encryptedPayload: JSON.stringify({ 
                                        type: payload.type,
                                        ciphertext: payload.ciphertext, 
                                        header: payload.header 
                                    })
                                } as any);
                            }
                        }
                    }
                } catch (error) {
                    console.error('Failed to process socket message', error);
                }
            });

            ws.on('close', () => {
                if (ws.userId) {
                    activeConnections.delete(ws.userId);
                    console.log(`User ${ws.userId} disconnected`);
                }
            });
            
            ws.on('error', (err) => {
                console.error(`WebSocket error for user ${ws.userId}`, err);
            });

        } catch (error) {
            ws.close(5000, 'Internal Server Error');
        }
    });

    return wss;
};

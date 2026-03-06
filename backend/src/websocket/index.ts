import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

export const setupWebSocket = (server: Server) => {
    const wss = new WebSocketServer({ server });

    wss.on('connection', (ws: WebSocket) => {
        console.log('New WebSocket connection established');

        ws.on('message', (message: string) => {
            console.log('Received message:', message);
            // Handle signaling and message relaying here
        });

        ws.on('close', () => {
            console.log('WebSocket connection closed');
        });
    });

    return wss;
};

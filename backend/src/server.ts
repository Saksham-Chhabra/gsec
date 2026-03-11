import dotenv from 'dotenv';
import http from 'http';
import app from './app';
import { connectDB } from './config/db';
import { setupWebSocket } from './websocket';
import { startRoomCleanupJob } from './cron/roomCleanup';

dotenv.config();

const port = process.env.PORT || 3000;

// Connect to MongoDB
connectDB();

// Start background workers
startRoomCleanupJob();

const server = http.createServer(app);

// Setup WebSocket server
setupWebSocket(server);

server.listen(port as number, '0.0.0.0', () => {
    console.log(`P2P Signaling Server running on port ${port} (0.0.0.0)`);
});

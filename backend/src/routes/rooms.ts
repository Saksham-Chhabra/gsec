import { Router, Request, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { Room } from '../models/Room';
import rateLimit from 'express-rate-limit';
import crypto from 'crypto';
import argon2 from 'argon2';

const router = Router();

// Rate limiter for joining rooms to prevent brute-forcing short passwords
const joinRoomLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 5, // Limit each IP to 5 join attempts per minute
    message: { error: 'Too many join attempts. Please try again after a minute.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Helper to generate a short 6-char ID (uppercase + numbers)
const generateRoomId = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Helper to generate a random 5-char password
const generatePassword = (): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 5; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
};

// Array of random anonymous codenames
const ANONYMOUS_NAMES = [
    'ShadowFox', 'GhostNode', 'NightCipher', 'SilentAgent',
    'DarkMatter', 'NeonSpectre', 'VoidWalker', 'CyberNinja',
    'PhantomLink', 'RogueProtocol'
];

const getRandomIdentity = (): string => {
    return ANONYMOUS_NAMES[Math.floor(Math.random() * ANONYMOUS_NAMES.length)] + '-' + Math.floor(Math.random() * 1000);
};

// POST /api/rooms/create
// Creates a new anonymous room and returns the plaintext credentials
router.post('/create', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        let roomId = generateRoomId();
        // Ensure collision safety (highly unlikely but standard practice)
        while (await Room.findOne({ roomId })) {
            roomId = generateRoomId();
        }

        const plaintextPassword = generatePassword();
        const passwordHash = await argon2.hash(plaintextPassword);
        const creatorIdentity = getRandomIdentity();

        const room = new Room({
            roomId,
            passwordHash,
            createdBy: userId,
            members: [{
                userId,
                anonymousId: creatorIdentity
            }]
        });

        await room.save();

        res.status(201).json({
            roomId,
            password: plaintextPassword, // ONLY sent once!
            myIdentity: creatorIdentity
        });
    } catch (error) {
        console.error('Create room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/rooms/join
// Joins an existing room using ID and Password
router.post('/join', joinRoomLimiter, requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { roomId, password } = req.body;
        if (!roomId || !password) {
            res.status(400).json({ error: 'Room ID and Password are required' });
            return;
        }

        const room = await Room.findOne({ roomId: roomId.toUpperCase() });
        if (!room) {
            res.status(404).json({ error: 'Invalid room ID or password' });
            return;
        }

        if (room.status === 'expired') {
            res.status(403).json({ error: 'This room has expired' });
            return;
        }

        const isMatch = await argon2.verify(room.passwordHash, password);
        if (!isMatch) {
            res.status(404).json({ error: 'Invalid room ID or password' });
            return;
        }

        if (room.members.length >= room.maxMembers) {
            // Check if user is already in it, otherwise block
            const existingMember = room.members.find(m => m.userId.toString() === userId);
            if (!existingMember) {
                res.status(403).json({ error: 'Room is full' });
                return;
            }
        }

        // Add user if not already inside
        const existingMember = room.members.find(m => m.userId.toString() === userId);
        let myIdentity = existingMember?.anonymousId;

        if (!existingMember) {
            myIdentity = getRandomIdentity();
            // Ensure identity uniqueness in this specific room
            while (room.members.some(m => m.anonymousId === myIdentity)) {
                myIdentity = getRandomIdentity();
            }

            room.members.push({ userId: userId as any, anonymousId: myIdentity });
            room.status = 'active'; // Wake room up if idle
            await room.save();
        }

        // Return room details without exposing other real userIds
        const maskedMembers = room.members.map(m => m.anonymousId);

        res.status(200).json({
            roomId: room.roomId,
            myIdentity,
            members: maskedMembers
        });
    } catch (error) {
        console.error('Join room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/rooms/leave
// Leaves the given room
router.post('/leave', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const { roomId } = req.body;
        if (!roomId) {
            res.status(400).json({ error: 'Room ID is required' });
            return;
        }

        const room = await Room.findOne({ roomId });
        if (!room) {
            res.status(404).json({ error: 'Room not found' });
            return;
        }

        room.members = room.members.filter(m => m.userId.toString() !== userId);
        
        if (room.members.length === 0) {
            room.status = 'idle';
        }

        await room.save(); // pre-save hook updates lastActivityAt

        res.status(200).json({ message: 'Left room' });
    } catch (error) {
        console.error('Leave room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/rooms/:id
// Get active room state (masked)
router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const roomId = req.params.id;
        const room = await Room.findOne({ roomId });

        if (!room || room.status === 'expired') {
            res.status(404).json({ error: 'Room not found or expired' });
            return;
        }

        // Ensure user is actually in this room
        const isMember = room.members.some(m => m.userId.toString() === userId);
        if (!isMember) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }

        const maskedMembers = room.members.map(m => m.anonymousId);

        res.status(200).json({
            roomId: room.roomId,
            members: maskedMembers
        });
    } catch (error) {
        console.error('Get room error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ─────────────────────────────────────────────
// Anonymous Room Messages (in-memory, ephemeral)
// Used for HTTP long-polling through Tor
// ─────────────────────────────────────────────
interface AnonMessage {
    id: number;
    senderId: string;     // anonymous identity
    text: string;
    timestamp: number;    // Date.now()
}

const roomMessages: Map<string, AnonMessage[]> = new Map();
let messageCounter = 0;

// POST /api/rooms/:id/message — send an anonymous message
router.post('/:id/message', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const roomId = req.params.id;
        const { text } = req.body;
        if (!text) { res.status(400).json({ error: 'Text is required' }); return; }

        const room = await Room.findOne({ roomId });
        if (!room || room.status === 'expired') {
            res.status(404).json({ error: 'Room not found or expired' });
            return;
        }

        const member = room.members.find(m => m.userId.toString() === userId);
        if (!member) {
            res.status(403).json({ error: 'Not a member of this room' });
            return;
        }

        // Update activity
        room.lastActivityAt = new Date();
        room.status = 'active';
        await room.save();

        const msg: AnonMessage = {
            id: ++messageCounter,
            senderId: member.anonymousId,
            text,
            timestamp: Date.now()
        };

        if (!roomMessages.has(roomId)) roomMessages.set(roomId, []);
        const msgs = roomMessages.get(roomId)!;
        msgs.push(msg);

        // Keep only last 200 messages per room
        if (msgs.length > 200) msgs.splice(0, msgs.length - 200);

        res.status(200).json({ message: msg });
    } catch (error) {
        console.error('Send anon message error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/rooms/:id/messages?since=<timestamp> — poll for new messages
router.get('/:id/messages', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const roomId = req.params.id;
        const since = parseInt(req.query.since as string) || 0;

        const room = await Room.findOne({ roomId });
        if (!room || room.status === 'expired') {
            res.status(404).json({ error: 'Room not found or expired' });
            return;
        }

        const member = room.members.find(m => m.userId.toString() === userId);
        if (!member) {
            res.status(403).json({ error: 'Not a member of this room' });
            return;
        }

        const msgs = roomMessages.get(roomId) || [];
        const newMsgs = msgs.filter(m => m.timestamp > since);

        res.status(200).json({ messages: newMsgs });
    } catch (error) {
        console.error('Poll anon messages error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

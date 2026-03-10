import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { Types } from 'mongoose';
import { OfflineMessage } from '../models/OfflineMessage';

// Exposes pending ciphertexts when a user comes online
export const getOfflineMessages = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Fetch all offline messages targeted at this user, sorted by oldest first to maintain Ratchet integrity
        const messages = await OfflineMessage.find({ recipientId: userId } as any).sort({ createdAt: 1 });
        
        res.status(200).json({ messages });
        
        // Wipe messages from database immediately after successful fetch to ensure ephemeral secrecy and avoid replays
        // In a perfectly robust system we'd await client acknowledgments, but standard Signal wipes instantly upon delivery.
        if (messages.length > 0) {
            await OfflineMessage.deleteMany({ _id: { $in: messages.map(m => m._id) } });
        }

    } catch (error) {
        console.error('Error fetching offline messages:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

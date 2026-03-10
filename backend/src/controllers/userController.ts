import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';

// Search for a user by their exact username to initiate a chat
export const searchUser = async (req: AuthRequest, res: Response) => {
    try {
        const { username } = req.query;

        if (!username || typeof username !== 'string') {
            return res.status(400).json({ error: 'Username query parameter is required' });
        }

        // Exact match required for P2P discovery
        const targetUser = await User.findOne({ username });

        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Return strictly the needed payloads for Double Ratchet initialization
        res.status(200).json({
            id: targetUser._id,
            username: targetUser.username,
            identityKeyPublic: targetUser.identityKeyPublic
        });

    } catch (error) {
        console.error('Error in user discovery:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

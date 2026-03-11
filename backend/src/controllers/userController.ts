import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { User } from '../models/User';

// Search for a user by exact username (returns array for frontend compatibility)
export const searchUser = async (req: AuthRequest, res: Response) => {
    try {
        const { username } = req.query;
        const currentUserId = req.user?.id;

        if (!username || typeof username !== 'string' || username.trim().length === 0) {
            return res.status(400).json({ error: 'Username query parameter is required' });
        }

        // Exact match, case insensitive, exclude the requesting user
        const targetUser = await User.findOne({
            username: { $regex: `^${username.trim()}$`, $options: 'i' },
            ...(currentUserId ? { _id: { $ne: currentUserId } } : {})
        }).select('username identityKeyPublic');

        if (!targetUser) {
            return res.status(200).json([]);
        }

        res.status(200).json([{
            id: targetUser._id,
            username: targetUser.username,
            identityKeyPublic: targetUser.identityKeyPublic,
            preKeyPublic: targetUser.preKeyPublic
        }]);

    } catch (error) {
        console.error('Error in user discovery:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Fetch cryptographic identity bundle for a specific user ID
export const getUserKeys = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.params.id;
        
        const targetUser = await User.findById(userId).select('identityKeyPublic preKeyPublic');
        
        if (!targetUser) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            identityKeyPublic: targetUser.identityKeyPublic,
            preKeyPublic: targetUser.preKeyPublic
        });
    } catch (error) {
        console.error('Error fetching user keys:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

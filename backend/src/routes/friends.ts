import { Router, Request, Response } from 'express';
import { User } from '../models/User';
import { FriendRequest } from '../models/FriendRequest';
import { Friendship } from '../models/Friendship';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/friends/request
// Send a friend request
router.post('/request', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const senderId = req.user?.id;
        if (!senderId) { res.status(401).json({ error: 'Unauthorized' }); return; }
        const { receiverUsername } = req.body;

        if (!receiverUsername) {
            res.status(400).json({ error: 'receiverUsername is required' });
            return;
        }

        const receiver = await User.findOne({ username: receiverUsername });
        if (!receiver) {
            res.status(404).json({ error: 'User not found' });
            return;
        }

        if (senderId === receiver._id.toString()) {
            res.status(400).json({ error: 'Cannot send friend request to yourself' });
            return;
        }

        // Check if already friends
        const aId = senderId < receiver._id.toString() ? senderId : receiver._id.toString();
        const bId = senderId < receiver._id.toString() ? receiver._id.toString() : senderId;
        
        const existingFriendship = await Friendship.findOne({ userA: aId, userB: bId });
        if (existingFriendship) {
            res.status(400).json({ error: 'Already friends' });
            return;
        }

        // Check if a request already exists in either direction
        const existingRequest = await FriendRequest.findOne({
            $or: [
                { senderId, receiverId: receiver._id },
                { senderId: receiver._id, receiverId: senderId }
            ]
        });

        if (existingRequest) {
            res.status(400).json({ error: 'Friend request already exists or is pending' });
            return;
        }

        const newRequest = new FriendRequest({
            senderId,
            receiverId: receiver._id,
            status: 'pending'
        });

        await newRequest.save();

        // Optional: Trigger websocket event here if using Socket.IO from HTTP context
        // ...

        res.status(201).json({ message: 'Friend request sent successfully' });
    } catch (error) {
        console.error('Send friend request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/friends/requests/incoming
// Fetch pending friend requests
router.get('/requests/incoming', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
        
        const requests = await FriendRequest.find({ receiverId: userId, status: 'pending' })
            .populate('senderId', 'username identityKeyPublic')
            .sort({ createdAt: -1 });

        const formattedRequests = requests.map((req: any) => ({
            id: req._id,
            senderId: req.senderId._id,
            senderUsername: req.senderId.username,
            senderIdentityKey: req.senderId.identityKeyPublic,
            createdAt: req.createdAt
        }));

        res.json(formattedRequests);
    } catch (error) {
        console.error('Fetch incoming requests error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/friends/request/respond
// Accept or reject a friend request
router.post('/request/respond', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
        const { requestId, action } = req.body; // action: 'accept' | 'reject'

        if (!requestId || !['accept', 'reject'].includes(action)) {
            res.status(400).json({ error: 'requestId and valid action (accept/reject) are required' });
            return;
        }

        const friendRequest = await FriendRequest.findOne({ _id: requestId, receiverId: userId, status: 'pending' });
        
        if (!friendRequest) {
            res.status(404).json({ error: 'Friend request not found or not pending' });
            return;
        }

        if (action === 'reject') {
            friendRequest.status = 'rejected';
            await friendRequest.save();
            res.json({ message: 'Friend request rejected' });
            return;
        }

        // Action is 'accept'
        friendRequest.status = 'accepted';
        await friendRequest.save();

        // Create the Friendship document
        const senderIdStr = friendRequest.senderId.toString();
        const aId = senderIdStr < userId ? senderIdStr : userId;
        const bId = senderIdStr < userId ? userId : senderIdStr;

        const existingFriendship = await Friendship.findOne({ userA: aId, userB: bId });
        if (!existingFriendship) {
            const newFriendship = new Friendship({
                userA: aId,
                userB: bId
            });
            await newFriendship.save();
        }

        res.json({ message: 'Friend request accepted and friendship created' });
    } catch (error) {
        console.error('Respond to friend request error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/friends
// Fetch all accepted friends
router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

        const friendships = await Friendship.find({
            $or: [{ userA: userId }, { userB: userId }]
        });

        if (friendships.length === 0) {
            res.json([]);
            return;
        }

        // Get the IDs of the friends
        const friendIds = friendships.map(f => 
            f.userA.toString() === userId ? f.userB : f.userA
        );

        const friendsData = await User.find(
            { _id: { $in: friendIds } },
            'username identityKeyPublic'
        );

        const formattedFriends = friendsData.map(friend => ({
            id: friend._id,
            username: friend.username,
            identityKeyPublic: friend.identityKeyPublic,
            // You could potentially mix in online status here from a Redis store
            // if you have it available, or handle it via WebSocket.
        }));

        res.json(formattedFriends);
    } catch (error) {
        console.error('Fetch friends error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;

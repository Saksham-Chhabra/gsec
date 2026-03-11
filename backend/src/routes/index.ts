import { Router } from 'express';
import authRoutes from './auth';
import messageRoutes from './message';
import userRoutes from './user';
import friendsRoutes from './friends';
import roomsRoutes from './rooms';

const router = Router();

router.use('/auth', authRoutes);
router.use('/messages', messageRoutes);
router.use('/users', userRoutes);
router.use('/friends', friendsRoutes);
router.use('/rooms', roomsRoutes);

// Placeholder for future endpoints
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'g-sec-signaling' });
});

export default router;

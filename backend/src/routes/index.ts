import { Router } from 'express';
import authRoutes from './auth';

const router = Router();

router.use('/auth', authRoutes);

// Placeholder for future endpoints
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'g-sec-signaling' });
});

export default router;

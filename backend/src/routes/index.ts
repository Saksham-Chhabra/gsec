import { Router } from 'express';

const router = Router();

// Placeholder for future endpoints
// routes will map to controllers here
router.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', service: 'g-sec-signaling' });
});

export default router;

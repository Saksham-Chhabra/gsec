import { Router } from 'express';
import { getOfflineMessages } from '../controllers/messageController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Retrieve unread encrypted payloads
router.get('/offline', requireAuth, getOfflineMessages);

export default router;

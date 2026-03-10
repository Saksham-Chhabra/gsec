import { Router } from 'express';
import { searchUser } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Discover peer public keys
router.get('/search', requireAuth, searchUser);

export default router;

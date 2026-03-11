import { Router } from 'express';
import { searchUser, getUserKeys } from '../controllers/userController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Discover peer public keys
router.get('/search', requireAuth, searchUser);

// Explicitly fetch cryptographic keys for a known user ID
router.get('/:id/keys', requireAuth, getUserKeys);

export default router;

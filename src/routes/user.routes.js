import { Router } from 'express';
import { authenticateJwt } from '../middlewares/authJwt.js';
import { me, updateProfile } from '../controllers/user.controller.js';

const router = Router();

router.get('/me', authenticateJwt, me);
router.put('/me/update', authenticateJwt, updateProfile);

export default router;

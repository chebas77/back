import { Router } from 'express';
import { authenticateJwt } from '../middlewares/authJwt.js';
import { me } from '../controllers/user.controller.js';

const router = Router();

router.get('/me', authenticateJwt, me);

export default router;

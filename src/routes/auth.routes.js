import { Router } from 'express';
import passport from '../config/passport.js';
import { handleAuthSuccess, logout } from '../controllers/auth.controller.js';

const router = Router();

// Iniciar OAuth
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// Callback de Google
router.get('/google/callback',
  passport.authenticate('google', { failureRedirect: '/auth/failure', session: false }),
  handleAuthSuccess
);

router.get('/debug/env', (req, res) => {
  res.json({
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'OK' : 'MISSING',
    GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
  });
});

router.get('/failure', (req, res) => res.status(401).json({ error: 'Google auth failed' }));
router.post('/logout', logout);

export default router;

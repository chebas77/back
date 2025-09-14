import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

export function signUserJwt(payload) {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

export function authenticateJwt(req, res, next) {
  const token = req.cookies?.[config.cookie.name] || req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

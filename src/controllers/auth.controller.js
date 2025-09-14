import { config } from '../config/env.js';
import { signUserJwt } from '../middlewares/authJwt.js';

export function handleAuthSuccess(req, res) {
  // Viene de Passport: req.user = perfil normalizado del modelo
  const { id, name, email, avatar } = req.user;

  // Generar JWT
  const token = signUserJwt({ sub: id, name, email, avatar });

  // Setear cookie httpOnly
  res.cookie(config.cookie.name, token, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: '/',
  });

  // Redirigir al front (ej: dashboard)
  const redirectTo = `${config.frontendUrl}/dashboard`;
  return res.redirect(302, redirectTo);
}

export function logout(req, res) {
  res.clearCookie(config.cookie.name, {
    domain: config.cookie.domain,
    path: '/',
  });
  return res.status(200).json({ ok: true });
}

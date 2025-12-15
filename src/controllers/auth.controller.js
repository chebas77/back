import { config } from '../config/env.js';
import { signUserJwt } from '../middlewares/authJwt.js';

export function handleAuthSuccess(req, res) {
  // Viene de Passport: req.user = perfil normalizado del modelo
  const { id, name, email, avatar } = req.user;

  // Generar JWT
  const token = signUserJwt({ sub: id, name, email, avatar });

  // Setear cookie httpOnly (sin domain para que funcione cross-domain)
  res.cookie(config.cookie.name, token, {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
    path: '/',
  });

  // Redirigir al front con el token en la URL (fallback para cuando la cookie no funciona)
  const redirectTo = `${config.frontendUrl}/app?token=${encodeURIComponent(token)}`;
  return res.redirect(302, redirectTo);
}

export function logout(req, res) {
  res.clearCookie(config.cookie.name, {
    path: '/',
  });
  return res.status(200).json({ ok: true });
}

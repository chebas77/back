// src/middlewares/requireAuth.js
import { verifyToken } from "../utils/jwt.js";

export function requireAuth(req, res, next) {
  const cookieToken = req.cookies?.token;
  const header = req.headers.authorization;
  const headerToken = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const token = cookieToken || headerToken;

  // Logs de diagnóstico (no imprimas el secreto)
  console.group("[AUTH] requireAuth");
  console.log("cookies:", req.cookies);
  console.log("auth header:", req.headers.authorization);
  console.log("token usado:", token ? token.slice(0, 24) + "..." : null);
  console.groupEnd();

  if (!token) return res.status(401).json({ ok: false, error: "No token" });

  try {
    const payload = verifyToken(token);
    req.user = { id: payload.sub, email: payload.email, name: payload.name };
    return next();
  } catch (err) {
    console.error("[AUTH] verify error:", err.message);
    return res.status(401).json({ ok: false, error: "Invalid token" });
  }
}

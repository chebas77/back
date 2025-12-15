import { pool } from '../config/db.js';
import { signToken } from '../utils/jwt.js';
import { config } from '../config/env.js';

export function me(req, res) {
  // req.user viene del middleware JWT (sub, name, email)
  return res.json({ user: req.user });
}

export async function updateProfile(req, res) {
  try {
    const userId = req.user.id;
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'El nombre es requerido' });
    }

    await pool.query(
      'UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?',
      [name.trim(), userId]
    );

    const [rows] = await pool.query(
      'SELECT id, name, email, created_at FROM users WHERE id = ?',
      [userId]
    );

    const updatedUser = rows[0];

    // Regenerar token con el nuevo nombre
    const newToken = signToken(updatedUser);

    // Actualizar cookie con el nuevo token
    res.cookie(config.cookie.name, newToken, {
      httpOnly: true,
      secure: config.cookie.secure,
      sameSite: config.cookie.sameSite,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 días
      domain: config.cookie.domain,
    });

    return res.json({ ok: true, user: updatedUser });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    return res.status(500).json({ error: 'Error al actualizar perfil' });
  }
}

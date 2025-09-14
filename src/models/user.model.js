import { pool } from '../config/db.js';
import bcrypt from 'bcrypt';

const DB = '`alignment manager`'; // usa backticks por el espacio
const TABLE = `${DB}.users`;

// Utilidad: crea un hash dummy para cuentas OAuth (no se usará para login local)
async function createDummyHash() {
  // puedes meter una cadena fija o aleatoria
  return bcrypt.hash('oauth_google_only', 10);
}

export async function findUserByEmail(email) {
  const [rows] = await pool.query(
    `SELECT id, name, email, password_hash, created_at FROM ${TABLE} WHERE email = ? LIMIT 1`,
    [email]
  );
  return rows[0] || null;
}

export async function findUserById(id) {
  const [rows] = await pool.query(
    `SELECT id, name, email, password_hash, created_at FROM ${TABLE} WHERE id = ? LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

export async function createUserWithEmail({ name, email, passwordHash }) {
  const [result] = await pool.query(
    `INSERT INTO ${TABLE} (name, email, password_hash) VALUES (?, ?, ?)`,
    [name || null, email, passwordHash]
  );
  return findUserById(result.insertId);
}

// Para Google OAuth: usa email como identidad única
export async function findOrCreateByGoogleProfile({ name, email }) {
  if (!email) throw new Error('Google profile has no email');
  const existing = await findUserByEmail(email);
  if (existing) return existing;

  const passwordHash = await createDummyHash();
  return createUserWithEmail({ name, email, passwordHash });
}

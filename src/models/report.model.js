import { pool } from "../config/db.js";

export async function createReport({
  userId, method, title, description, equipmentId, dims, indicators, results, sag
}) {
  const [r] = await pool.query(
    `INSERT INTO alignment_reports
     (user_id, method, title, description, equipment_id, dims, indicators, results, sag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [userId, method, title, description, equipmentId,
     JSON.stringify(dims), JSON.stringify(indicators), JSON.stringify(results), sag]
  );
  return r.insertId;
}

export async function findReportById(id, userId) {
  const [rows] = await pool.query(
    `SELECT * FROM alignment_reports WHERE id=? AND user_id=?`, [id, userId]
  );
  return rows[0] || null;
}
export async function getReportsByUser(userId) {
  const [rows] = await pool.query(
    `SELECT id, user_id, title, description, created_at
     FROM alignment_reports
     WHERE user_id = ?
     ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
}

export async function listReportsByUser(userId, limit = 100) {
  const [rows] = await pool.query(
    `SELECT id, title, equipment_id, created_at
     FROM alignment_reports
     WHERE user_id=? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows;
}


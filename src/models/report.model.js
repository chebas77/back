import { pool } from "../config/db.js";
export async function createReport({
  userId,
  method,
  title,
  description,
  equipmentId,
  dims,
  indicators,
  results,
  sag,
  projectId = null,
}) {
  const normalizedProjectId = Number.isInteger(projectId) ? projectId : null;
  const [r] = await pool.query(
    `INSERT INTO alignment_reports
     (user_id, project_id, method, title, description, equipment_id, dims, indicators, results, sag)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      normalizedProjectId,
      method,
      title,
      description,
      equipmentId,
      JSON.stringify(dims),
      JSON.stringify(indicators),
      JSON.stringify(results),
      sag,
    ]
  );
  return r.insertId;
}

export async function findReportById(id, userId) {
  const [rows] = await pool.query(
    `SELECT * FROM alignment_reports WHERE id=? AND user_id=?`, [id, userId]
  );

  if (rows.length === 0) return null;

  // MySQL devuelve JSON como objetos, no necesita parse
  const report = rows[0];
  
  // Solo parsear si son strings (por compatibilidad)
  if (typeof report.dims === 'string') report.dims = JSON.parse(report.dims || "{}");
  if (typeof report.indicators === 'string') report.indicators = JSON.parse(report.indicators || "{}");
  if (typeof report.results === 'string') report.results = JSON.parse(report.results || "{}");

  return report;
}

export async function getReportsByUser(userId) {
  const [rows] = await pool.query(
    `SELECT r.id, r.user_id, r.project_id, r.method, r.title, r.description, r.created_at, r.dims, r.indicators, r.results, r.sag,
            u.name AS user_name, u.email AS user_email
     FROM alignment_reports r
     LEFT JOIN users u ON r.user_id = u.id
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC`,
    [userId]
  );

  // Parsear solo si son strings (compatibilidad)
  const reports = rows.map((report) => {
    if (typeof report.dims === 'string') report.dims = JSON.parse(report.dims || "{}");
    if (typeof report.indicators === 'string') report.indicators = JSON.parse(report.indicators || "{}");
    if (typeof report.results === 'string') report.results = JSON.parse(report.results || "{}");
    return report;
  });

  return reports;
}

export async function listReportsByUser(userId, limit = 100) {
  const [rows] = await pool.query(
    `SELECT id, title, equipment_id, project_id, created_at
     FROM alignment_reports
     WHERE user_id=? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows;
}

export async function updateReport({
  reportId,
  userId,
  title,
  description,
  equipmentId,
  dims,
  indicators,
  results,
  sag,
  projectId,
}) {
  const normalizedProjectId = Number.isInteger(projectId) ? projectId : null;
  
  await pool.query(
    `UPDATE alignment_reports
     SET title = ?, description = ?, equipment_id = ?, dims = ?, indicators = ?, results = ?, sag = ?, project_id = ?, updated_at = NOW()
     WHERE id = ? AND user_id = ?`,
    [
      title,
      description,
      equipmentId,
      JSON.stringify(dims),
      JSON.stringify(indicators),
      JSON.stringify(results),
      sag,
      normalizedProjectId,
      reportId,
      userId,
    ]
  );

  return findReportById(reportId, userId);
}

export async function deleteReport(reportId, userId) {
  const [result] = await pool.query(
    `DELETE FROM alignment_reports WHERE id = ? AND user_id = ?`,
    [reportId, userId]
  );
  
  return result.affectedRows > 0;
}

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

  if (rows.length === 0) return null;

  // Deserializar los campos JSON
  const report = rows[0];
  report.dims = JSON.parse(report.dims || "{}");
  report.indicators = JSON.parse(report.indicators || "{}");
  report.results = JSON.parse(report.results || "{}");

  return report;
}

export async function getReportsByUser(userId) {
  const [rows] = await pool.query(
    `SELECT r.id, r.user_id, r.title, r.description, r.created_at, r.dims, r.indicators, r.results, r.sag,
            u.name AS user_name, u.email AS user_email
     FROM alignment_reports r
     LEFT JOIN users u ON r.user_id = u.id
     WHERE r.user_id = ?
     ORDER BY r.created_at DESC`,
    [userId]
  );

  // Log para verificar los datos recuperados
  console.log("[BACKEND] Report Data with User Info:", rows);

  return rows;


  // Deserializar los campos JSON para cada reporte
  const reports = rows.map((report) => {
    report.dims = JSON.parse(report.dims || "{}");
    report.indicators = JSON.parse(report.indicators || "{}");
    report.results = JSON.parse(report.results || "{}");
    return report;
  });

  return reports;
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

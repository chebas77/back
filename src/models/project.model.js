import { pool } from '../config/db.js';

function parseJSON(value) {
  if (!value) return undefined;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function escapeLikePattern(text = '') {
  return `%${text.replace(/[ %_]/g, (char) => (char === ' ' ? '%' : `\\${char}`))}%`;
}

export function mapProjectRow(row) {
  if (!row) return null;

  const created = row.created_at ? new Date(row.created_at) : null;
  const updated = row.updated_at ? new Date(row.updated_at) : created;
  const lastCalc = row.last_calculation_at ? new Date(row.last_calculation_at) : null;
  const metrics = parseJSON(row.metrics);

  const base = {
    id: row.id,
    projectId: row.id,
    name: row.name,
    title: row.name,
    description: row.description,
    status: row.status || row.state || 'NEW',
    state: row.status || row.state || 'NEW',
    createdAt: created ? created.toISOString() : null,
    created_at: created ? created.toISOString() : null,
    updatedAt: updated ? updated.toISOString() : null,
    updated_at: updated ? updated.toISOString() : null,
  };

  if (lastCalc) {
    base.lastCalculationAt = lastCalc.toISOString();
    base.last_calculation_at = lastCalc.toISOString();
  }

  if (row.progress !== undefined && row.progress !== null) {
    base.progress = Number(row.progress);
  }

  let precision = undefined;
  if (row.precision_score !== undefined && row.precision_score !== null) {
    precision = Number(row.precision_score);
    base.precision = precision;
  }

  if (metrics || precision !== undefined) {
    base.metrics = { ...(metrics || {}) };
    if (precision !== undefined && base.metrics.precision === undefined) {
      base.metrics.precision = precision;
    }
  }

  return base;
}

export async function createProject({ name, description }) {
  const trimmedName = name.trim();
  const trimmedDescription = description ? description.trim() : '';
  const normalizedDescription = trimmedDescription ? trimmedDescription : null;

  const [result] = await pool.query(
    `INSERT INTO projects (name, description, status)
     VALUES (?, ?, 'NEW')`,
    [trimmedName, normalizedDescription]
  );

  return findProjectById(result.insertId);
}

export async function findProjectById(id) {
  const [rows] = await pool.query(`SELECT * FROM projects WHERE id = ?`, [id]);
  if (!rows.length) return null;
  return mapProjectRow(rows[0]);
}

export async function listRecentProjects(limit = 5) {
  const [rows] = await pool.query(
    `SELECT *
     FROM projects
     ORDER BY COALESCE(updated_at, created_at) DESC
     LIMIT ?`,
    [limit]
  );
  return rows.map(mapProjectRow);
}

export async function searchProjects(query, limit = 10) {
  const normalized = query.trim();
  if (!normalized) return [];

  const like = escapeLikePattern(normalized);
  const maybeId = Number.parseInt(normalized, 10);
  const conditions = [];
  const params = [];

  if (!Number.isNaN(maybeId)) {
    conditions.push('id = ?');
    params.push(maybeId);
  }

  conditions.push('name LIKE ?');
  params.push(like);

  conditions.push('description LIKE ?');
  params.push(like);

  const sql = `
    SELECT *
    FROM projects
    WHERE ${conditions.join(' OR ')}
    ORDER BY COALESCE(updated_at, created_at) DESC
    LIMIT ?
  `;
  params.push(limit);

  const [rows] = await pool.query(sql, params);
  return rows.map(mapProjectRow);
}

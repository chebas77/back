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

export async function createProject({ name, description, userId }) {
  const trimmedName = name.trim();
  const trimmedDescription = description ? description.trim() : '';
  const normalizedDescription = trimmedDescription ? trimmedDescription : null;

  const [result] = await pool.query(
    `INSERT INTO projects (user_id, name, description, status)
     VALUES (?, ?, ?, 'PENDIENTE')`,
    [userId, trimmedName, normalizedDescription]
  );

  return findProjectById(result.insertId, userId);
}

export async function findProjectById(id, userId = null) {
  const sql = userId 
    ? `SELECT * FROM projects WHERE id = ? AND user_id = ?`
    : `SELECT * FROM projects WHERE id = ?`;
  const params = userId ? [id, userId] : [id];
  
  const [rows] = await pool.query(sql, params);
  if (!rows.length) return null;
  return mapProjectRow(rows[0]);
}

export async function listRecentProjects(limit = 5, userId = null) {
  const sql = userId
    ? `SELECT * FROM projects WHERE user_id = ? ORDER BY COALESCE(updated_at, created_at) DESC LIMIT ?`
    : `SELECT * FROM projects ORDER BY COALESCE(updated_at, created_at) DESC LIMIT ?`;
  const params = userId ? [userId, limit] : [limit];
  
  const [rows] = await pool.query(sql, params);
  return rows.map(mapProjectRow);
}

export async function listProjects({ page = 1, pageSize = 20, userId = null } = {}) {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? Math.floor(pageSize) : 20;
  const offset = (safePage - 1) * safePageSize;

  const whereClause = userId ? 'WHERE user_id = ?' : '';
  const params = userId ? [userId, safePageSize, offset] : [safePageSize, offset];

  const [rows] = await pool.query(
    `SELECT *
     FROM projects
     ${whereClause}
     ORDER BY COALESCE(updated_at, created_at) DESC
     LIMIT ? OFFSET ?`,
    params
  );

  const countParams = userId ? [userId] : [];
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM projects ${whereClause}`,
    countParams
  );
  const total = countRows?.[0]?.total ?? 0;

  return { items: rows.map(mapProjectRow), total };
}


export async function searchProjects(query, limit = 10, userId = null) {
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

  const whereClause = userId 
    ? `(${conditions.join(' OR ')}) AND user_id = ?`
    : conditions.join(' OR ');
  
  if (userId) params.push(userId);

  const sql = `
    SELECT *
    FROM projects
    WHERE ${whereClause}
    ORDER BY COALESCE(updated_at, created_at) DESC
    LIMIT ?
  `;
  params.push(limit);

  const [rows] = await pool.query(sql, params);
  return rows.map(mapProjectRow);
}

// ============== GESTIÓN DE CÁLCULOS EN PROYECTOS ==============

export async function getProjectCalculations(projectId) {
  const [rows] = await pool.query(
    `SELECT id, title, equipment_id, method, created_at, updated_at
     FROM alignment_reports
     WHERE project_id = ?
     ORDER BY created_at DESC`,
    [projectId]
  );
  return rows;
}

export async function assignCalculationToProject(calculationId, projectId) {
  await pool.query(
    `UPDATE alignment_reports
     SET project_id = ?, updated_at = NOW()
     WHERE id = ?`,
    [projectId, calculationId]
  );
  await updateProjectMetrics(projectId);
  return true;
}

export async function unassignCalculationFromProject(calculationId) {
  const [rows] = await pool.query(
    `SELECT project_id FROM alignment_reports WHERE id = ?`,
    [calculationId]
  );
  const oldProjectId = rows[0]?.project_id;

  await pool.query(
    `UPDATE alignment_reports
     SET project_id = NULL, updated_at = NOW()
     WHERE id = ?`,
    [calculationId]
  );

  if (oldProjectId) {
    await updateProjectMetrics(oldProjectId);
  }
  return true;
}

export async function updateProjectMetrics(projectId) {
  const [stats] = await pool.query(
    `SELECT
       COUNT(*) AS total_calculations,
       MAX(created_at) AS last_calculation_at
     FROM alignment_reports
     WHERE project_id = ?`,
    [projectId]
  );

  const totalCalculations = stats[0]?.total_calculations || 0;
  const lastCalculation = stats[0]?.last_calculation_at;

  await pool.query(
    `UPDATE projects
     SET last_calculation_at = ?, updated_at = NOW()
     WHERE id = ?`,
    [lastCalculation, projectId]
  );

  return { totalCalculations, lastCalculation };
}

export async function deleteProject(projectId, userId = null) {
  // Desasignar todos los cálculos antes de eliminar
  await pool.query(
    `UPDATE alignment_reports
     SET project_id = NULL
     WHERE project_id = ?`,
    [projectId]
  );

  const whereClause = userId ? 'WHERE id = ? AND user_id = ?' : 'WHERE id = ?';
  const params = userId ? [projectId, userId] : [projectId];
  
  const [result] = await pool.query(
    `DELETE FROM projects ${whereClause}`,
    params
  );
  return result.affectedRows > 0;
}

export async function updateProject(projectId, { name, description, status, userId = null }) {
  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name.trim());
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description ? description.trim() : null);
  }
  if (status !== undefined) {
    // Validar estado
    const validStatuses = ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADO'];
    const normalizedStatus = status.toUpperCase();
    if (validStatuses.includes(normalizedStatus)) {
      updates.push('status = ?');
      params.push(normalizedStatus);
    }
  }

  if (updates.length === 0) {
    return findProjectById(projectId, userId);
  }

  updates.push('updated_at = NOW()');
  params.push(projectId);
  
  const whereClause = userId ? 'WHERE id = ? AND user_id = ?' : 'WHERE id = ?';
  if (userId) params.push(userId);

  await pool.query(
    `UPDATE projects SET ${updates.join(', ')} ${whereClause}`,
    params
  );

  return findProjectById(projectId, userId);
}

export async function updateProjectStatus(projectId, status, userId = null) {
  const validStatuses = ['PENDIENTE', 'EN_PROGRESO', 'COMPLETADO'];
  const normalizedStatus = status.toUpperCase();
  
  if (!validStatuses.includes(normalizedStatus)) {
    throw new Error(`Estado no válido. Usa: ${validStatuses.join(', ')}`);
  }

  const whereClause = userId ? 'WHERE id = ? AND user_id = ?' : 'WHERE id = ?';
  const params = userId ? [normalizedStatus, projectId, userId] : [normalizedStatus, projectId];

  await pool.query(
    `UPDATE projects SET status = ?, updated_at = NOW() ${whereClause}`,
    params
  );

  return findProjectById(projectId, userId);
}

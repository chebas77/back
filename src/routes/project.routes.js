import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import {
  createProject,
  listRecentProjects,
  searchProjects,
  findProjectById,
} from '../models/project.model.js';
import { precisionPctContinuous, SELECT_RESULTS_FIELDS } from '../utils/precision.js';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description : '';

  if (!name) {
    return res.status(400).json({ error: 'El nombre del proyecto es obligatorio' });
  }

  try {
    const project = await createProject({ name, description });
    if (!project) {
      return res.status(500).json({ error: 'No se pudo crear el proyecto' });
    }
    return res.status(201).json({ project });
  } catch (error) {
    console.error('POST /projects error:', error);
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        error: 'Tabla "projects" inexistente',
        hint: 'Ejecuta la migración/creación de tabla antes de crear proyectos',
      });
    }
    return res.status(500).json({ error: 'No se pudo crear el proyecto' });
  }
});

router.get('/search', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q : '';
  const limitParam = Number.parseInt(req.query.limit, 10);
  const limit = Number.isNaN(limitParam) ? 10 : Math.min(Math.max(limitParam, 1), 50);

  if (!query.trim()) {
    return res.json({ items: [] });
  }

  try {
    const items = await searchProjects(query, limit);
    return res.json({ items });
  } catch (error) {
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({ items: [] });
    }
    console.error('GET /projects/search error:', error);
    return res.status(500).json({ error: 'No se pudo buscar proyectos' });
  }
});

router.get('/recent', async (req, res) => {
  const limitParam = Number.parseInt(req.query.limit, 10);
  const limit = Number.isNaN(limitParam) ? 5 : Math.min(Math.max(limitParam, 1), 50);

  try {
    const recent = await listRecentProjects(limit);
    if (recent.length) {
      return res.json(recent);
    }
  } catch (error) {
    if (error.code !== 'ER_NO_SUCH_TABLE') {
      console.error('GET /projects/recent error:', error);
      return res.status(500).json({ error: 'No se pudo obtener proyectos recientes' });
    }
    // Si la tabla no existe seguimos con el fallback usando alignment_reports
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         id,
         title,
         equipment_id,
         description,
         created_at,
         ${SELECT_RESULTS_FIELDS}
       FROM alignment_reports
       ORDER BY created_at DESC
       LIMIT ?`,
      [limit]
    );

    const now = Date.now();
    const twoDays = 2 * 24 * 3600 * 1000;

    const mapped = rows.map((row) => {
      const name =
        (row.title && row.title.trim()) ||
        (row.equipment_id && row.equipment_id.trim()) ||
        `Reporte #${row.id}`;

      let status = 'PENDIENTE';
      if (row.title || row.description) status = 'COMPLETADO';
      else if (now - new Date(row.created_at).getTime() <= twoDays) status = 'EN_PROGRESO';

      const updatedISO = new Date(row.created_at).toISOString();
      const precision = precisionPctContinuous(row);

      return {
        id: row.id,
        projectId: row.id,
        name,
        title: name,
        status,
        state: status,
        description: row.description,
        createdAt: updatedISO,
        created_at: updatedISO,
        updatedAt: updatedISO,
        updated_at: updatedISO,
        precision,
        metrics: { precision },
      };
    });

    return res.json(mapped);
  } catch (error) {
    console.error('GET /projects/recent fallback error:', error);
    return res.status(500).json({ error: 'No se pudo obtener proyectos recientes' });
  }
});

function buildProjectFilter(identifier) {
  if (typeof identifier === 'string') {
    const lowered = identifier.toLowerCase();
    if (['null', 'none', 'unassigned', 'sin-proyecto'].includes(lowered)) {
      return { clause: 'r.project_id IS NULL', params: [] };
    }
  }

  const numericId = Number.parseInt(identifier, 10);
  if (Number.isNaN(numericId) || numericId <= 0) {
    return null;
  }

  return { clause: 'r.project_id = ?', params: [numericId], projectId: numericId };
}

function safeParseJSON(raw) {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

router.get('/:projectId/alignment-reports', requireAuth, async (req, res) => {
  const { projectId: identifier } = req.params;
  const filter = buildProjectFilter(identifier);

  if (!filter) {
    return res.status(400).json({ error: 'Identificador de proyecto inválido' });
  }

  const pageParam = Number.parseInt(req.query.page, 10);
  const sizeParam = Number.parseInt(req.query.pageSize, 10);
  const page = Number.isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
  const pageSize = Number.isNaN(sizeParam) ? 20 : Math.min(Math.max(sizeParam, 1), 100);
  const offset = (page - 1) * pageSize;

  let project = null;
  if (filter.projectId) {
    project = await findProjectById(filter.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Proyecto no encontrado' });
    }
  } else {
    project = {
      id: null,
      projectId: null,
      name: 'Cálculos sin proyecto',
      title: 'Cálculos sin proyecto',
      description: 'Resultados generados que aún no se asignaron a un proyecto.',
      status: 'UNASSIGNED',
      state: 'UNASSIGNED',
      createdAt: null,
      created_at: null,
      updatedAt: null,
      updated_at: null,
    };
  }

  try {
    const [rows] = await pool.query(
      `SELECT
         r.id,
         r.project_id,
         r.user_id,
         r.title,
         r.description,
         r.equipment_id,
         r.method,
         r.created_at,
         r.updated_at,
         r.dims,
         r.indicators,
         r.results,
         r.sag,
         u.name AS user_name,
         u.email AS user_email,
         ${SELECT_RESULTS_FIELDS}
       FROM alignment_reports r
       LEFT JOIN users u ON u.id = r.user_id
       WHERE ${filter.clause}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      [...filter.params, pageSize, offset]
    );

    const items = rows.map((row) => {
      const { VN, VF, HN, HF, ...rest } = row;
      const precision = precisionPctContinuous({ VN, VF, HN, HF });
      const createdISO = rest.created_at ? new Date(rest.created_at).toISOString() : null;
      const updatedISO = rest.updated_at ? new Date(rest.updated_at).toISOString() : createdISO;

      return {
        id: rest.id,
        reportId: rest.id,
        projectId: rest.project_id,
        userId: rest.user_id,
        title: rest.title,
        description: rest.description,
        equipmentId: rest.equipment_id,
        method: rest.method,
        createdAt: createdISO,
        created_at: createdISO,
        updatedAt: updatedISO,
        updated_at: updatedISO,
        sag: rest.sag !== null && rest.sag !== undefined ? Number(rest.sag) : null,
        precision,
        metrics: { precision },
        dims: safeParseJSON(rest.dims),
        indicators: safeParseJSON(rest.indicators),
        results: safeParseJSON(rest.results),
        user: rest.user_name || rest.user_email
          ? {
              id: rest.user_id,
              name: rest.user_name || null,
              email: rest.user_email || null,
            }
          : undefined,
      };
    });

    const [metricsRows] = await pool.query(
      `SELECT
         COUNT(*) AS total_reports,
         MAX(created_at) AS last_calculation_at,
         AVG(precision_pct) AS avg_precision
       FROM (
         SELECT
           created_at,
           CASE
             WHEN valid_count = 0 THEN NULL
             ELSE (score_sum / valid_count) * 100
           END AS precision_pct
         FROM (
           SELECT
             created_at,
             (COALESCE(VN_score, 0) + COALESCE(VF_score, 0) + COALESCE(HN_score, 0) + COALESCE(HF_score, 0)) AS score_sum,
             (CASE WHEN VN_score IS NULL THEN 0 ELSE 1 END +
              CASE WHEN VF_score IS NULL THEN 0 ELSE 1 END +
              CASE WHEN HN_score IS NULL THEN 0 ELSE 1 END +
              CASE WHEN HF_score IS NULL THEN 0 ELSE 1 END) AS valid_count
           FROM (
             SELECT
               created_at,
               CASE WHEN VN IS NULL THEN NULL ELSE GREATEST(0, 1 - LEAST(1, ABS(VN) / 10)) END AS VN_score,
               CASE WHEN VF IS NULL THEN NULL ELSE GREATEST(0, 1 - LEAST(1, ABS(VF) / 10)) END AS VF_score,
               CASE WHEN HN IS NULL THEN NULL ELSE GREATEST(0, 1 - LEAST(1, ABS(HN) / 50)) END AS HN_score,
               CASE WHEN HF IS NULL THEN NULL ELSE GREATEST(0, 1 - LEAST(1, ABS(HF) / 150)) END AS HF_score
             FROM (
               SELECT r.created_at, ${SELECT_RESULTS_FIELDS}
               FROM alignment_reports r
               WHERE ${filter.clause}
             ) raw
           ) scored
         ) aggregated
       ) stats`,
      filter.params
    );

    const meta = metricsRows[0] || {};
    const totalReports = Number(meta.total_reports || 0);
    const lastCalculationAt = meta.last_calculation_at
      ? new Date(meta.last_calculation_at).toISOString()
      : null;
    const avgPrecision = meta.avg_precision !== null && meta.avg_precision !== undefined
      ? +Number(meta.avg_precision).toFixed(1)
      : null;

    const totalPages = totalReports ? Math.ceil(totalReports / pageSize) : 0;

    return res.json({
      ok: true,
      project,
      stats: {
        totalReports,
        lastCalculationAt,
        avgPrecision,
        page,
        pageSize,
        totalPages,
      },
      reports: items,
    });
  } catch (error) {
    console.error('GET /projects/:projectId/alignment-reports error:', error);
    return res.status(500).json({ error: 'No se pudo obtener los reportes del proyecto' });
  }
});

export default router;

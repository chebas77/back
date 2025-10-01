import { Router } from 'express';
import { pool } from '../config/db.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import {
  createProject,
  listRecentProjects,
  searchProjects,
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

export default router;

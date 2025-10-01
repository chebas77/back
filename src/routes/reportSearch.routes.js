import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

function buildLike(query) {
  return `%${query.replace(/[%_]/g, (char) => `\\${char}`)}%`;
}

router.get('/search', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const limitParam = Number.parseInt(req.query.limit, 10);
  const limit = Number.isNaN(limitParam) ? 10 : Math.min(Math.max(limitParam, 1), 50);

  if (!query) {
    return res.json({ items: [] });
  }

  const like = buildLike(query);
  const maybeId = Number.parseInt(query, 10);

  try {
    const params = [like, like, like, like, limit];
    let sql = `
      SELECT id, title, method, type, description, equipment_id, created_at
      FROM alignment_reports
      WHERE title LIKE ?
         OR equipment_id LIKE ?
         OR method LIKE ?
         OR description LIKE ?
    `;

    if (!Number.isNaN(maybeId)) {
      sql += ' OR id = ?';
      params.splice(params.length - 1, 0, maybeId);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';

    const [rows] = await pool.query(sql, params);

    const items = rows.map((row) => {
      const createdISO = row.created_at ? new Date(row.created_at).toISOString() : null;
      const title = (row.title && row.title.trim()) || `Reporte #${row.id}`;
      const method = row.method || row.type || 'DESCONOCIDO';

      return {
        id: row.id,
        reportId: row.id,
        title,
        name: title,
        method,
        type: row.type || method,
        createdAt: createdISO,
        created_at: createdISO,
      };
    });

    return res.json({ items });
  } catch (error) {
    console.error('GET /reports/search error:', error);
    return res.status(500).json({ error: 'No se pudo buscar reportes' });
  }
});

export default router;

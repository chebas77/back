import { Router } from 'express';
import { pool } from '../config/db.js';

const router = Router();

// ====== Config precisión continua ======
const TOL = { VN: 10, VF: 10, HN: 50, HF: 150 };
function precisionPctContinuous({ VN, VF, HN, HF }) {
  const parts = [['VN', VN], ['VF', VF], ['HN', HN], ['HF', HF]]
    .filter(([, v]) => typeof v === 'number' && !Number.isNaN(v));
  if (!parts.length) return 0;
  const scores = parts.map(([k, v]) => {
    const lim = TOL[k];
    if (!lim || !isFinite(lim) || lim <= 0) return 0;
    const rel = Math.abs(v) / lim;
    const score = Math.max(0, 1 - Math.min(1, rel));
    return score;
  });
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return +(avg * 100).toFixed(1);
}

// Utilidad para leer VN,VF,HN,HF desde JSON (MariaDB/MySQL 5.7+)
const SELECT_RESULTS_FIELDS = `
  CAST(JSON_UNQUOTE(JSON_EXTRACT(results, '$.VN')) AS DECIMAL(20,6)) AS VN,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(results, '$.VF')) AS DECIMAL(20,6)) AS VF,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(results, '$.HN')) AS DECIMAL(20,6)) AS HN,
  CAST(JSON_UNQUOTE(JSON_EXTRACT(results, '$.HF')) AS DECIMAL(20,6)) AS HF
`;

/**
 * GET /stats
 * - activeProjects: equipos distintos en últimos 7 días
 * - totalCalculations: total de alignment_reports
 * - generatedReports: total de alignment_reports (igual por ahora)
 * - avgAccuracy: precisión continua promedio (todos los registros)
 * - deltas: diferencia (valor_actual - valor_anterior) para última semana vs la semana previa
 */
router.get('/stats', async (req, res) => {
  try {
    // Totales globales
    const [[tot]] = await pool.query(`SELECT COUNT(*) AS total FROM alignment_reports`);
    const totalCalculations = Number(tot.total || 0);
    const generatedReports  = totalCalculations;

    // Activos: últimos 7 días
    const [[act]] = await pool.query(`
      SELECT COUNT(DISTINCT equipment_id) AS active
      FROM alignment_reports
      WHERE equipment_id IS NOT NULL
        AND TRIM(equipment_id) <> ''
        AND created_at >= (NOW() - INTERVAL 7 DAY)
    `);
    const activeProjects = Number(act.active || 0);

    // Precisión promedio global (continua)
    const [allRows] = await pool.query(`
      SELECT ${SELECT_RESULTS_FIELDS}
      FROM alignment_reports
    `);
    const allPcts = allRows.map(precisionPctContinuous);
    const avgAccuracy = allPcts.length ? +(allPcts.reduce((a,b)=>a+b,0)/allPcts.length).toFixed(1) : 0;

    // ====== DELTAS semana actual vs semana previa ======
    const [curRows] = await pool.query(`
      SELECT created_at, equipment_id, ${SELECT_RESULTS_FIELDS}
      FROM alignment_reports
      WHERE created_at >= (NOW() - INTERVAL 7 DAY)
    `);
    const [prevRows] = await pool.query(`
      SELECT created_at, equipment_id, ${SELECT_RESULTS_FIELDS}
      FROM alignment_reports
      WHERE created_at <  (NOW() - INTERVAL 7 DAY)
        AND created_at >= (NOW() - INTERVAL 14 DAY)
    `);

    const curActive  = new Set(curRows.filter(r => (r.equipment_id||'').trim()).map(r => r.equipment_id)).size;
    const prevActive = new Set(prevRows.filter(r => (r.equipment_id||'').trim()).map(r => r.equipment_id)).size;

    const curCalc = curRows.length;
    const prevCalc = prevRows.length;

    // Si manejas reports separados, ajusta esta lógica; por ahora equivalemos
    const curReports = curCalc;
    const prevReports = prevCalc;

    const curAcc = curRows.length
      ? +(curRows.map(precisionPctContinuous).reduce((a,b)=>a+b,0)/curRows.length).toFixed(1)
      : 0;
    const prevAcc = prevRows.length
      ? +(prevRows.map(precisionPctContinuous).reduce((a,b)=>a+b,0)/prevRows.length).toFixed(1)
      : 0;

    const deltas = {
      projects:      curActive  - prevActive,
      calculations:  curCalc    - prevCalc,
      reports:       curReports - prevReports,
      accuracy:      +(curAcc - prevAcc).toFixed(1),
    };

    res.json({ activeProjects, totalCalculations, generatedReports, avgAccuracy, deltas });
  } catch (e) {
    console.error('GET /stats error:', e);
    res.status(500).json({ error: 'No se pudo obtener stats' });
  }
});
router.get('/projects/recent', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT
        id, title, equipment_id, description, created_at,
        ${SELECT_RESULTS_FIELDS}
      FROM alignment_reports
      ORDER BY created_at DESC
      LIMIT 5
    `);

    const now = Date.now();
    const twoDays = 2 * 24 * 3600 * 1000;

    const mapped = rows.map(r => {
      const name =
        (r.title && r.title.trim()) ||
        (r.equipment_id && r.equipment_id.trim()) ||
        `Reporte #${r.id}`;

      let status = 'PENDIENTE';
      if (r.title || r.description) status = 'COMPLETADO';
      else if (now - new Date(r.created_at).getTime() <= twoDays) status = 'EN_PROGRESO';

      const precision = precisionPctContinuous(r); // continua 0..100

      return {
        id: r.id,
        name,
        status,
        updatedAt: new Date(r.created_at).toISOString(),
        precision,
      };
    });

    res.json(mapped);
  } catch (e) {
    console.error('GET /projects/recent error:', e);
    res.status(500).json({ error: 'No se pudo obtener proyectos recientes' });
  }
});

export default router;

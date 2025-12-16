import { Router } from 'express';
import { pool } from '../config/db.js';
import { precisionPctContinuous, SELECT_RESULTS_FIELDS } from '../utils/precision.js';
import { requireAuth } from '../middlewares/requireAuth.js';

const router = Router();
router.use(requireAuth);

/**
 * GET /stats
 * - activeProjects: proyectos con actividad en los últimos 7 días
 * - totalCalculations: total de alignment_reports
 * - generatedReports: total de alignment_reports (igual por ahora)
 * - avgAccuracy: precisión continua promedio (todos los registros)
 * - deltas: diferencia (valor_actual - valor_anterior) para última semana vs la semana previa
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Totales del usuario
    const [[tot]] = await pool.query(
      `SELECT COUNT(*) AS total FROM alignment_reports WHERE user_id = ?`,
      [userId]
    );
    const totalCalculations = Number(tot.total || 0);
    const generatedReports = totalCalculations;

    // Precisión promedio del usuario (continua)
    const [allRows] = await pool.query(
      `SELECT ${SELECT_RESULTS_FIELDS}
       FROM alignment_reports
       WHERE user_id = ?`,
      [userId]
    );
    const allPcts = allRows.map(precisionPctContinuous);
    const avgAccuracy = allPcts.length
      ? +(allPcts.reduce((a, b) => a + b, 0) / allPcts.length).toFixed(1)
      : 0;

    // ====== DELTAS semana actual vs semana previa (del usuario) ======
    const [curRows] = await pool.query(
      `SELECT created_at, equipment_id, ${SELECT_RESULTS_FIELDS}
       FROM alignment_reports
       WHERE user_id = ? AND created_at >= (NOW() - INTERVAL 7 DAY)`,
      [userId]
    );
    const [prevRows] = await pool.query(
      `SELECT created_at, equipment_id, ${SELECT_RESULTS_FIELDS}
       FROM alignment_reports
       WHERE user_id = ?
         AND created_at <  (NOW() - INTERVAL 7 DAY)
         AND created_at >= (NOW() - INTERVAL 14 DAY)`,
      [userId]
    );

    const curActive = new Set(
      curRows.filter((r) => (r.equipment_id || '').trim()).map((r) => r.equipment_id)
    ).size;
    const prevActive = new Set(
      prevRows.filter((r) => (r.equipment_id || '').trim()).map((r) => r.equipment_id)
    ).size;

    const curCalc = curRows.length;
    const prevCalc = prevRows.length;

    // Si manejas reports separados, ajusta esta lógica; por ahora equivalemos
    const curReports = curCalc;
    const prevReports = prevCalc;

    const curAcc = curRows.length
      ? +(curRows.map(precisionPctContinuous).reduce((a, b) => a + b, 0) / curRows.length).toFixed(1)
      : 0;
    const prevAcc = prevRows.length
      ? +(prevRows.map(precisionPctContinuous).reduce((a, b) => a + b, 0) / prevRows.length).toFixed(1)
      : 0;

    let activeProjects = curActive;
    let projectDelta = curActive - prevActive;

    try {
      const [[currentProjects]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM projects
         WHERE user_id = ? AND updated_at >= (NOW() - INTERVAL 7 DAY)`,
        [userId]
      );
      const [[previousProjects]] = await pool.query(
        `SELECT COUNT(*) AS total
         FROM projects
         WHERE user_id = ?
           AND updated_at <  (NOW() - INTERVAL 7 DAY)
           AND updated_at >= (NOW() - INTERVAL 14 DAY)`,
        [userId]
      );

      activeProjects = Number(currentProjects.total || 0);
      projectDelta = activeProjects - Number(previousProjects.total || 0);
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') {
        throw err;
      }
      // Si la tabla projects no existe todavía, usamos el fallback basado en alignment_reports
    }

    const deltas = {
      projects: projectDelta,
      calculations: curCalc - prevCalc,
      reports: curReports - prevReports,
      accuracy: +(curAcc - prevAcc).toFixed(1),
    };

    res.json({ activeProjects, totalCalculations, generatedReports, avgAccuracy, deltas });
  } catch (e) {
    console.error('GET /stats error:', e);
    res.status(500).json({ error: 'No se pudo obtener stats' });
  }
});

export default router;

// src/routes/rimface.routes.js
import { Router } from "express";
import { pool } from "../config/db.js";
import { computeAlignment } from "../services/alignment.service.js"; // VN,VF,HN,HF

const router = Router();
const DB = "alignment_manager";

// 1) New session
router.post("/session", async (req, res) => {
  const { machine_name = null, description = null } = req.body || {};
  const [r] = await pool.query(
    `INSERT INTO ${DB}.sessions (machine_name, description, method) VALUES (?, ?, 'rim_face')`,
    [machine_name, description]
  );
  res.json({ ok: true, sessionId: r.insertId });
});

// 2) Step 1: Physical Data Input
router.put("/session/:id/physical", async (req, res) => {
  const id = Number(req.params.id);
  const { H, D, E, skipLeftSide = true, F = null, G = null } = req.body;

  if (Number(D) > Number(E)) {
    return res.status(400).json({ ok: false, error: "Invalid Distance D! D cannot be greater than E." });
  }

  await pool.query(
    `REPLACE INTO ${DB}.dimensions (session_id, H, D, E, F, G) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, H, D, E, skipLeftSide ? null : F, skipLeftSide ? null : G]
  );

  res.json({ ok: true });
});

// 3) Step 2: Dial Gage Data Input
router.put("/session/:id/indicators", async (req, res) => {
  const id = Number(req.params.id);
  let { R0 = 0, R90, R180, R270, F0 = 0, F90, F180, F270, SAG = 0 } = req.body;

  // “Adjusted for SAG, if any >>”: aplicamos SAG a 90° (ajuste sencillo; ajusta si usas otro criterio)
  R90 = Number(R90) + Number(SAG);
  F90 = Number(F90) + Number(SAG);

  await pool.query(
    `REPLACE INTO ${DB}.readings (session_id, R0, R90, R180, R270, F0, F90, F180, F270, SAG) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, R0, R90, R180, R270, F0, F90, F180, F270, SAG]
  );

  // Variance & Range Calculation (para la UI)
  const variance = {
    rim180_off_by: 0,   // <Auto-Filled> = 0.0
    face180_off_by: 0,
  };
  const range = {
    rim180_within: Math.abs(R180) <= Math.abs(R270) * 1.1 ? "Within Range" : "Out of Upperbound",
    face180_within: Math.abs(F180) <= Math.abs(F270) * 1.1 ? "Within Range" : "Out of Upperbound",
    rim_max: Math.max(...[R0, R90, R180, R270].map(v => Math.abs(Number(v) || 0))),
    face_max: Math.max(...[F0, F90, F180, F270].map(v => Math.abs(Number(v) || 0))),
  };

  res.json({ ok: true, variance, range });
});

// 4) Step 3: Review/Final Input Data → Calculate
router.post("/session/:id/calculate", async (req, res) => {
  const id = Number(req.params.id);
  const [[dim]] = await pool.query(`SELECT H,D,E FROM ${DB}.dimensions WHERE session_id=?`, [id]);
  const [[rd]]  = await pool.query(`SELECT R90,R180,R270,F90,F180,F270 FROM ${DB}.readings WHERE session_id=?`, [id]);

  if (!dim || !rd) return res.status(400).json({ ok: false, error: "Missing Physical or Indicator data" });

  const { VN, VF, HN, HF } = computeAlignment({ ...rd, ...dim });

  // Mapeo a Near/Far (Right of Coupling) como en la pantalla final
  const finalOutput = {
    vertical: { right: { near: VN, far: VF }, left: { near: "Skipped", far: "Skipped" } },
    horizontal: { right: { near: HN, far: HF }, left: { near: "Skipped", far: "Skipped" } },
    angularity_vertical: (dim.F180 ?? 0) ? (rd.F180 / dim.H) : (rd.F180 / dim.H), // placeholder si deseas mostrar -0.1
    offset_vertical: VF - VN,   // placeholder para “Offset” de panel derecho
    angularity_horizontal: (rd.F270 - rd.F90) / dim.H, // placeholder
    offset_horizontal: HF - HN, // placeholder
  };

  res.json({ ok: true, results: { VN, VF, HN, HF }, finalOutput });
});

// 5) Report (Create Report) — lo dejamos para el siguiente paso (PDF)
export default router;

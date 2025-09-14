// src/routes/alignment.routes.js
import { Router } from "express";
import { computeAlignment } from "../services/alignment.service.js";

const router = Router();

router.post("/compute", (req, res) => {
  try {
    console.group("[API] POST /api/alignment/compute");
    console.log("Raw body:");
    try { console.table(req.body); } catch { console.log(req.body); }

    const toNum = (v, name) => {
      const n = Number(v);
      if (Number.isNaN(n)) throw new Error(`Entrada inválida: ${name}`);
      return n;
    };

    const parsed = {
      R90:  toNum(req.body.R90, "R90"),
      R180: toNum(req.body.R180, "R180"),
      R270: toNum(req.body.R270, "R270"),
      F90:  toNum(req.body.F90, "F90"),
      F180: toNum(req.body.F180, "F180"),
      F270: toNum(req.body.F270, "F270"),
      H:    toNum(req.body.H, "H"),
      D:    toNum(req.body.D, "D"),
      E:    toNum(req.body.E, "E"),
    };

    console.log("Parsed (numeric):");
    try { console.table(parsed); } catch { console.log(parsed); }

    const results = computeAlignment(parsed);

    console.log("Results:");
    try { console.table(results); } catch { console.log(results); }
    console.groupEnd();

    res.json({ ok: true, results });
  } catch (e) {
    console.groupEnd?.();
    console.error("[API] /api/alignment/compute ERROR:", e.message);
    res.status(400).json({ ok: false, error: e.message });
  }
});

export default router;

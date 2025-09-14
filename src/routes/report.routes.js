import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { postCreateReport, getMyReports, getReport } from "../controllers/report.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/", getMyReports);     // ← lista del usuario
router.get("/:id", getReport);
router.post("/", postCreateReport);

export default router;

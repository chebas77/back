import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import { 
  postCreateReport, 
  getMyReports, 
  getReport,
  putUpdateReport,
  deleteReportById,
  assignReportToProject,
  unassignReportFromProject
} from "../controllers/report.controller.js";

const router = Router();
router.use(requireAuth);
router.get("/", getMyReports);
router.get("/:id", getReport);
router.post("/", postCreateReport);
router.put("/:id", putUpdateReport);
router.delete("/:id", deleteReportById);
router.put("/:reportId/assign-project", assignReportToProject);
router.put("/:reportId/unassign-project", unassignReportFromProject);

export default router;

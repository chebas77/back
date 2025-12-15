import { Router } from "express";
import { requireAuth } from "../middlewares/requireAuth.js";
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotificationById
} from "../controllers/notification.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", getNotifications);
router.put("/:id/read", markNotificationAsRead);
router.put("/read-all", markAllNotificationsAsRead);
router.delete("/:id", deleteNotificationById);

export default router;

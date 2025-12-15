import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteNotification
} from "../models/notification.model.js";

export async function getNotifications(req, res) {
  try {
    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const unreadOnly = req.query.unread === "true";

    const notifications = await getUserNotifications(userId, { limit, unreadOnly });
    const unreadCount = await getUnreadCount(userId);

    res.json({ ok: true, notifications, unreadCount });
  } catch (error) {
    console.error("[NOTIFICATIONS] getNotifications error:", error);
    res.status(500).json({ ok: false, error: "Error al obtener notificaciones" });
  }
}

export async function markNotificationAsRead(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notificationId = parseInt(id, 10);
    if (isNaN(notificationId)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }

    const updated = await markAsRead(notificationId, userId);
    if (!updated) {
      return res.status(404).json({ ok: false, error: "Notificación no encontrada" });
    }

    res.json({ ok: true, message: "Notificación marcada como leída" });
  } catch (error) {
    console.error("[NOTIFICATIONS] markAsRead error:", error);
    res.status(500).json({ ok: false, error: "Error al marcar notificación" });
  }
}

export async function markAllNotificationsAsRead(req, res) {
  try {
    const userId = req.user.id;
    const count = await markAllAsRead(userId);
    res.json({ ok: true, message: `${count} notificaciones marcadas como leídas` });
  } catch (error) {
    console.error("[NOTIFICATIONS] markAllAsRead error:", error);
    res.status(500).json({ ok: false, error: "Error al marcar notificaciones" });
  }
}

export async function deleteNotificationById(req, res) {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const notificationId = parseInt(id, 10);
    if (isNaN(notificationId)) {
      return res.status(400).json({ ok: false, error: "ID inválido" });
    }

    const deleted = await deleteNotification(notificationId, userId);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "Notificación no encontrada" });
    }

    res.json({ ok: true, message: "Notificación eliminada" });
  } catch (error) {
    console.error("[NOTIFICATIONS] deleteNotification error:", error);
    res.status(500).json({ ok: false, error: "Error al eliminar notificación" });
  }
}

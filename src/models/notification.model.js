import { pool } from "../config/db.js";

/**
 * Crea una notificación para el usuario
 * @param {Object} params
 * @param {number} params.userId - ID del usuario
 * @param {string} params.type - Tipo de notificación (success, info, warning, error)
 * @param {string} params.title - Título de la notificación
 * @param {string} params.message - Mensaje descriptivo
 * @param {string} params.entityType - Tipo de entidad (project, report, etc)
 * @param {number} params.entityId - ID de la entidad relacionada
 */
export async function createNotification({ userId, type, title, message, entityType, entityId }) {
  const [result] = await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, entity_type, entity_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, type, title, message, entityType || null, entityId || null]
  );
  return result.insertId;
}

/**
 * Obtiene las notificaciones de un usuario
 * @param {number} userId 
 * @param {Object} options
 * @param {number} options.limit - Límite de resultados (default: 50)
 * @param {boolean} options.unreadOnly - Solo no leídas (default: false)
 */
export async function getUserNotifications(userId, { limit = 50, unreadOnly = false } = {}) {
  let query = `
    SELECT id, type, title, message, entity_type, entity_id, is_read, created_at
    FROM notifications
    WHERE user_id = ?
  `;
  
  if (unreadOnly) {
    query += ` AND is_read = FALSE`;
  }
  
  query += ` ORDER BY created_at DESC LIMIT ?`;
  
  const [rows] = await pool.query(query, [userId, limit]);
  return rows;
}

/**
 * Marca una notificación como leída
 * @param {number} notificationId 
 * @param {number} userId 
 */
export async function markAsRead(notificationId, userId) {
  const [result] = await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );
  return result.affectedRows > 0;
}

/**
 * Marca todas las notificaciones de un usuario como leídas
 * @param {number} userId 
 */
export async function markAllAsRead(userId) {
  const [result] = await pool.query(
    `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE`,
    [userId]
  );
  return result.affectedRows;
}

/**
 * Obtiene el conteo de notificaciones no leídas
 * @param {number} userId 
 */
export async function getUnreadCount(userId) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE`,
    [userId]
  );
  return rows[0]?.count || 0;
}

/**
 * Elimina una notificación
 * @param {number} notificationId 
 * @param {number} userId 
 */
export async function deleteNotification(notificationId, userId) {
  const [result] = await pool.query(
    `DELETE FROM notifications WHERE id = ? AND user_id = ?`,
    [notificationId, userId]
  );
  return result.affectedRows > 0;
}

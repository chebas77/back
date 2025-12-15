import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import dayjs from "dayjs";
import { createReport, findReportById, listReportsByUser, updateReport, deleteReport } from "../models/report.model.js";
import { getReportsByUser } from "../models/report.model.js";
import { createNotification } from "../models/notification.model.js";

function normalizeProjectId(value) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'object') {
    if (value.id !== undefined) {
      return normalizeProjectId(value.id);
    }
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
}

export async function postCreateReport(req, res) {
  const userId = req.user.id;
  const {
    title,
    description,
    equipmentId,
    dims,
    indicators,
    results,
    sag,
    projectId,
    project_id: projectIdSnake,
    project,
  } = req.body;

  // Validación mínima
  if (!dims?.H || !dims?.D || !dims?.E) {
    return res.status(400).json({ ok: false, error: "Faltan H, D, E" });
  }
  if (!indicators || !results) {
    return res.status(400).json({ ok: false, error: "Faltan indicadores/resultados" });
  }

  let normalizedProjectId = normalizeProjectId(projectId);
  if (normalizedProjectId === null) {
    normalizedProjectId = normalizeProjectId(projectIdSnake);
  }
  if (normalizedProjectId === null) {
    normalizedProjectId = normalizeProjectId(project);
  }

  try {
    const id = await createReport({
      userId,
      method: "RIM_FACE",
      title: title?.trim() || null,
      description: description?.trim() || null,
      equipmentId: equipmentId?.trim() || null,
      dims,
      indicators,
      results,
      sag: Number(sag || 0),
      projectId: normalizedProjectId,
    });

    // Si se asignó a un proyecto, actualizar sus métricas
    if (normalizedProjectId) {
      const { updateProjectMetrics } = await import('../models/project.model.js');
      await updateProjectMetrics(normalizedProjectId);
    }

    // Crear notificación
    await createNotification({
      userId,
      type: 'success',
      title: 'Reporte creado',
      message: `Reporte "${title || `#${id}`}" creado exitosamente`,
      entityType: 'report',
      entityId: id
    });

    res.json({ ok: true, id, projectId: normalizedProjectId });
  } catch (error) {
    console.error('[REPORTS] postCreateReport error:', error);
    res.status(500).json({ ok: false, error: 'Error al crear el reporte' });
  }
}

export async function getMyReports(req, res) {
  try {
    const userId = req.user.id;
    const rows = await getReportsByUser(userId);

    const base = `${req.protocol}://${req.get("host")}`;
    const items = rows.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      project_id: r.project_id,
      method: r.method,
      title: r.title,
      equipment_id: r.equipment_id,
      description: r.description,
      dims: r.dims,
      indicators: r.indicators,
      results: r.results,
      sag: r.sag,
      created_at: r.created_at,
      file_url: r.file_path ? `${base}${r.file_path.startsWith("/") ? "" : "/"}${r.file_path}` : null,
      user_name: r.user_name || null,
      user_email: r.user_email || null
    }));

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[REPORTS] getMyReports error:", err);
    return res.status(500).json({ ok: false, error: "DB error" });
  }
}

export async function assignReportToProject(req, res) {
  try {
    const { reportId } = req.params;
    const { projectId } = req.body;

    if (!projectId || !Number.isInteger(Number(projectId))) {
      return res.status(400).json({ ok: false, error: 'ID de proyecto inválido' });
    }

    const { assignCalculationToProject } = await import('../models/project.model.js');
    await assignCalculationToProject(Number(reportId), Number(projectId));

    return res.json({ ok: true, message: 'Cálculo asignado al proyecto exitosamente' });
  } catch (error) {
    console.error('[REPORTS] assignReportToProject error:', error);
    return res.status(500).json({ ok: false, error: 'Error al asignar cálculo al proyecto' });
  }
}

export async function unassignReportFromProject(req, res) {
  try {
    const { reportId } = req.params;

    const { unassignCalculationFromProject } = await import('../models/project.model.js');
    await unassignCalculationFromProject(Number(reportId));

    return res.json({ ok: true, message: 'Cálculo desasignado del proyecto exitosamente' });
  } catch (error) {
    console.error('[REPORTS] unassignReportFromProject error:', error);
    return res.status(500).json({ ok: false, error: 'Error al desasignar cálculo del proyecto' });
  }
}

export async function getReport(req, res) {
  try {
    const id = Number(req.params.id);
    const report = await findReportById(id, req.user.id);
    if (!report) return res.status(404).json({ ok: false, error: "Report not found" });

    // Si usas getUserById, no olvides importarlo y protegerlo
    let userName = null, userEmail = null;
    try {
      const user = await getUserById(report.user_id); // importa desde tu modelo de usuarios
      userName = user?.name ?? null;
      userEmail = user?.email ?? null;
    } catch { /* ignora si falla */ }

    return res.json({
      ok: true,
      report: {
        id: report.id,
        user_id: report.user_id,
        method: report.method,
        title: report.title,
        equipment_id: report.equipment_id,
        description: report.description,
        dims: report.dims,
        indicators: report.indicators,
        results: report.results,
        sag: report.sag,
        created_at: report.created_at,
        user_name: userName,
        user_email: userEmail,
      },
    });
  } catch (e) {
    console.error("[REPORT getReport] error:", e);
    return res.status(500).json({ ok: false, error: "Internal server error" });
  }
}

export async function putUpdateReport(req, res) {
  const userId = req.user.id;
  const reportId = Number(req.params.id);
  
  const {
    title,
    description,
    equipmentId,
    dims,
    indicators,
    results,
    sag,
    projectId,
    project_id: projectIdSnake,
    project,
  } = req.body;

  // Validación mínima
  if (!dims?.H || !dims?.D || !dims?.E) {
    return res.status(400).json({ ok: false, error: "Faltan H, D, E" });
  }
  if (!indicators || !results) {
    return res.status(400).json({ ok: false, error: "Faltan indicadores/resultados" });
  }

  // Verificar que el reporte existe y pertenece al usuario
  try {
    const existingReport = await findReportById(reportId, userId);
    if (!existingReport) {
      return res.status(404).json({ ok: false, error: "Reporte no encontrado o no tienes permiso para editarlo" });
    }

    let normalizedProjectId = normalizeProjectId(projectId);
    if (normalizedProjectId === null) {
      normalizedProjectId = normalizeProjectId(projectIdSnake);
    }
    if (normalizedProjectId === null) {
      normalizedProjectId = normalizeProjectId(project);
    }

    const updatedReport = await updateReport({
      reportId,
      userId,
      title: title?.trim() || null,
      description: description?.trim() || null,
      equipmentId: equipmentId?.trim() || null,
      dims,
      indicators,
      results,
      sag: Number(sag || 0),
      projectId: normalizedProjectId,
    });

    // Si se cambió el proyecto, actualizar métricas
    if (normalizedProjectId !== existingReport.project_id) {
      const { updateProjectMetrics } = await import('../models/project.model.js');
      if (existingReport.project_id) {
        await updateProjectMetrics(existingReport.project_id);
      }
      if (normalizedProjectId) {
        await updateProjectMetrics(normalizedProjectId);
      }
    }

    // Crear notificación
    await createNotification({
      userId,
      type: 'info',
      title: 'Reporte actualizado',
      message: `Reporte "${title || `#${reportId}`}" actualizado exitosamente`,
      entityType: 'report',
      entityId: reportId
    });

    res.json({ ok: true, report: updatedReport, id: reportId, projectId: normalizedProjectId });
  } catch (error) {
    console.error('[REPORTS] putUpdateReport error:', error);
    res.status(500).json({ ok: false, error: 'Error al actualizar el reporte' });
  }
}

export async function deleteReportById(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const reportId = parseInt(id, 10);
    if (isNaN(reportId)) {
      return res.status(400).json({ ok: false, error: 'ID de reporte inválido' });
    }

    // Verificar que el reporte existe y pertenece al usuario
    const existingReport = await findReportById(reportId, userId);
    if (!existingReport) {
      return res.status(404).json({ ok: false, error: 'Reporte no encontrado o no autorizado' });
    }

    // Guardar el project_id antes de eliminar para actualizar métricas
    const projectId = existingReport.project_id;

    // Eliminar el reporte
    const deleted = await deleteReport(reportId, userId);
    if (!deleted) {
      return res.status(500).json({ ok: false, error: 'No se pudo eliminar el reporte' });
    }

    // Actualizar métricas del proyecto si estaba asignado
    if (projectId) {
      await updateProjectMetrics(projectId);
    }

    res.json({ ok: true, message: 'Reporte eliminado correctamente' });
  } catch (error) {
    console.error('[REPORTS] deleteReportById error:', error);
    res.status(500).json({ ok: false, error: 'Error al eliminar el reporte' });
  }
}

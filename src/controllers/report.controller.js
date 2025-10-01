import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import dayjs from "dayjs";
import { createReport, findReportById, listReportsByUser } from "../models/report.model.js";
import { getReportsByUser } from "../models/report.model.js";


export async function postCreateReport(req, res) {
  const userId = req.user.id;
  const { title, description, equipmentId, dims, indicators, results, sag, projectId } = req.body;

  // Validación mínima
  if (!dims?.H || !dims?.D || !dims?.E) return res.status(400).json({ ok: false, error: "Faltan H,D,E" });
  if (!indicators || !results) return res.status(400).json({ ok: false, error: "Faltan indicadores/resultados" });

  // Guardar en BD
  let normalizedProjectId = null;
  if (projectId !== undefined && projectId !== null && projectId !== '') {
    const parsed = Number.parseInt(projectId, 10);
    if (!Number.isNaN(parsed) && parsed > 0) {
      normalizedProjectId = parsed;
    }
  }

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

  // Solo enviar los datos del reporte, no el archivo PDF
  res.json({ ok: true, id });
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
      projectId: r.project_id,
      method: r.method,
      title: r.title,
      equipment_id: r.equipment_id,
      description: r.description,
      dims: r.dims,  // No deserializamos, usamos el dato tal como está en la BD
      indicators: r.indicators,  // No deserializamos
      results: r.results,  // No deserializamos
      sag: r.sag,
      created_at: r.created_at,
      file_url: r.file_path ? `${base}${r.file_path.startsWith("/") ? "" : "/"}${r.file_path}` : null,
      user_name: r.user_name || null,
      user_email: r.user_email || null
    }));

    // Log para verificar la respuesta
    console.log("[BACKEND] Report Data Sent:", items);

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[REPORTS] getMyReports error:", err);
    return res.status(500).json({ ok: false, error: "DB error" });
  }
}


// report.controller.js (Backend)
// controllers/report.controller.js
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


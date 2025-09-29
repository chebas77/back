import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import dayjs from "dayjs";
import { createReport, findReportById, listReportsByUser } from "../models/report.model.js";
import { getReportsByUser } from "../models/report.model.js";


export async function postCreateReport(req, res) {
  const userId = req.user.id;
  const { title, description, equipmentId, dims, indicators, results, sag } = req.body;

  // Validación mínima
  if (!dims?.H || !dims?.D || !dims?.E) return res.status(400).json({ ok: false, error: "Faltan H,D,E" });
  if (!indicators || !results) return res.status(400).json({ ok: false, error: "Faltan indicadores/resultados" });

  // Guardar en BD
  const id = await createReport({
    userId,
    method: "RIM_FACE",
    title: title?.trim() || null,
    description: description?.trim() || null,
    equipmentId: equipmentId?.trim() || null,
    dims, indicators, results, sag: Number(sag || 0)
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
export async function getReport(req, res) {
  const id = Number(req.params.id);

  // Obtener el reporte desde la base de datos
  const report = await findReportById(id, req.user.id);

  if (!report) {
    console.log("[REPORT] Report not found for ID:", id);
    return res.status(404).json({ ok: false, error: "Report not found" });
  }

  // Obtener el nombre del usuario (si existe)
  const user = await getUserById(report.user_id); // Asumimos que hay una función para obtener el usuario por ID
  const userName = user ? user.name : "Unknown User";
  const userEmail = user ? user.email : "Unknown Email";

  // Registro de los datos que se están enviando al frontend
  console.log("[REPORT] Report data:", report);
  console.log("[REPORT] User data:", user);

  // Devolver los datos del reporte, asegurando que todos los campos estén presentes
  res.json({
    ok: true,
    report: {
      id: report.id,
      user_id: report.user_id,
      method: report.method,
      title: report.title,
      equipment_id: report.equipment_id,
      description: report.description,
      dims: report.dims, // No deserializamos, se envía tal cual como está
      indicators: report.indicators, // No deserializamos
      results: report.results, // No deserializamos
      sag: report.sag,
      created_at: report.created_at,
      user_name: userName,
      user_email: userEmail,
    },
  });
}

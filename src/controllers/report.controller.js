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
  if (!dims?.H || !dims?.D || !dims?.E) return res.status(400).json({ ok:false, error:"Faltan H,D,E" });
  if (!indicators || !results) return res.status(400).json({ ok:false, error:"Faltan indicadores/resultados" });

  // Guardar en BD
  const id = await createReport({
    userId,
    method: "RIM_FACE",
    title: title?.trim() || null,
    description: description?.trim() || null,
    equipmentId: equipmentId?.trim() || null,
    dims, indicators, results, sag: Number(sag || 0)
  });

  // Generar PDF
  const baseDir = path.resolve("files/reports");
  await fs.promises.mkdir(baseDir, { recursive: true });
  const pdfPath = path.join(baseDir, `${id}.pdf`);

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  doc.pipe(fs.createWriteStream(pdfPath));

  // Header
  doc.fontSize(18).text("Alignment Procedure Report", { align: "center" });
  doc.moveDown(0.2);
  doc.fontSize(12).text(`Report Date: ${dayjs().format("YYYY-MM-DD HH:mm")}`, { align: "center" });
  doc.fontSize(12).text("Rim and Face Method", { align: "center" });
  doc.moveDown();

  // Account / Meta
  doc.fontSize(11).text(`User: ${req.user.name || req.user.email}`);
  if (equipmentId) doc.text(`Equipment ID: ${equipmentId}`);
  if (title) doc.text(`Title: ${title}`);
  doc.moveDown();

  // Dimensions
  doc.fontSize(12).text("Equipment Measurements (inches)", { underline: true });
  doc.fontSize(10)
    .text(`H (Swing diameter): ${dims.H}`)
    .text(`D (Near feet → face): ${dims.D}`)
    .text(`E (Feet spacing): ${dims.E}`);
  if (dims.F || dims.G) {
    doc.text(`F (Left front): ${dims.F ?? "N/A"}`);
    doc.text(`G (Left back): ${dims.G ?? "N/A"}`);
  }
  doc.moveDown();

  // Indicators
  doc.fontSize(12).text("Dial Indicator Readings", { underline: true });
  doc.fontSize(10)
    .text(`Rim — 90°: ${indicators.R90}, 180°: ${indicators.R180}, 270°: ${indicators.R270}`)
    .text(`Face — 90°: ${indicators.F90}, 180°: ${indicators.F180}, 270°: ${indicators.F270}`)
    .text(`Adjusted for SAG @90°: ${sag || 0}`);
  doc.moveDown();

  // Results
  doc.fontSize(12).text("Calculated Results", { underline: true });
  doc.fontSize(10)
    .text(`Vertical — Near (VN): ${Number(results.VN).toFixed(2)}`)
    .text(`Vertical — Far  (VF): ${Number(results.VF).toFixed(2)}`)
    .text(`Horizontal — Near (HN): ${Number(results.HN).toFixed(2)}`)
    .text(`Horizontal — Far  (HF): ${Number(results.HF).toFixed(2)}`);
  doc.moveDown();

  // Notes
  if (description) {
    doc.fontSize(12).text("Notes", { underline: true });
    doc.fontSize(10).text(description);
  }

  doc.end();

  const pdfUrl = `/files/reports/${id}.pdf`;
  return res.json({ ok: true, id, pdfUrl });
}

export async function getMyReports(req, res) {
  try {
    const userId = req.user.id;
    const rows = await getReportsByUser(userId);

    // Adjunta URL absoluta del archivo si existe file_path
    const base = `${req.protocol}://${req.get("host")}`;
    const items = rows.map((r) => ({
      ...r,
      file_url: r.file_path ? `${base}${r.file_path.startsWith("/") ? "" : "/"}${r.file_path}` : null,
    }));

    return res.json({ ok: true, items });
  } catch (err) {
    console.error("[REPORTS] getMyReports error:", err);
    return res.status(500).json({ ok: false, error: "DB error" });
  }
}

export async function getReport(req, res) {
  const id = Number(req.params.id);
  const rep = await findReportById(id, req.user.id);
  if (!rep) return res.status(404).json({ ok: false, error: "Not found" });
  res.json({ ok: true, report: rep });
}

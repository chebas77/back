import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import { config } from "./src/config/env.js";
import passport from "./src/config/passport.js";
import authRoutes from "./src/routes/auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import rimFaceRoutes from "./src/routes/rimface.routes.js";
import alignmentRoutes from "./src/routes/alignment.routes.js"; // <-- NUEVO
import reportsRoutes from "./src/routes/report.routes.js";
import path from "path";  
import rootDashboardRoutes from "./src/routes/dashboard.routes.js";
const app = express();

app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// CORS ANTES de las rutas
app.use(cors({
  origin: config.frontendUrl,          // ej: "http://localhost:5173"
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(passport.initialize());

// Rutas
app.use("/", rootDashboardRoutes); // <-- ahora /stats y /projects/recent existen en raíz

app.use("/auth", authRoutes);
app.use("/api", userRoutes);
app.use("/api/rim-face", rimFaceRoutes);
app.use("/api/alignment", alignmentRoutes); // <-- AQUÍ

app.get("/", (_, res) => res.send("API ok"));

// Servir PDFs
app.use("/files", express.static(path.resolve("files")));

// Rutas de reportes
app.use("/api/reports", reportsRoutes); // Solo una vez

app.listen(config.port, () => {
  console.log(`Servidor corriendo en http://localhost:${config.port}`);
});

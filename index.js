import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import morgan from "morgan";
import { config } from "./src/config/env.js";
import { testConnection } from "./src/config/db.js";
import passport from "./src/config/passport.js";
import authRoutes from "./src/routes/auth.routes.js";
import userRoutes from "./src/routes/user.routes.js";
import rimFaceRoutes from "./src/routes/rimface.routes.js";
import alignmentRoutes from "./src/routes/alignment.routes.js";
import reportsRoutes from "./src/routes/report.routes.js";
import path from "path";  
import rootDashboardRoutes from "./src/routes/dashboard.routes.js";
import projectRoutes from "./src/routes/project.routes.js";
import reportSearchRoutes from "./src/routes/reportSearch.routes.js";
import notificationRoutes from "./src/routes/notification.routes.js";

const app = express();

app.use(morgan("dev"));
app.use(express.json());
app.use(cookieParser());

// CORS ANTES de las rutas
const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization", "Cookie", "Set-Cookie"],
  exposedHeaders: ["Set-Cookie"],
}));

app.use(passport.initialize());

// Rutas
app.use("/", rootDashboardRoutes); // <-- ahora /stats existe en raíz
app.use("/projects", projectRoutes);
app.use("/reports", reportSearchRoutes);

app.use("/auth", authRoutes);
app.use("/api", userRoutes);
app.use("/api/rim-face", rimFaceRoutes);
app.use("/api/alignment", alignmentRoutes); // <-- AQUÍ

app.get("/", (_, res) => res.send("API ok"));

// Servir PDFs
app.use("/files", express.static(path.resolve("files")));

// Rutas de reportes
app.use("/api/reports", reportsRoutes);

// Rutas de notificaciones
app.use("/api/notifications", notificationRoutes);

// Iniciar servidor con prueba de conexión
async function startServer() {
  console.log('\n===========================================');
  console.log('🚀 Iniciando servidor...');
  console.log('===========================================\n');
  
  // Probar conexión a la base de datos
  const dbConnected = await testConnection();
  
  if (!dbConnected) {
    console.error('\n⚠️  ADVERTENCIA: El servidor iniciará pero la base de datos no está disponible');
    console.error('   Algunas funcionalidades pueden no funcionar correctamente\n');
  }
  
  app.listen(config.port, () => {
    console.log('\n===========================================');
    console.log(`✅ Servidor corriendo en http://localhost:${config.port}`);
    console.log('===========================================\n');
  });
}

startServer().catch(err => {
  console.error('❌ Error al iniciar el servidor:', err);
  process.exit(1);
});

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

async function runMigration() {
  let connection;
  try {
    // Usar DATABASE_URL si está disponible
    let config;
    if (process.env.DATABASE_URL) {
      const url = new URL(process.env.DATABASE_URL);
      config = {
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: url.username,
        password: url.password,
        database: url.pathname.replace('/', ''),
        ssl: { rejectUnauthorized: false }
      };
    } else {
      config = {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false }
      };
    }

    // Crear conexión
    connection = await mysql.createConnection(config);

    console.log('✓ Conectado a la base de datos');

    // Leer el archivo SQL
    const sqlFile = join(__dirname, 'update-status-column.sql');
    const sql = readFileSync(sqlFile, 'utf-8');

    // Ejecutar cada statement
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'));

    for (const statement of statements) {
      console.log(`Ejecutando: ${statement.substring(0, 50)}...`);
      await connection.query(statement);
    }

    console.log('✓ Migración completada exitosamente');
  } catch (error) {
    console.error('✗ Error en la migración:', error.message);
    throw error;
  } finally {
    if (connection) {
      await connection.end();
      console.log('✓ Conexión cerrada');
    }
  }
}

runMigration().catch(console.error);

import mysql from 'mysql2/promise';
import { config } from './env.js';

const DB_NAME = config.db.name; // lo leeremos del env

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: DB_NAME, // si lleva espacio, mysql2 lo maneja; en SQL usaremos backticks
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

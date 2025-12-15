import mysql from 'mysql2/promise';
import { config } from './env.js';

let poolConfig;

// Usar DATABASE_URL si está disponible (formato Railway)
if (config.db.url) {
  const dbUrl = new URL(config.db.url);
  
  poolConfig = {
    host: dbUrl.hostname,
    port: Number(dbUrl.port) || 3306,
    user: dbUrl.username,
    password: dbUrl.password,
    database: dbUrl.pathname.slice(1), // Remover '/' inicial
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
      rejectUnauthorized: false
    }
  };
} else {
  // Fallback a credenciales individuales
  poolConfig = {
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    database: config.db.name,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  };

  if (config.db.password) {
    poolConfig.password = config.db.password;
  }

  if (config.db.host && (config.db.host.includes('railway') || config.db.host.includes('rlwy.net'))) {
    poolConfig.ssl = {
      rejectUnauthorized: false
    };
  }
}

export const pool = mysql.createPool(poolConfig);

// Función para probar la conexión
export async function testConnection() {
  try {
    console.log('🔌 Probando conexión a la base de datos...');
    console.log(`   Host: ${poolConfig.host}`);
    console.log(`   Puerto: ${poolConfig.port}`);
    console.log(`   Base de datos: ${poolConfig.database}`);
    console.log(`   Usuario: ${poolConfig.user}`);
    console.log(`   SSL: ${poolConfig.ssl ? '✓ Habilitado' : '✗ Deshabilitado'}`);
    
    const connection = await pool.getConnection();
    const [rows] = await connection.query('SELECT 1 as test, DATABASE() as db, USER() as user');
    connection.release();
    
    console.log('✅ Conexión exitosa a MySQL');
    console.log(`   Base de datos actual: ${rows[0].db}`);
    console.log(`   Usuario conectado: ${rows[0].user}`);
    return true;
  } catch (error) {
    console.error('❌ Error al conectar a la base de datos:');
    console.error(`   ${error.message}`);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Posibles soluciones:');
      console.error('   1. Verifica que las credenciales sean correctas');
      console.error('   2. En Railway, asegúrate de que tu IP esté en la whitelist');
      console.error('   3. O habilita el acceso público en Railway settings');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 El servidor MySQL no está accesible');
      console.error('   Verifica que el host y puerto sean correctos');
    }
    
    return false;
  }
}

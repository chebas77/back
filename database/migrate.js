import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from '../src/config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigration() {
  let connection;
  
  try {
    console.log('🔧 Iniciando migración de base de datos...\n');
    
    // Conectar a la base de datos
    const dbConfig = config.db.url 
      ? (() => {
          const dbUrl = new URL(config.db.url);
          return {
            host: dbUrl.hostname,
            port: Number(dbUrl.port) || 3306,
            user: dbUrl.username,
            password: dbUrl.password,
            database: dbUrl.pathname.slice(1),
            ssl: { rejectUnauthorized: false }
          };
        })()
      : {
          host: config.db.host,
          port: config.db.port,
          user: config.db.user,
          password: config.db.password,
          database: config.db.name,
          ssl: config.db.host.includes('railway') ? { rejectUnauthorized: false } : undefined
        };
    
    console.log(`📡 Conectando a ${dbConfig.host}:${dbConfig.port}...`);
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Conectado exitosamente\n');
    
    // Leer archivo SQL
    const sqlPath = path.join(__dirname, 'schema.sql');
    console.log(`📄 Leyendo archivo: ${sqlPath}`);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`📏 Tamaño del archivo: ${sql.length} caracteres\n`);
    
    // Leer archivo de notificaciones
    const notifSqlPath = path.join(__dirname, 'add-notifications.sql');
    const notifSql = fs.existsSync(notifSqlPath) 
      ? fs.readFileSync(notifSqlPath, 'utf8')
      : '';
    
    // Leer archivo de user_id en projects
    const userProjectSqlPath = path.join(__dirname, 'add-user-to-projects.sql');
    const userProjectSql = fs.existsSync(userProjectSqlPath) 
      ? fs.readFileSync(userProjectSqlPath, 'utf8')
      : '';
    
    const combinedSql = sql + '\n\n' + notifSql + '\n\n' + userProjectSql;
    
    // Remover comentarios de línea y ejecutar cada statement
    const cleanedSql = combinedSql
      .split('\n')
      .filter(line => !line.trim().startsWith('--'))
      .join('\n');
    
    const statements = cleanedSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);
    
    console.log(`📝 Ejecutando ${statements.length} statements...\n`);
    
    for (const statement of statements) {
      if (statement.includes('CREATE TABLE')) {
        const tableName = statement.match(/CREATE TABLE.*?`?(\w+)`?\s*\(/i)?.[1];
        console.log(`   📋 Creando tabla: ${tableName}`);
      }
      try {
        await connection.query(statement);
      } catch (err) {
        // Ignorar errores de duplicados (tabla/columna/índice ya existe)
        if (err.code === 'ER_TABLE_EXISTS_ERROR' || 
            err.code === 'ER_DUP_FIELDNAME' || 
            err.code === 'ER_DUP_KEYNAME' ||
            err.code === 'ER_DUP_INDEX' ||
            err.errno === 1060 || // Duplicate column name
            err.errno === 1061 || // Duplicate key name
            err.errno === 1826 || // Duplicate foreign key constraint
            err.message.includes('Duplicate') ||
            err.message.includes('already exists')) {
          console.log(`   ℹ️  Ya existe (ignorado)`);
        } else {
          console.error(`   ❌ Error en statement: ${err.message}`);
          console.error(`   Statement: ${statement.substring(0, 100)}...`);
        }
      }
    }
    
    console.log('\n✅ Migración completada exitosamente!\n');
    
    // Verificar tablas creadas
    const [tables] = await connection.query('SHOW TABLES');
    console.log('📊 Tablas existentes:');
    tables.forEach(row => {
      const tableName = Object.values(row)[0];
      console.log(`   - ${tableName}`);
    });
    
  } catch (error) {
    console.error('\n❌ Error durante la migración:');
    console.error(error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runMigration();

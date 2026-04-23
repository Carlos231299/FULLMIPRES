import 'dotenv/config';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import os from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Resolve database path (App data folder or local fallback)
const appDataPath = process.env.USER_DATA_PATH || join(os.homedir(), '.miprescoelectron');
if (!existsSync(appDataPath)) {
  mkdirSync(appDataPath, { recursive: true });
}

const dbPath = join(appDataPath, 'database.sqlite');
let dbInstance = null;

// Simulamos un "pool" de MySQL para que el modelo no tenga que cambiar drásticamente
const pool = {
  getConnection: async () => {
    if (!dbInstance) {
      dbInstance = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });
    }
    return {
      release: () => {}, // No-op en SQLite
    };
  },
  query: async (sql, params = []) => {
    if (!dbInstance) {
      dbInstance = await open({ filename: dbPath, driver: sqlite3.Database });
    }
    
    // SQLite distingue entre 'all' (leer) y 'run' (escribir)
    // Extraemos la instrucción principal
    const command = sql.trim().toUpperCase();
    if (command.startsWith('SELECT')) {
      const rows = await dbInstance.all(sql, params);
      return [rows]; // Retorna un array con el primer elemento como las filas (como mysql2)
    } else {
      const result = await dbInstance.run(sql, params);
      return [{ insertId: result.lastID, affectedRows: result.changes }]; // Retorna el info de inserción (como mysql2)
    }
  }
};

// ── Verifica la conexión ─────────────────────────────────────
export async function testConnection() {
  try {
    await pool.getConnection();
    console.log('✅ Base de datos SQLite inicializada en:', dbPath);
  } catch (error) {
    console.error('❌ Error conectando a SQLite:', error.message);
    process.exit(1);
  }
}

// ── Ejecuta el schema SQL (creación de tablas) ───────────────
export async function runMigrations() {
  try {
    const schemaPath = join(__dirname, 'schema.sql');
    const sqlCommands = readFileSync(schemaPath, 'utf8');

    if (!dbInstance) {
      dbInstance = await open({ filename: dbPath, driver: sqlite3.Database });
    }

    // Ejecuta múltiples sentencias
    await dbInstance.exec(sqlCommands);
    console.log('✅ Migraciones ejecutadas — tabla procesos_mipres lista (SQLite)');
  } catch (error) {
    console.error('❌ Error en migraciones de SQLite:', error.message);
    process.exit(1);
  }
}

export default pool;

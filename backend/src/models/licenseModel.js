import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const appDataPath = process.env.USER_DATA_PATH || path.join(os.homedir(), '.miprescoelectron');
const dbPath = path.join(appDataPath, 'licencias.json');

async function initDb() {
  try {
    await fs.mkdir(appDataPath, { recursive: true });
    try {
      await fs.access(dbPath);
    } catch {
      // Iniciamos con una lista vacía (nadie tiene licencia)
      await fs.writeFile(dbPath, JSON.stringify([]));
    }
  } catch (err) {
    console.error('Error inicializando DB de Licencias', err);
  }
}

async function getLicenses() {
  await initDb();
  const data = await fs.readFile(dbPath, 'utf8');
  return JSON.parse(data);
}

/**
 * Verifica si un NIT tiene una licencia activa.
 */
export async function checkLicense(nit) {
  const licenses = await getLicenses();
  const license = licenses.find(l => String(l.nit) === String(nit));
  
  const defaultMsg = 'Su suscripción de Mipres Automatic no está activa o ha vencido. Por favor, contacte al administrador para renovar su acceso.';

  if (!license) return { active: false, message: defaultMsg };
  if (license.estado !== 'ACTIVO') return { active: false, message: 'Su acceso ha sido suspendido temporalmente. Contacte a soporte técnico.' };
  
  // Opcional: verificar expiración
  if (license.expira_en && new Date(license.expira_en) < new Date()) {
    return { active: false, message: 'Su licencia de uso ha expirado. Por favor renueve su suscripción.' };
  }

  return { active: true };
}

/**
 * Agrega o actualiza una licencia (para uso administrativo futuro)
 */
export async function upsertLicense(nit, estado = 'ACTIVO', expira_en = null) {
  const licenses = await getLicenses();
  const index = licenses.findIndex(l => String(l.nit) === String(nit));
  
  const newLicense = {
    nit,
    estado,
    expira_en,
    updated_at: new Date().toISOString()
  };

  if (index !== -1) {
    licenses[index] = { ...licenses[index], ...newLicense };
  } else {
    newLicense.created_at = new Date().toISOString();
    licenses.push(newLicense);
  }

  await fs.writeFile(dbPath, JSON.stringify(licenses, null, 2));
  return newLicense;
}

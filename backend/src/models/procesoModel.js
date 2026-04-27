import { promises as fs } from 'fs';
import path, { dirname } from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

// ── SISTEMA DE ALMACENAMIENTO JSON PURO ──────────────────────
// Esto garantiza 100% de compatibilidad en cualquier computadora
// sin necesidad de instalar motores de bases de datos ni C++.

const appDataPath = process.env.USER_DATA_PATH || path.join(os.homedir(), '.miprescoelectron');
const dbPath = path.join(appDataPath, 'procesos.json');

async function initDb() {
  try {
    await fs.mkdir(appDataPath, { recursive: true });
    try {
      await fs.access(dbPath);
    } catch {
      await fs.writeFile(dbPath, JSON.stringify([]));
    }
  } catch (err) {
    console.error('Error inicializando DB JSON', err);
  }
}

async function getDb() {
  await initDb();
  const data = await fs.readFile(dbPath, 'utf8');
  return JSON.parse(data);
}

async function saveDb(data) {
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2));
}

// ── Obtener todos los procesos ───────────────────────────────
export async function getAll() {
  const db = await getDb();
  return db.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

// ── Obtener un proceso por id_local ──────────────────────────
export async function getById(id) {
  const db = await getDb();
  return db.find(p => String(p.id_local) === String(id)) || null;
}

// ── Crear nuevo proceso (estado INICIADO) ────────────────────
export async function create({ nit, token }) {
  const db = await getDb();
  const newId = db.length > 0 ? Math.max(...db.map(p => Number(p.id_local))) + 1 : 1;
  const newProcess = {
    id_local: newId,
    nit,
    token,
    estado: 'INICIADO',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  db.push(newProcess);
  await saveDb(db);
  return newId;
}

// ── Actualizar campos del proceso ────────────────────────────
export async function update(id, fields) {
  const db = await getDb();
  const index = db.findIndex(p => String(p.id_local) === String(id));
  if (index === -1) return false;

  const allowed = [
    'id_mipres', 'id_programacion', 'id_entrega', 'id_reporte',
    'estado', 'token', 'nit', 'no_prescripcion',
    'cod_ser_tec_a_entregar', 'cant_tot_a_entregar',
    'fec_max_ent', 'disponibles'
  ];

  let updated = false;
  for (const key of allowed) {
    if (fields[key] !== undefined) {
      db[index][key] = fields[key];
      updated = true;
    }
  }

  if (updated) {
    db[index].updated_at = new Date().toISOString();
    await saveDb(db);
    return true;
  }
  return false;
}

// ── Upsert inteligente desde SISPRO para sincronización con el Wizard ──
export async function upsertFromSispro({ nit, token, no_prescripcion, data }) {
  const db = await getDb();
  
  // 1. Identificar IDs clave del registro de SISPRO (Robustez contra variaciones de etiquetas de SISPRO)
  const idMipres = String(data.IdDireccionamiento || data.IDDireccionamiento || data.ID || '');
  const idProg   = String(data.IdProgramacion || data.IDProgramacion || '');
  const idEnt    = String(data.IdEntrega || data.IDEntrega || '');
  const idRep    = String(data.IdReporteEntrega || data.IDReporteEntrega || data.IdReporte || data.IDReporte || '');

  // 2. Determinar estado lógico basado en los IDs presentes
  let estado = 'VERIFICADO'; // Por defecto si tiene IdDireccionamiento
  if (idRep) estado = 'REPORTADO';
  else if (idEnt) estado = 'ENTREGADO';
  else if (idProg) estado = 'PROGRAMADO';

  // 3. Buscar proceso existente por ID Direccionamiento de SISPRO
  let processIndex = db.findIndex(p => p.id_mipres === idMipres);
  let idLocal;

  if (processIndex !== -1) {
    // Actualizar proceso existente
    const p = db[processIndex];
    p.id_programacion = idProg || p.id_programacion;
    p.id_entrega = idEnt || p.id_entrega;
    p.id_reporte = idRep || p.id_reporte;
    p.estado = estado; 
    p.updated_at = new Date().toISOString();
    idLocal = p.id_local;
  } else {
    // Crear nuevo proceso "artificial" importado
    idLocal = db.length > 0 ? Math.max(...db.map(p => Number(p.id_local))) + 1 : 1;
    const newProcess = {
      id_local: idLocal,
      nit,
      token,
      no_prescripcion,
      id_mipres: idMipres,
      id_programacion: idProg || null,
      id_entrega: idEnt || null,
      id_reporte: idRep || null,
      estado,
      cod_ser_tec_a_entregar: data.CodSerTecAEntregar || null,
      cant_tot_a_entregar: Number(data.CantTotAEntregar || 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    db.push(newProcess);
  }

  await saveDb(db);
  return await getById(idLocal);
}


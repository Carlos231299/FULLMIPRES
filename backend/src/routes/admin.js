import { Router } from 'express';
import * as License from '../models/licenseModel.js';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

// Middleware de seguridad para el panel de admin
const adminAuth = (req, res, next) => {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  const providedUser = req.headers['x-admin-user'];
  const providedPassword = req.headers['x-admin-password'];

  if (providedUser !== adminUser || providedPassword !== adminPassword) {
    return res.status(401).json({ ok: false, error: 'Acceso no autorizado al panel administrativo.' });
  }
  next();
};

// Verificar credenciales de admin (Login)
router.post('/login', (req, res) => {
  const { user, password } = req.body;
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (user === adminUser && password === adminPassword) {
    res.json({ ok: true, message: 'Autenticación exitosa' });
  } else {
    res.status(401).json({ ok: false, error: 'Usuario o contraseña incorrectos' });
  }
});

// Obtener todas las licencias
router.get('/licenses', adminAuth, async (req, res) => {
  try {
    const appDataPath = process.env.USER_DATA_PATH || path.join(os.homedir(), '.miprescoelectron');
    const dbPath = path.join(appDataPath, 'licencias.json');
    
    let licenses = [];
    try {
      const data = await fs.readFile(dbPath, 'utf8');
      licenses = JSON.parse(data);
    } catch (e) {
      licenses = [];
    }
    
    res.json({ ok: true, data: licenses });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Agregar o actualizar licencia
router.post('/licenses', adminAuth, async (req, res) => {
  try {
    const { nit, estado, expira_en } = req.body;
    if (!nit) return res.status(400).json({ ok: false, error: 'El NIT es obligatorio.' });

    const license = await License.upsertLicense(nit, estado, expira_en);
    res.json({ ok: true, data: license });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Eliminar licencia
router.delete('/licenses/:nit', adminAuth, async (req, res) => {
  try {
    const { nit } = req.params;
    const appDataPath = process.env.USER_DATA_PATH || path.join(os.homedir(), '.miprescoelectron');
    const dbPath = path.join(appDataPath, 'licencias.json');
    
    let licenses = [];
    try {
      const data = await fs.readFile(dbPath, 'utf8');
      licenses = JSON.parse(data);
    } catch (e) {
      return res.status(404).json({ ok: false, error: 'No hay licencias registradas.' });
    }

    const filtered = licenses.filter(l => String(l.nit) !== String(nit));
    await fs.writeFile(dbPath, JSON.stringify(filtered, null, 2));
    
    res.json({ ok: true, message: 'Licencia eliminada correctamente.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

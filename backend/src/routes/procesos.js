import { Router } from 'express';
import {
  listar,
  obtener,
  crear,
  actualizar,
} from '../controllers/procesosController.js';

const router = Router();

// GET    /api/procesos        → lista todos los procesos
router.get('/',        listar);

// GET    /api/procesos/:id    → obtiene un proceso por id_local
router.get('/:id',     obtener);

// POST   /api/procesos        → crea nuevo proceso (INICIADO)
router.post('/',       crear);

// PUT    /api/procesos/:id    → actualiza campos del proceso
router.put('/:id',     actualizar);

export default router;

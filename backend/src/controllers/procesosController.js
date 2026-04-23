import * as Proceso from '../models/procesoModel.js';

// ── GET /api/procesos ────────────────────────────────────────
export async function listar(req, res) {
  try {
    const procesos = await Proceso.getAll();
    res.json({ ok: true, data: procesos });
  } catch (err) {
    console.error('[listar]', err.message);
    res.status(500).json({ ok: false, error: 'Error obteniendo procesos' });
  }
}

// ── GET /api/procesos/:id ────────────────────────────────────
export async function obtener(req, res) {
  try {
    const proceso = await Proceso.getById(req.params.id);
    if (!proceso) {
      return res.status(404).json({ ok: false, error: 'Proceso no encontrado' });
    }
    res.json({ ok: true, data: proceso });
  } catch (err) {
    console.error('[obtener]', err.message);
    res.status(500).json({ ok: false, error: 'Error obteniendo proceso' });
  }
}

// ── POST /api/procesos ───────────────────────────────────────
// Crea un proceso nuevo en estado INICIADO
export async function crear(req, res) {
  try {
    const { nit, token } = req.body;

    if (!nit || !token) {
      return res.status(400).json({ ok: false, error: 'nit y token son requeridos' });
    }

    const id = await Proceso.create({ nit, token });
    const proceso = await Proceso.getById(id);
    res.status(201).json({ ok: true, data: proceso });
  } catch (err) {
    console.error('[crear]', err.message);
    res.status(500).json({ ok: false, error: 'Error creando proceso' });
  }
}

// ── PUT /api/procesos/:id ────────────────────────────────────
// Actualiza campos específicos del proceso (por paso del wizard)
export async function actualizar(req, res) {
  try {
    const { id } = req.params;
    const proceso = await Proceso.getById(id);

    if (!proceso) {
      return res.status(404).json({ ok: false, error: 'Proceso no encontrado' });
    }

    await Proceso.update(id, req.body);
    const actualizado = await Proceso.getById(id);
    res.json({ ok: true, data: actualizado });
  } catch (err) {
    console.error('[actualizar]', err.message);
    res.status(500).json({ ok: false, error: 'Error actualizando proceso' });
  }
}

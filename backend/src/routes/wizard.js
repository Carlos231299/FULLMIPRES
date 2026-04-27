import { Router } from 'express';
import * as MipresApi from '../services/mipresApi.js';
import * as Proceso from '../models/procesoModel.js';
import * as License from '../models/licenseModel.js';

const router = Router();

// ============================================================
// PASO 1 - Generar Token (GET SISPRO)
// ============================================================
router.post('/token', async (req, res) => {
  try {
    const { nit, tokenBase } = req.body;
    if (!nit || !tokenBase) {
      return res.status(400).json({ ok: false, error: 'nit y tokenBase son requeridos' });
    }

    // ── VALIDACIÓN DE LICENCIA WEB ──────────────────────────
    const licenseCheck = await License.checkLicense(nit);
    if (!licenseCheck.active) {
      return res.status(403).json({ 
        ok: false, 
        error: licenseCheck.message || 'Este NIT no cuenta con una licencia activa para la versión Web.' 
      });
    }

    const tokenData = await MipresApi.generarToken(nit, tokenBase);
    const token = typeof tokenData === 'string' ? tokenData : JSON.stringify(tokenData);
    const id = await Proceso.create({ nit, token });
    const proceso = await Proceso.getById(id);
    res.status(201).json({ ok: true, data: { proceso, tokenRaw: tokenData } });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data || err.message;
    res.status(status).json({ ok: false, error: message });
  }
});

// ============================================================
// PASO 2 - Verificar (Reporte Entrega) y Filtrar (Direccionamiento)
// ============================================================
router.post('/:id/verificar-direccionamiento', async (req, res) => {
  try {
    const proceso = await Proceso.getById(req.params.id);
    if (!proceso) return res.status(404).json({ ok: false, error: 'Proceso no encontrado' });
    if (!proceso.token) return res.status(400).json({ ok: false, error: 'Falta token' });

    const { NoPrescripcion } = req.body;
    if (!NoPrescripcion) return res.status(400).json({ ok: false, error: 'NoPrescripcion es requerida' });

    // Consulta simple del direccionamiento en SISPRO (sin deep sync)
    const dirs = await MipresApi.getDireccionamientoXPrescripcion(proceso.nit, proceso.token, NoPrescripcion);
    const allDirs = Array.isArray(dirs) ? dirs : [];

    if (allDirs.length === 0) {
      return res.status(404).json({ ok: false, error: 'No se encontraron direccionamientos para esta prescripción en SISPRO.' });
    }

    // Usar el primer direccionamiento disponible como base
    const dirSelect = allDirs[0];

    // Sincronizar con la base de datos local (solo datos básicos del direccionamiento)
    const procesoSincronizado = await Proceso.upsertFromSispro({
      nit: proceso.nit,
      token: proceso.token,
      no_prescripcion: NoPrescripcion,
      data: dirSelect
    });

    // Guardar el listado completo de direccionamientos disponibles
    await Proceso.update(procesoSincronizado.id_local, {
      disponibles: JSON.stringify(allDirs)
    });

    const actualizado = await Proceso.getById(procesoSincronizado.id_local);
    res.json({ ok: true, data: { proceso: actualizado, mipresResponse: dirSelect } });
  } catch (err) {
    console.error('[Error en Verificacion Direccionamiento]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ============================================================
// SALTAR PASO (Ya realizado en SISPRO)
// Consulta SISPRO para obtener el ID del paso existente,
// lo guarda en la BD y permite avanzar al siguiente paso.
// ============================================================
router.post('/:id/skip-step', async (req, res) => {
  try {
    const proceso = await Proceso.getById(req.params.id);
    if (!proceso) return res.status(404).json({ ok: false, error: 'Proceso no encontrado' });

    const { step } = req.body;
    const noPres = proceso.no_prescripcion;

    if (!noPres) {
      return res.status(400).json({ ok: false, error: 'No hay prescripción asociada al proceso. Regresa al paso anterior.' });
    }

    if (step === 3) {
      // Buscar programación existente en SISPRO
      const progs = await MipresApi.getProgramacionXPrescripcion(proceso.nit, proceso.token, noPres);
      const prog = Array.isArray(progs) && progs.length > 0 ? progs[0] : null;
      if (!prog) return res.status(404).json({ ok: false, error: 'No se encontró programación en SISPRO para esta prescripción.' });

      const idProg = String(prog.IdProgramacion || prog.IDProgramacion || prog.ID || '');
      await Proceso.update(proceso.id_local, { id_programacion: idProg, estado: 'PROGRAMADO' });

    } else if (step === 4) {
      // Buscar entrega existente en SISPRO
      const ents = await MipresApi.getEntregaXPrescripcion(proceso.nit, proceso.token, noPres);
      const ent = Array.isArray(ents) && ents.length > 0 ? ents[0] : null;
      if (!ent) return res.status(404).json({ ok: false, error: 'No se encontró entrega en SISPRO para esta prescripción.' });

      const idEnt = String(ent.IdEntrega || ent.IDEntrega || ent.ID || '');
      await Proceso.update(proceso.id_local, { id_entrega: idEnt, estado: 'ENTREGADO' });

    } else if (step === 5) {
      // Buscar reporte existente en SISPRO
      const reps = await MipresApi.getReporteEntregaXPrescripcion(proceso.nit, proceso.token, noPres);
      const rep = Array.isArray(reps) && reps.length > 0 ? reps[0] : null;
      if (!rep) return res.status(404).json({ ok: false, error: 'No se encontró reporte en SISPRO para esta prescripción.' });

      const idRep = String(rep.IdReporteEntrega || rep.IDReporteEntrega || rep.ID || '');
      await Proceso.update(proceso.id_local, { id_reporte: idRep, estado: 'REPORTADO' });

    } else {
      return res.status(400).json({ ok: false, error: `Paso ${step} no es válido para saltar.` });
    }

    const actualizado = await Proceso.getById(proceso.id_local);
    res.json({ ok: true, data: { proceso: actualizado } });
  } catch (err) {
    console.error('[Error en Skip Step]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});



// ============================================================
// PASO 3 - Programacion con Payload Fijo y Automatizado
// ============================================================
router.put('/:id/programacion', async (req, res) => {
  try {
    const proceso = await Proceso.getById(req.params.id);
    if (!proceso || !proceso.id_mipres) return res.status(400).json({ ok: false, error: 'Faltan datos del paso 2' });

    const payload = {
      ID: Number(req.body.ID || proceso.id_mipres),
      FecMaxEnt: req.body.FecMaxEnt || proceso.fec_max_ent, // Usa la seleccionada o la oficial
      TipoIDSedeProv: req.body.TipoIDSedeProv || 'NI',
      NoIDSedeProv: req.body.NoIDSedeProv || '57304482',
      CodSedeProv: req.body.CodSedeProv || 'PROV008934',
      CodSerTecAEntregar: String(req.body.CodSerTecAEntregar || proceso.cod_ser_tec_a_entregar || ''),
      CantTotAEntregar: String(req.body.CantTotAEntregar || proceso.cant_tot_a_entregar || '0')
    };

    // Si el usuario seleccionó un direccionamiento diferente en el frontend, lo actualizamos localmente
    if (String(payload.ID) !== String(proceso.id_mipres)) {
      await Proceso.update(proceso.id_local, {
        id_mipres: String(payload.ID),
        fec_max_ent: payload.FecMaxEnt,
        cod_ser_tec_a_entregar: payload.CodSerTecAEntregar,
        cant_tot_a_entregar: Number(payload.CantTotAEntregar)
      });
      proceso.id_mipres = payload.ID;
    }

    const result = await MipresApi.programacion(proceso.nit, proceso.token, payload);
    const resData = Array.isArray(result) ? result[0] : result || {};
    console.log('[MIPRES] Respuesta Programacion ->', resData);

    await Proceso.update(proceso.id_local, {
      id_programacion: String(resData?.IdProgramacion || resData?.Id || resData?.id || ''),
      estado: 'PROGRAMADO',
      log: JSON.stringify(result) // Guardar respuesta completa
    });
    const actualizado = await Proceso.getById(proceso.id_local);
    res.json({ ok: true, data: { proceso: actualizado, mipresResponse: result } });
  } catch (err) {
    const status = err.response?.status || 500;
    res.status(status).json({ ok: false, error: err.message });
  }
});

// ============================================================
// PASO 4 - Entrega
// ============================================================
router.put('/:id/entrega', async (req, res) => {
  try {
    const proceso = await Proceso.getById(req.params.id);
    if (!proceso) return res.status(404).json({ ok: false, error: 'Proceso no encontrado en DB.' });

    let payload = {
      ID: Number(req.body.ID || proceso.id_mipres),
      CodSerTecEntregado: String(req.body.CodSerTecEntregado || proceso.cod_ser_tec_a_entregar || ''),
      CantTotEntregada: String(req.body.CantTotEntregada || proceso.cant_tot_a_entregar || '0'),
      EntTotal: Number(req.body.EntTotal || 1),
      CausaNoEntrega: Number(req.body.CausaNoEntrega || 0),
      FecEntrega: req.body.FecEntrega,
      NoLote: String(req.body.NoLote || ''),
      TipoIDRecibe: String(req.body.TipoIDRecibe || req.body.TipoIDPaciente || 'CC'),
      NoIDRecibe: String(req.body.NoIDRecibe || req.body.NoIDPaciente || '')
    };

    // LIMPIEZA PARA NO ENTREGA: SISPRO prohíbe ciertos campos si CausaNoEntrega != 0
    if (payload.CausaNoEntrega !== 0) {
      delete payload.CodSerTecEntregado;
      delete payload.CantTotEntregada;
      delete payload.EntTotal;
      delete payload.NoLote;
      delete payload.TipoIDRecibe;
      delete payload.NoIDRecibe;
      // SISPRO a veces también rechaza FecEntrega si hay causal, pero ID es obligatorio
    }

    const result = await MipresApi.entrega(proceso.nit, proceso.token, payload);
    const resData = Array.isArray(result) ? result[0] : result || {};
    console.log('[MIPRES] Respuesta Entrega ->', resData);

    await Proceso.update(proceso.id_local, {
      id_entrega: String(resData?.IdEntrega || resData?.Id || resData?.id || ''),
      estado: 'ENTREGADO',
      log: JSON.stringify(result) // Guardar respuesta completa
    });
    const actualizado = await Proceso.getById(proceso.id_local);
    res.json({ ok: true, data: { proceso: actualizado, mipresResponse: result } });
  } catch (err) {
    console.error('[Error en Entrega]', err);
    const status = err.response?.status || 500;
    const msg = err.response?.data || err.message;
    res.status(status).json({ ok: false, error: msg, stack: err.stack, axiosData: err.response?.data });
  }
});

// ============================================================
// PASO 5 - Reporte
// ============================================================
router.put('/:id/reporte', async (req, res) => {
  try {
    const proceso = await Proceso.getById(req.params.id);
    if (!proceso) return res.status(404).json({ ok: false, error: 'Proceso no encontrado en DB.' });

    let payload = {
      ID: Number(req.body.ID || proceso.id_mipres),
      EstadoEntrega: Number(req.body.EstadoEntrega ?? 1),
      CausaNoEntrega: Number(req.body.EstadoEntrega) === 1 ? 0 : Number(req.body.CausaNoEntrega || 0),
      ValorEntregado: String(req.body.ValorEntregado || '0')
    };

    // LIMPIEZA PARA REPORTE NO EFECTIVO (Causa 7 y similares)
    if (payload.CausaNoEntrega > 0) {
      delete payload.EstadoEntrega; // SISPRO prohíbe este campo si hay causal 7
      delete payload.ValorEntregado; // SISPRO prohíbe este campo si hay causal 7
   }

    const result = await MipresApi.reporteEntrega(proceso.nit, proceso.token, payload);
    const resData = Array.isArray(result) ? result[0] : result || {};
    console.log('[MIPRES] Respuesta Reporte ->', resData);

    await Proceso.update(proceso.id_local, {
      id_reporte: String(resData?.IdReporteEntrega || resData?.IdReporte || resData?.Id || resData?.id || ''),
      estado: 'REPORTADO',
      log: JSON.stringify(result) // Guardar respuesta completa
    });
    const actualizado = await Proceso.getById(proceso.id_local);
    res.json({ ok: true, data: { proceso: actualizado, mipresResponse: result } });
  } catch (err) {
    const status = err.response?.status || 500;
    const msg = err.response?.data || err.message;
    res.status(status).json({ ok: false, error: msg });
  }
});

// ============================================================
// SINCRONIZACION DESDE SISPRO (Abrir en Asistente)
// ============================================================
router.post('/sync-from-sispro', async (req, res) => {
  try {
    const { nit, token, no_prescripcion, sisproRecord } = req.body;
    if (!nit || !token || !no_prescripcion || !sisproRecord) {
      return res.status(400).json({ ok: false, error: 'Faltan campos (nit, token, no_prescripcion, sisproRecord)' });
    }

    const proceso = await Proceso.upsertFromSispro({
      nit,
      token,
      no_prescripcion,
      data: sisproRecord
    });

    res.json({ ok: true, data: { proceso } });
  } catch (err) {
    console.error('[Error Sync SISPRO]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

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

    // 1. Obtener IDs ya entregados (para omitirlos)
    let deliveredIds = [];
    try {
      const reporte = await MipresApi.getReporteEntregaXPrescripcion(proceso.nit, proceso.token, NoPrescripcion);
      if (Array.isArray(reporte)) {
        deliveredIds = reporte.map(item => item.ID || item.IdEntrega);
      }
    } catch (e) {
      console.warn('Sin reporte previo de entrega');
    }

    // 2. Consultar todos los direccionamientos de la prescripcion
    const allDirs = await MipresApi.getDireccionamientoXPrescripcion(proceso.nit, proceso.token, NoPrescripcion);
    if (!allDirs || !Array.isArray(allDirs) || allDirs.length === 0) {
      return res.status(404).json({ ok: false, error: 'No hay direccionamientos para esta prescripcion' });
    }

    // 3. LOGICA OMITIR: Filtrar direccionamientos ya entregados Y los anulados (FecAnulacion != null)
    const validDirs = allDirs.filter(dir => {
      const yaEntregado = deliveredIds.includes(dir.ID || dir.IdDireccionamiento);
      const estaAnulado = dir.FecAnulacion !== null && dir.FecAnulacion !== undefined && dir.FecAnulacion !== '';
      return !yaEntregado && !estaAnulado;
    });
    if (validDirs.length === 0) {
      return res.status(400).json({ ok: false, error: 'Todas las entregas para esta prescripcion ya fueron realizadas previamente' });
    }

    // Tomamos el primer item valido para continuar
    const dir = validDirs[0];

    // 4. Actualizar Base de Datos con el direccionamiento filtrado
    await Proceso.update(proceso.id_local, {
      id_mipres: String(dir.ID || dir.Id || dir.IdDireccionamiento),
      no_prescripcion: NoPrescripcion,
      cod_ser_tec_a_entregar: String(dir.CodSerTecAEntregar || ''),
      cant_tot_a_entregar: Number(dir.CantTotAEntregar || 0),
      fec_max_ent: String(dir.FecMaxEnt || ''), // Nueva automatización: Fecha oficial de SISPRO
      disponibles: JSON.stringify(validDirs), // Nueva automatización: Todos los disponibles
      estado: 'VERIFICADO',
    });

    const actualizado = await Proceso.getById(proceso.id_local);
    res.json({ ok: true, data: { proceso: actualizado, mipresResponse: dir, totalValidos: validDirs.length } });
  } catch (err) {
    const status = err.response?.status || 500;
    const message = err.response?.data || err.message;
    res.status(status).json({ ok: false, error: message });
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
    let payload = {
      ID: Number(proceso.id_mipres),
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

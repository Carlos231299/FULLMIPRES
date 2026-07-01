import { Router } from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import * as MipresApi from '../services/mipresApi.js';
import * as Proceso from '../models/procesoModel.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper: extraer digitos puros para VR TOTAL (elimina espacios, puntos, comas, letras)
const parseCurrency = (val) => {
  if (!val) return '0';
  return String(val).replace(/\D/g, '') || '0';
};

// Helper: Búsqueda insensible de llaves en objetos JSON
const findInObj = (obj, search) => {
  if (!obj) return null;
  const key = Object.keys(obj).find(k => k.toUpperCase() === search.toUpperCase());
  return key ? obj[key] : null;
};

// Helper: Delay para no saturar la API
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Helper: convertir fecha Excel Nativa o String "DD/MM/YYYY" a "YYYY-MM-DD"
const parseDate = (val) => {
  if (!val) return '';
  // Si ya es un objeto Date de JS (sucede con cellDates: true)
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  // Si es número (formato fecha de excel nativo serial)
  if (typeof val === 'number') {
    // excel epoch starts at 1/1/1900
    const date = new Date((val - (25567 + 2)) * 86400 * 1000);
    return date.toISOString().split('T')[0];
  }
  // Si es string "DD/MM/YYYY"
  const str = String(val).trim();
  const parts = str.split('/');
  if (parts.length === 3) {
    // partes: [DD, MM, YYYY] -> "YYYY-MM-DD"
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return str; // Fallback
};

// ============================================================
// CARGA MASIVA - EXCEL
// ============================================================
router.post('/excel', upload.single('archivo'), async (req, res) => {
  try {
    const { nit, token } = req.body;

    if (!req.file) return res.status(400).json({ ok: false, error: 'No se envió ningún archivo Excel.' });
    if (!nit || !token) return res.status(400).json({ ok: false, error: 'NIT y Token son requeridos para la carga masiva.' });

    // 1. Usar el token proveído desde la sesión global
    // (ya generado en Fase 1)

    // 2. Leer Excel desde la memoria (buffer)
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    // Convertir la hoja a JSON
    let rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (rows.length === 0) {
      return res.status(400).json({ ok: false, error: 'El archivo Excel está vacío.' });
    }

    // Identificar de forma flexible o estricta el nombre de las columnas originales para devolverlas exactas
    // Convertimos temporalmente todas las llaves a minúsculas y eliminamos espacios por completo
    const sanitizeKey = (k) => String(k).trim().toUpperCase().replace(/\s+/g, '');

    // 3. Procesamiento en Lote
    for (const [index, row] of rows.entries()) {
      try {
        // Encontrar llaves exactas sin importar espacios al final usando map temporal
        const rowKeys = Object.keys(row);
        const findKey = (search) => rowKeys.find(k => sanitizeKey(k).includes(sanitizeKey(search)));

        const keyNoMipres = findKey('N°MIPRES') || findKey('PRESCRIPCION');
        const keyCodTec = findKey('CODIGOTEC') || findKey('CODTEC');
        const keyCant = findKey('CANT');
        const keyNoEntrega = findKey('NOENTREGA') || findKey('ENTREGA');
        const keyFecEntrega = findKey('FECHADEENTREGA') || findKey('FECHA');
        const keyCcRecibe = findKey('CCQUERECIBE') || findKey('CCRECIBE');
        const keyVrTotal = findKey('VRTOTAL') || findKey('VALORTOTAL');
        const keyCausaNo = findKey('CAUSANOENTREGA') || findKey('CAUSANO');

        // Extraer valores crudos
        const noPrescripcion = String(row[keyNoMipres] || '').trim();
        const codSerTec = String(row[keyCodTec] || '').trim();
        const cantidad = String(row[keyCant] || '').trim();
        const numEntrega = Number(row[keyNoEntrega]) || 1; // Fallback a 1 si el excel lo omite
        const fechaEntrega = parseDate(row[keyFecEntrega]);
        const ccRecibe = String(row[keyCcRecibe] || '').trim();
        const vrTotal = parseCurrency(row[keyVrTotal]);
        const causaNoEntrega = Number(row[keyCausaNo]) || 0;

        if (!noPrescripcion) {
          row['Log_Sistema'] = 'Omitido: N° MIPRES vacío';
          continue;
        }

        // --- PASO 2: SINCRONIZACIÓN PROFUNDA (Deep Sync) ---
        // Verificamos el rastro más avanzado en SISPRO para esta fila
        const [resProgs, resEnts, resReps] = await Promise.all([
          MipresApi.getProgramacionXPrescripcion(nit, token, noPrescripcion).catch(() => []),
          MipresApi.getEntregaXPrescripcion(nit, token, noPrescripcion).catch(() => []),
          MipresApi.getReporteEntregaXPrescripcion(nit, token, noPrescripcion).catch(() => [])
        ]);

        const allDirs = await MipresApi.getDireccionamientoXPrescripcion(nit, token, noPrescripcion);
        if (!allDirs || !Array.isArray(allDirs) || allDirs.length === 0) {
          row['Log_Sistema'] = `Error: No se encontraron direccionamientos base en SISPRO.`;
          continue;
        }

        // Buscar el direccionamiento exacto
        const dirSelect = allDirs.find(d =>
          String(d.CodSerTecAEntregar).trim() === codSerTec &&
          Number(d.NoEntrega) === numEntrega &&
          (d.FecAnulacion === null || d.FecAnulacion === undefined || d.FecAnulacion === '')
        );

        if (!dirSelect) {
          row['Log_Sistema'] = `Error: La entrega #${numEntrega} del ítem ${codSerTec} no existe o está anulada.`;
          continue;
        }

        const idDireccionamiento = String(dirSelect.IDDireccionamiento || dirSelect.IdDireccionamiento || dirSelect.IDDIRECCIONAMIENTO || '');
        const idRegistro = String(dirSelect.ID || dirSelect.Id || '');
        
        // El ID principal para MOSTRAR será el de direccionamiento, 
        // pero para OPERAR con SISPRO debemos usar el de registro.
        row['ID_Direccionamiento'] = idDireccionamiento || idRegistro;

        // Buscar matches en los estados avanzados (Validación doble: por IdDireccionamiento o por ID de registro)
        const matchRep = Array.isArray(resReps) && resReps.find(r => 
          String(r.IdDireccionamiento || r.IDDireccionamiento || '') === idDireccionamiento || 
          String(r.ID || r.Id || '') === idRegistro
        );
        const matchEnt = Array.isArray(resEnts) && resEnts.find(e => 
          String(e.IdDireccionamiento || e.IDDireccionamiento || '') === idDireccionamiento || 
          String(e.ID || e.Id || '') === idRegistro
        );
        const matchProg = Array.isArray(resProgs) && resProgs.find(p => 
          String(p.IdDireccionamiento || p.IDDireccionamiento || '') === idDireccionamiento || 
          String(p.ID || p.Id || '') === idRegistro
        );

        // Si ya está reportado, terminamos con éxito para esta fila
        if (matchRep) {
          row['ID_Programacion'] = String(matchProg?.IdProgramacion || matchProg?.IDProgramacion || matchProg?.ID || '');
          row['ID_Entrega'] = String(matchEnt?.IdEntrega || matchEnt?.IDEntrega || matchEnt?.ID || '');
          const realIdRep = String(matchRep.IdReporteEntrega || matchRep.IDReporteEntrega || matchRep.IdReporte || matchRep.ID || '');
          row['ID_Reporte'] = realIdRep;
          row['Log_Sistema'] = `✅ Ya estaba reportado (ID: ${realIdRep})`;
          continue;
        }

        // --- PASO 3: Programación (Saltar si ya existe) ---
        let idProgramacion = matchProg?.IdProgramacion || matchProg?.ID || '';
        if (!idProgramacion) {
          try {
            const payloadProg = {
              ID: Number(idRegistro),
              FecMaxEnt: String(dirSelect.FecMaxEnt || ''),
              TipoIDSedeProv: 'NI',
              NoIDSedeProv: nit,
              CodSedeProv: 'PROV008934',
              CodSerTecAEntregar: codSerTec,
              CantTotAEntregar: String(cantidad || dirSelect.CantTotAEntregar || '0')
            };
            const resProg = await MipresApi.programacion(nit, token, payloadProg);
            const progData = Array.isArray(resProg) ? resProg[0] : resProg || {};
            idProgramacion = String(progData.IdProgramacion || progData.Id || '');
          } catch (errProg) {
            const status = errProg.response?.status;
            if (status === 422 || status === 400) {
              row['Problemas_encontrados_Programacion'] = 'Detectado previo';
              // Intentar recuperar el ID real de la programación si ya existía
              try {
                const checkProgs = await MipresApi.getProgramacionXPrescripcion(nit, token, noPrescripcion);
                const pMatch = Array.isArray(checkProgs) && checkProgs.find(p => String(p.IdDireccionamiento || p.IDDireccionamiento) === String(idDireccionamiento));
                if (pMatch) idProgramacion = String(pMatch.IdProgramacion || pMatch.IDProgramacion || pMatch.ID || '');
              } catch (e) { /* ignore */ }
            } else {
              row['Log_Sistema'] = 'Error Programación: ' + (errProg.response?.data?.Message || errProg.message);
              continue;
            }
          }
        } else {
           row['Problemas_encontrados_Programacion'] = 'Sincronizado de SISPRO';
        }
        row['ID_Programacion'] = idProgramacion;

        // Crear registro local para historial si no existe
        const localId = await Proceso.create({ nit, token });
        row['ID_Local'] = localId;
        await Proceso.update(localId, {
          id_mipres: String(idDireccionamiento),
          no_prescripcion: noPrescripcion,
          cod_ser_tec_a_entregar: codSerTec,
          cant_tot_a_entregar: Number(cantidad || dirSelect.CantTotAEntregar),
          fec_max_ent: String(dirSelect.FecMaxEnt || ''),
          causa_no_entrega: causaNoEntrega,
          estado: 'VERIFICADO',
        });

        await Proceso.update(localId, { id_programacion: idProgramacion, estado: 'PROGRAMADO' });

        // --- PASO 4: Entrega (Saltar si ya existe) ---
        let idEntrega = matchEnt?.IdEntrega || matchEnt?.ID || '';
        let entregaOk = !!idEntrega;

        if (!idEntrega) {
          try {
            let payloadEntr = {
              ID: Number(idRegistro),
              CodSerTecEntregado: codSerTec,
              CantTotEntregada: Number(cantidad || dirSelect.CantTotAEntregar || '0'),
              EntTotal: 1, 
              CausaNoEntrega: causaNoEntrega,
              FecEntrega: fechaEntrega, 
              NoLote: '',
              TipoIDRecibe: 'CC', 
              NoIDRecibe: ccRecibe
            };

            // LIMPIEZA MASIVA PARA NO ENTREGA
            if (causaNoEntrega !== 0) {
              delete payloadEntr.CodSerTecEntregado;
              delete payloadEntr.CantTotEntregada;
              delete payloadEntr.EntTotal;
              delete payloadEntr.NoLote;
              delete payloadEntr.TipoIDRecibe;
              delete payloadEntr.NoIDRecibe;
            }

            const resEntr = await MipresApi.entrega(nit, token, payloadEntr);
            const entrData = Array.isArray(resEntr) ? resEntr[0] : resEntr || {};
            idEntrega = String(entrData.IdEntrega || entrData.Id || '');
            entregaOk = true;
          } catch (errEntr) {
            const status = errEntr.response?.status;
            if (status === 422 || status === 400) {
              const msg = errEntr.response?.data?.Message || '';
              row['Problemas_encontrados_Entrega'] = 'Detectado previo';
              // Recuperar ID real de la entrega
              try {
                const checkEnts = await MipresApi.getEntregaXPrescripcion(nit, token, noPrescripcion);
                const eMatch = Array.isArray(checkEnts) && checkEnts.find(e => String(e.IdDireccionamiento || e.IDDireccionamiento) === String(idDireccionamiento));
                if (eMatch) idEntrega = String(eMatch.IdEntrega || eMatch.IDEntrega || eMatch.ID || '');
              } catch (e) { /* ignore */ }
              
              if (msg.includes('ya existe') || msg.includes('ya fue')) {
                entregaOk = true;
              }
            } else {
              row['Log_Sistema'] = 'Error Entrega: ' + (errEntr.response?.data?.Message || errEntr.message);
            }
          }
        } else {
           row['Problemas_encontrados_Entrega'] = 'Sincronizado de SISPRO';
        }

        if (idEntrega) row['ID_Entrega'] = idEntrega;
        await Proceso.update(localId, { id_entrega: idEntrega, estado: 'ENTREGADO' });

        // --- PASO 5: Reporte Final ---
        if (!entregaOk) {
          row['Log_Sistema'] = 'Omitido Paso 5: La entrega falló o no pudo ser verificada.';
          continue;
        }

        let idReporte = '';
        try {
          let payloadRep = {
            ID: Number(idRegistro),
            EstadoEntrega: causaNoEntrega === 0 ? 1 : 0, 
            CausaNoEntrega: causaNoEntrega,
            ValorEntregado: Number(vrTotal) 
          };

          // LIMPIEZA MASIVA PARA REPORTE NO EFECTIVO (Causa 7 y similares)
          if (causaNoEntrega > 0) {
            delete payloadRep.EstadoEntrega; 
            delete payloadRep.ValorEntregado;
          }

          const resRep = await MipresApi.reporteEntrega(nit, token, payloadRep);
          const repData = Array.isArray(resRep) ? resRep[0] : resRep || {};
          idReporte = String(repData.IDReporteEntrega || repData.IdReporteEntrega || repData.IdReporte || repData.Id || '');
          if (causaNoEntrega > 0) {
            row['Log_Sistema'] = `✅ MIPRES de No Entrega (Causa ${causaNoEntrega}) EXITOSO`;
          } else {
            row['Log_Sistema'] = '✅ MIPRES FULL EXITOSO (Entrega Efectiva)';
          }
        } catch (errRep) {
          row['Log_Sistema'] = 'Error Paso 5 Reporte: ' + (errRep.response?.data?.Message || errRep.message);
        }
        if (idReporte) {
          row['ID_Reporte'] = idReporte;
          // Si el Excel traía una columna llamada IDReporteEntrega, la llenamos también
          const keyColIdRep = findKey('IDREPORTEENTREGA');
          if (keyColIdRep) row[keyColIdRep] = idReporte;
        }
        await Proceso.update(localId, { id_reporte: idReporte, estado: 'REPORTADO' });

      } catch (errReg) {
        row['Log_Sistema'] = `Error Crítico Fila ${index + 1}: ` + errReg.message;
      }
    }

    // 4. Volver a empaquetar en un libro de Excel binario
    // Antes de exportar, recorremos todas las columnas de cada fila.
    // Si la columna se llama algo relacionado con "FECHA" o "FEC",
    // intentamos convertir su valor a un objeto Date real para que Excel lo reconozca.
    const processedRows = rows.map(r => {
      // Eliminar columnas vacías generadas por celdas fusionadas en el Excel original
      const newRow = Object.fromEntries(
        Object.entries(r).filter(([k]) => !k.startsWith('__EMPTY'))
      );


      // 1. Extraer llaves de interés para reordenar al final
      const keyColIdRep = Object.keys(newRow).find(k => sanitizeKey(k) === 'IDREPORTEENTREGA');

      const vLog = newRow['Log_Sistema'] || '';
      const vIdLocal = newRow['ID_Local'] || '';
      const vDir = newRow['ID_Direccionamiento'] || '';
      const vProg = newRow['ID_Programacion'] || '';
      const vEnt = newRow['ID_Entrega'] || '';
      const vDbgProg = newRow['Problemas_encontrados_Programacion'] || '';
      const vDbgEnt = newRow['Problemas_encontrados_Entrega'] || '';
      const vIdRep = keyColIdRep ? newRow[keyColIdRep] : '';

      // 2. Borrar para reinsertar ordenadamente al final
      delete newRow['Log_Sistema'];
      delete newRow['ID_Local'];
      delete newRow['ID_Direccionamiento'];
      delete newRow['ID_Programacion'];
      delete newRow['ID_Entrega'];
      delete newRow['Problemas_encontrados_Programacion'];
      delete newRow['Problemas_encontrados_Entrega'];
      if (keyColIdRep) delete newRow[keyColIdRep];

      // 3. Procesar Fechas en el resto de columnas originales
      Object.keys(newRow).forEach(key => {
        const sKey = sanitizeKey(key);
        if (sKey.includes('FECHA') || sKey.includes('FEC')) {
          const val = newRow[key];
          if (val) {
            const dateStr = parseDate(val);
            if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
              newRow[key] = new Date(dateStr + 'T12:00:00');
            }
          }
        }
      });

      // 4. Insertar columnas de resultado en el orden solicitado
      newRow['Log_Sistema'] = vLog;
      newRow['ID_Local'] = vIdLocal;
      newRow['ID_Direccionamiento'] = vDir;
      newRow['ID_Programacion'] = vProg;
      newRow['ID_Entrega'] = vEnt;
      newRow['Problemas_encontrados_Programacion'] = vDbgProg;
      newRow['Problemas_encontrados_Entrega'] = vDbgEnt;

      // El ID de reporte va de último
      if (keyColIdRep) {
        newRow[keyColIdRep] = vIdRep;
      }

      return newRow;
    });

    const newWorksheet = xlsx.utils.json_to_sheet(processedRows, { cellDates: true });

    // Aplicar formato visual de fecha a todas las celdas que tengan fecha
    const range = xlsx.utils.decode_range(newWorksheet['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cell_address = { c: C, r: R };
        const cell_ref = xlsx.utils.encode_cell(cell_address);
        if (newWorksheet[cell_ref] && newWorksheet[cell_ref].t === 'd') {
          newWorksheet[cell_ref].z = 'yyyy-mm-dd';
        }
      }
    }

    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Reporte Resultados MIPRES');

    const excelBuffer = xlsx.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    // 5. Configurar Headers HTTP para forzar descarga
    res.setHeader('Content-Disposition', 'attachment; filename="Resumen_Masivo_MIPRES.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);

  } catch (err) {
    console.error('[Error Lote Excel]', err);
    res.status(500).json({ ok: false, error: 'Hubo un error del servidor al procesar el archivo Excel.' });
  }
});

// ============================================================
// EXPORTACIÓN MASIVA DE VALORES UNITARIOS
// ============================================================
router.post('/export-unit-values', upload.single('archivo'), async (req, res) => {
  try {
    const nit = req.headers['x-nit'] || req.headers['X-NIT'] || req.body.nit;
    const token = req.headers['x-token'] || req.headers['X-Token'] || req.body.token;
    
    if (!req.file || !nit || !token) {
      console.log('[Export Valores] Falta información:', { 
        archivo: !!req.file, 
        nit: !!nit, 
        token: !!token,
        headers: req.headers 
      });
      return res.status(400).json({ ok: false, error: 'NIT, Token y Archivo son requeridos.' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const sanitizeKey = (k) => String(k).trim().toUpperCase().replace(/\s+/g, '');
    
    // Deduplicar la lista de MIPRES para evitar resultados repetidos
    const uniqueMipres = Array.from(new Set(rows.map(row => {
      const rowKeys = Object.keys(row);
      const findKey = (search) => rowKeys.find(k => sanitizeKey(k).includes(sanitizeKey(search)));
      const keyMipres = findKey('N°MIPRES') || findKey('MIPRES') || findKey('PRESCRIPCION');
      return String(row[keyMipres] || '').trim();
    }))).filter(m => m !== '');

    const results = [];

    for (const noPres of uniqueMipres) {
      try {
        // Consultar entregas y reportes en paralelo para mayor velocidad
        const [entregas, reportes] = await Promise.all([
          MipresApi.getEntregaXPrescripcion(nit, token, noPres),
          MipresApi.getReporteEntregaXPrescripcion(nit, token, noPres)
        ]);

        const resEnts = Array.isArray(entregas) ? entregas : [];
        const resReps = Array.isArray(reportes) ? reportes : [];

        // Por cada entrega física real, buscamos su valor reportado
        for (const ent of resEnts) {
          if (ent.FecAnulacion) continue; // Ignorar anuladas

          const idDir = String(ent.IdDireccionamiento || ent.IDDireccionamiento || '');
          const noEnt = Number(ent.NoEntrega) || 1;

          // Buscar el reporte que coincida con esta entrega
          const matchRep = resReps.find(r => 
            !r.FecAnulacion && 
            Number(r.NoEntrega) === noEnt &&
            String(r.IdDireccionamiento || r.IDDireccionamiento || '') === idDir
          );

          const cant = Number(ent.CantTotEntregada) || 0;
          const valorTotal = matchRep ? (Number(matchRep.ValorEntregado) || 0) : 0;
          const unitValue = cant > 0 ? (valorTotal / cant) : 0;

          results.push({
            'N° MIPRES': noPres,
            'ID Reporte Entrega': matchRep ? (matchRep.IDReporteEntrega || matchRep.IdReporteEntrega || '') : 'N/A',
            'Tecnología': ent.CodSerTecEntregado,
            'N° Entrega': noEnt,
            'Cantidad Entregada': cant,
            'Valor Total Reportado': valorTotal,
            'Valor Unitario': Number(unitValue.toFixed(2)),
            'Estado SISPRO': matchRep ? 'Reportado OK' : 'Pendiente o Anulado'
          });
        }

        if (resEnts.length === 0) {
          results.push({ 'N° MIPRES': noPres, 'Estado SISPRO': 'Sin entregas registradas' });
        }
      } catch (errApi) {
        results.push({ 
          'N° MIPRES': noPres, 
          'Estado SISPRO': 'Error: ' + (errApi.response?.data?.Message || errApi.message) 
        });
      }
      // Pequeño delay de cortesía para la API de SISPRO
      await sleep(40);
    }

    const newWs = xlsx.utils.json_to_sheet(results);
    const newWb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWb, newWs, 'Valores MIPRES');
    const buffer = xlsx.write(newWb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Reporte_Valores_Unitarios.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (err) {
    console.error('[Error Export Valores]', err);
    res.status(500).json({ ok: false, error: 'Error procesando exportación de valores.' });
  }
});

// ============================================================
// CONSULTA MASIVA - REPORTE DE ENTREGAS
// ============================================================
router.post('/query-reporte-entrega', upload.single('archivo'), async (req, res) => {
  try {
    const { nit, token } = req.body;

    if (!req.file) return res.status(400).json({ ok: false, error: 'No se envió ningún archivo Excel.' });
    if (!nit || !token) return res.status(400).json({ ok: false, error: 'NIT y Token son requeridos.' });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });

    if (rows.length === 0) return res.status(400).json({ ok: false, error: 'Excel vacío.' });

    const sanitizeKey = (k) => String(k).trim().toUpperCase().replace(/\s+/g, '');
    const outputRows = [];

    for (const row of rows) {
      try {
        const rowKeys = Object.keys(row);
        const findKey = (search) => rowKeys.find(k => sanitizeKey(k).includes(sanitizeKey(search)));

        const keyNoMipres = findKey('N°MIPRES') || findKey('PRESCRIPCION') || findKey('MIPRES');
        const noPrescripcion = String(row[keyNoMipres] || '').trim();

        if (!noPrescripcion) {
          const errRow = { ...row };
          errRow['Resultado_Consulta'] = 'Omitido: N° MIPRES vacío';
          outputRows.push(errRow);
          continue;
        }

        const [direccionamientos, reportes, entregas, facturas] = await Promise.all([
          MipresApi.getDireccionamientoXPrescripcion(nit, token, noPrescripcion).catch(() => []),
          MipresApi.getReporteEntregaXPrescripcion(nit, token, noPrescripcion).catch(() => []),
          MipresApi.getEntregaXPrescripcion(nit, token, noPrescripcion).catch(() => []),
          MipresApi.getFacturacionXPrescripcion(nit, token, noPrescripcion).catch(() => [])
        ]);

        const resDirs = Array.isArray(direccionamientos) ? direccionamientos : [];
        const resReps = Array.isArray(reportes) ? reportes : [];
        const resEnts = Array.isArray(entregas) ? entregas : [];
        const resFacts = Array.isArray(facturas) ? facturas : [];

        if (resDirs.length === 0) {
          const errRow = { ...row };
          errRow['Resultado_Consulta'] = 'Sin direccionamientos en SISPRO';
          outputRows.push(errRow);
          continue;
        }

        for (const dir of resDirs) {
          if (dir.FecAnulacion) continue;

          const noEnt = Number(dir.NoEntrega) || 0;
          const idDir = String(dir.IDDireccionamiento || dir.IdDireccionamiento || dir.IDDIRECCIONAMIENTO || '');

          const matchRep = resReps.find(r =>
            Number(r.NoEntrega) === noEnt &&
            String(r.IdDireccionamiento || r.IDDireccionamiento || '') === idDir
          );
          const matchEnt = resEnts.find(e =>
            Number(e.NoEntrega) === noEnt &&
            String(e.IdDireccionamiento || e.IDDireccionamiento || '') === idDir
          );
          const facturado = resFacts.some(f =>
            Number(f.NoEntrega) === noEnt &&
            !f.FecAnulacion
          );

          if (matchRep) {
            const outRow = {
              ...row,
              NoEntrega: noEnt,
              CodSerTecEntregado: matchEnt?.CodSerTecEntregado || dir.CodSerTecAEntregar || '',
              IDReporteEntrega: matchRep.IDReporteEntrega || matchRep.IdReporteEntrega || '',
              ValorEntregado: matchRep.ValorEntregado || '0',
              EstadoEntrega: matchRep.EstadoEntrega === 1 ? 'Efectiva' : 'No Efectiva',
              Estado: matchRep.FecAnulacion ? 'Anulado' : 'Reportado',
              Facturado: facturado ? 'Sí' : 'No',
              Resultado_Consulta: '✅ Reportado',
            };
            outputRows.push(outRow);
          } else {
            const outRow = {
              ...row,
              NoEntrega: noEnt,
              CodSerTecEntregado: dir.CodSerTecAEntregar || '',
              IDReporteEntrega: '',
              ValorEntregado: '',
              EstadoEntrega: '',
              Estado: 'Pendiente',
              Facturado: 'No',
              Resultado_Consulta: '⏳ Sin reporte de entrega',
            };
            outputRows.push(outRow);
          }
        }

        await sleep(150);
      } catch (err) {
        const errRow = { ...row };
        errRow['Resultado_Consulta'] = 'Error: ' + (err.response?.data?.Message || err.response?.data || err.message);
        outputRows.push(errRow);
      }
    }

    const newWorksheet = xlsx.utils.json_to_sheet(outputRows);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Resultados Consulta');
    const excelBuffer = xlsx.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Resumen_Consulta_Reportes_Entrega.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);
  } catch (err) {
    console.error('[Query Reporte Error]', err);
    res.status(500).json({ ok: false, error: 'Error interno al consultar reportes.' });
  }
});

export default router;

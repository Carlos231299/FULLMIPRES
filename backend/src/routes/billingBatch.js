import { Router } from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import * as MipresApi from '../services/mipresApi.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Helper: Búsqueda insensible de llaves en objetos JSON
const sanitizeKey = (k) => String(k).trim().toUpperCase().replace(/\s+/g, '');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ============================================================
// CARGA MASIVA - FACTURACIÓN
// ============================================================
router.post('/excel', upload.single('archivo'), async (req, res) => {
  try {
    const { nit, token } = req.body;

    if (!req.file) return res.status(400).json({ ok: false, error: 'No se envió ningún archivo Excel.' });
    if (!nit || !token) return res.status(400).json({ ok: false, error: 'NIT y Token son requeridos.' });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    let rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ ok: false, error: 'Excel vacío.' });

    for (const [index, row] of rows.entries()) {
        let noPrescripcion = '';
        let noEntregaFila = 0;

        try {
          const rowKeys = Object.keys(row);
          const findKey = (search) => rowKeys.find(k => sanitizeKey(k).includes(sanitizeKey(search)));

          const keyNoMipres = findKey('N°MIPRES') || findKey('PRESCRIPCION');
          const keyNoFactura = findKey('NOFACTURA') || findKey('FACTURA');
          const keyCodEps = findKey('CODEPS');
          const keyRegimen = findKey('REGIMEN');
          const keyNoIdEps = findKey('NOIDEPS');
          const keyNoEntrega = findKey('NOENTREGA') || findKey('ENTREGA');
          const keyCodTec = findKey('COD_TEC') || findKey('TECNOLOGIA') || findKey('CODIGO');

          noPrescripcion = String(row[keyNoMipres] || '').trim();
          const noFactura = String(row[keyNoFactura] || '').trim();
          const noIdEpsManual = String(row[keyNoIdEps] || '').trim();
          noEntregaFila = Number(row[keyNoEntrega]) || 0;
          const codTecFila = String(row[keyCodTec] || '').trim().toUpperCase();

          // Mapear REGIMEN (texto legible) o CODEPS (código directo)
          const regimenTexto = String(row[keyRegimen] || '').trim().toLowerCase();
          const codEpsManual = String(row[keyCodEps] || '').trim();
          const codEpsResuelto = regimenTexto.includes('contribut') ? 'EPSIC4'
            : regimenTexto.includes('subsidiad') ? 'EPSI04'
            : codEpsManual || 'EPSI04';

          if (!noPrescripcion) {
            row['Log_Facturacion'] = 'Omitido: Prescripción vacía';
            continue;
          }

          if (!noFactura) {
            row['Log_Facturacion'] = 'Error: Faltó número de factura';
            continue;
          }

          if (!noEntregaFila) {
            row['Log_Facturacion'] = 'Error: Faltó No. Entrega (columna NOENTREGA)';
            continue;
          }

          // Función para normalizar códigos (quitar guiones, espacios, puntos, etc.)
          const normalize = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
          const codTecNorm = normalize(codTecFila);

          // 1. Obtener Facturas Existentes para decidir si facturar o recuperar
          let facturasExistentes = [];
          try {
            facturasExistentes = await MipresApi.getFacturacionXPrescripcion(nit, token, noPrescripcion);
          } catch (e) { console.error("Error consultando facturas previas:", e.message); }

          if (Array.isArray(facturasExistentes)) {
            const fExist = facturasExistentes.find(f => 
              Number(f.NoEntrega) === noEntregaFila && 
              normalize(f.CodSerTecAEntregado) === codTecNorm
            );

            if (fExist) {
              row['CUFE_ENCONTRADO'] = fExist.NoFactura || '';
              row['FECHA_FACTURACION'] = fExist.FecFacturacion || fExist.FecFactura || '';
              row['ID_FACTURACION'] = fExist.IDFacturacion || fExist.IdFacturacion || 'Existente';
              row['Log_Facturacion'] = '⚠️ Ya existía (Datos recuperados por Código de Tecnología)';
              continue;
            }
          }

          // --- PASO 1: Obtener Datos de SISPRO (P3, P4, P5) ---
          let reportFinal = null;
          let deliveryFinal = null;
          let programFinal = null;

          try {
            const [resReports, resDeliveries, resPrograms] = await Promise.all([
              MipresApi.getReporteEntregaXPrescripcion(nit, token, noPrescripcion),
              MipresApi.getEntregaXPrescripcion(nit, token, noPrescripcion),
              MipresApi.getProgramacionXPrescripcion(nit, token, noPrescripcion)
            ]);

            if (Array.isArray(resReports)) {
              // Priorizar match exacto de Entrega + Tecnología
              reportFinal = resReports.find(r => 
                Number(r.NoEntrega) === noEntregaFila && 
                normalize(r.CodSerTecAEntregado) === codTecNorm
              );
              
              // Si no hay match exacto por código, pero sí por entrega (fallback)
              if (!reportFinal) {
                reportFinal = resReports.find(r => Number(r.NoEntrega) === noEntregaFila) || null;
              }
            }
            if (Array.isArray(resDeliveries)) {
              deliveryFinal = resDeliveries.find(d => Number(d.NoEntrega) === noEntregaFila) || null;
            }
            if (Array.isArray(resPrograms)) {
              programFinal = resPrograms.find(p => 
                Number(p.NoEntrega) === noEntregaFila && 
                normalize(p.CodSerTecAEntregar) === codTecNorm
              ) || resPrograms.find(p => Number(p.NoEntrega) === noEntregaFila) || null;
            }
          } catch (e) { /* vacio */ }

          if (!reportFinal) {
            // --- CICLO AUTOMÁTICO DE EMERGENCIA ---
            // Si no hay reporte, intentamos hacer todo el ciclo antes de facturar
            try {
              // 1. Obtener Direccionamiento Base
              const dirs = await MipresApi.getDireccionamientoXPrescripcion(nit, token, noPrescripcion);
              const dirSelect = Array.isArray(dirs) && dirs.find(d => Number(d.NoEntrega) === noEntregaFila);
              
              if (!dirSelect) throw new Error(`No se encontró direccionamiento para la entrega #${noEntregaFila}`);
              const idDir = dirSelect.ID || dirSelect.IdDireccionamiento;

              // 2. Programar (P3) - Solo si no estaba ya programado
              let idProg = programFinal?.IdProgramacion || programFinal?.ID || null;
              if (!programFinal) {
                const resP3 = await MipresApi.programacion(nit, token, {
                  ID: Number(idDir),
                  FecMaxEnt: String(dirSelect.FecMaxEnt || ''),
                  TipoIDSedeProv: 'NI',
                  NoIDSedeProv: nit,
                  CodSedeProv: 'PROV008934',
                  CodSerTecAEntregar: codTecFila,
                  CantTotAEntregar: String(dirSelect.CantTotAEntregar)
                }).catch(() => null); // Ignorar si ya existía
                const p3Data = Array.isArray(resP3) ? resP3[0] : resP3;
                idProg = p3Data?.IdProgramacion || p3Data?.ID || idDir;
              }

              // ID a usar en P4 y P5: preferir idProgramacion, fallback a idDir
              const idParaEntrega = Number(idProg || idDir);

              // 3. Entregar (P4) - Con causa 0 (Efectiva) por defecto para facturar
              let idEntregaCiclo = deliveryFinal?.IdEntrega || deliveryFinal?.ID || null;
              if (!deliveryFinal) {
                const resP4 = await MipresApi.entrega(nit, token, {
                  ID: idDir,
                  CodSerTecEntregado: codTecFila,
                  CantTotEntregada: Number(dirSelect.CantTotAEntregar),
                  EntTotal: 1,
                  CausaNoEntrega: 0,
                  FecEntrega: new Date().toISOString().split('T')[0],
                  TipoIDRecibe: 'CC',
                  NoIDRecibe: '12345678' // Genérico para masivo
                }).catch(() => null);
                const p4Data = Array.isArray(resP4) ? resP4[0] : resP4;
                idEntregaCiclo = p4Data?.IdEntrega || p4Data?.ID || idParaEntrega;
              }

              // 4. Reportar (P5) — usar el id del Direccionamiento
              const resP5 = await MipresApi.reporteEntrega(nit, token, {
                ID: idDir,
                EstadoEntrega: 1,
                CausaNoEntrega: 0,
                ValorEntregado: 0
              });
              
              reportFinal = Array.isArray(resP5) ? resP5[0] : resP5;
              row['Log_Facturacion'] = '⚡ Ciclo completado automáticamente';

            } catch (errSync) {
              row['Log_Facturacion'] = `Error en Ciclo Automático: ${errSync.message}`;
              continue;
            }
          }

          // --- PASO 2: Facturar ---
          const cant = Number(deliveryFinal?.CantTotEntregada || reportFinal.CantUnMinDis || 1);
          const total = Number(reportFinal.ValorEntregado || 0);
          const unitario = cant > 0 ? Math.round(total / cant).toString() : '0';

          const payload = {
            NoPrescripcion: noPrescripcion,
            TipoTec: reportFinal.TipoTec || 'M',
            ConTec: reportFinal.ConTec || 1,
            TipoIDPaciente: reportFinal.TipoIDPaciente || 'CC',
            NoIDPaciente: reportFinal.NoIDPaciente,
            NoEntrega: noEntregaFila,
            NoSubEntrega: 0,
            NoFactura: noFactura,
            NoIDEPS: noIdEpsManual || '839000495',
            CodEPS: codEpsResuelto,
            CodSerTecAEntregado: programFinal?.CodSerTecAEntregar || reportFinal.CodSerTecAEntregado || '',
            CantUnMinDis: String(cant),
            ValorUnitFacturado: String(unitario),
            ValorTotFacturado: String(total),
            CuotaModer: '0',
            Copago: '0'
          };

          const rawResult = await MipresApi.facturacion(nit, token, payload);
          const result = (Array.isArray(rawResult) && rawResult.length > 0) ? rawResult[0] : rawResult;
          
          // Si el resultado tiene código 400 o similar dentro del body (algunas APIs de SISPRO lo hacen)
          if (result?.Code || result?.Message && (String(result.Message).toLowerCase().includes('ya existe') || String(result.Message).toLowerCase().includes('duplicado'))) {
              throw { response: { data: result } };
          }

          const billId = result?.IDFacturacion || result?.IdFacturacion || result?.ID || '';
          
          row['CUFE_ENCONTRADO'] = noFactura; 
          row['FECHA_FACTURACION'] = 'Recién Procesado';
          row['ID_FACTURACION'] = billId ? String(billId) : 'Exitoso';
          row['Log_Facturacion'] = '✅ Factura registrada con éxito';
          row['RESPUESTA_SISPRO'] = JSON.stringify(result);

          await sleep(100);

        } catch (err) {
          let errorMsg = err.response?.data?.Message || err.response?.data || err.message;
          if (typeof errorMsg === 'object') errorMsg = JSON.stringify(errorMsg);
          const lowerMsg = String(errorMsg).toLowerCase();

          if (lowerMsg.includes('ya existe') || lowerMsg.includes('duplicado')) {
            try {
              const facturas = await MipresApi.getFacturacionXPrescripcion(nit, token, noPrescripcion);
              // Normalización que quita: no-alfanuméricos, ceros a la izquierda y espacios
              const normalize = (val) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').trim().toUpperCase();
              const codTecNormCatch = normalize(row[keyCodTec]);
              
              const fExisting = Array.isArray(facturas) && facturas.find(f => {
                const codFact = normalize(f.CodSerTecAEntregado);
                // Si el código del excel está contenido en la factura o viceversa (match parcial)
                const isMatch = codFact.includes(codTecNormCatch) || codTecNormCatch.includes(codFact);
                return Number(f.NoEntrega) === noEntregaFila && isMatch;
              });

              if (fExisting) {
                row['CUFE_ENCONTRADO'] = fExisting.NoFactura || '';
                row['FECHA_FACTURACION'] = fExisting.FecFacturacion || '';
                row['ID_FACTURACION'] = fExisting.IDFacturacion || 'Existente';
                row['Log_Facturacion'] = '⚠️ Ya existía (Datos recuperados)';
                continue;
              }
            } catch (e) {
              console.error('Error buscando facturas existentes:', e);
            }
          }
          row['Log_Facturacion'] = '❌ Error al procesar';
          row['RESPUESTA_SISPRO'] = errorMsg;
        }
    }

    // Exportar Excel reordenando columnas para legibilidad
    const processedRows = rows.map(r => {
      const newRow = Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('__EMPTY')));
      
      const log = newRow['Log_Facturacion'] || '';
      const cufe = newRow['CUFE_ENCONTRADO'] || '';
      const fecha = newRow['FECHA_FACTURACION'] || '';
      const idS = newRow['ID_FACTURACION'] || '';
      
      delete newRow['Log_Facturacion'];
      delete newRow['CUFE_ENCONTRADO'];
      delete newRow['FECHA_FACTURACION'];
      delete newRow['ID_FACTURACION'];
      
      newRow['CUFE_ENCONTRADO'] = cufe;
      newRow['FECHA_FACTURACION'] = fecha;
      newRow['ID_FACTURACION'] = idS;
      newRow['Log_Facturacion'] = log;
      newRow['RESPUESTA_SISPRO'] = r['RESPUESTA_SISPRO'] || '';
      
      return newRow;
    });

    const newWorksheet = xlsx.utils.json_to_sheet(processedRows);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Resultados Facturación');
    const excelBuffer = xlsx.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Resumen_Facturacion_Masiva.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);

  } catch (err) {
    console.error('[Bulk Billing Error]', err);
    res.status(500).json({ ok: false, error: 'Error interno del servidor.' });
  }
});

// ============================================================
// ANULACIÓN MASIVA - FACTURACIÓN
// ============================================================
router.post('/annul-excel', upload.single('archivo'), async (req, res) => {
  try {
    const { nit, token } = req.body;

    if (!req.file) return res.status(400).json({ ok: false, error: 'No se envió ningún archivo Excel.' });
    if (!nit || !token) return res.status(400).json({ ok: false, error: 'NIT y Token son requeridos.' });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    let rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ ok: false, error: 'Excel vacío.' });

    for (const [index, row] of rows.entries()) {
      try {
        const rowKeys = Object.keys(row);
        const findKey = (search) => rowKeys.find(k => sanitizeKey(k).includes(sanitizeKey(search)));

        const keyNoMipres = findKey('N°MIPRES') || findKey('PRESCRIPCION');
        const keyNoEntrega = findKey('NOENTREGA') || findKey('ENTREGA');

        const noPrescripcion = String(row[keyNoMipres] || '').trim();
        const noEntregaFila = Number(row[keyNoEntrega]) || 0;

        if (!noPrescripcion || !noEntregaFila) {
          row['Log_Anulacion'] = 'Omitido: N° MIPRES o Entrega incompleto';
          continue;
        }

        // --- PASO 1: Buscar el ID de Facturación en SISPRO ---
        const facturas = await MipresApi.getFacturacionXPrescripcion(nit, token, noPrescripcion);
        if (!Array.isArray(facturas) || facturas.length === 0) {
          row['Log_Anulacion'] = 'Error: No se encontraron facturas para esta prescripción';
          continue;
        }

        const fToAnnul = facturas.find(f => Number(f.NoEntrega) === noEntregaFila);
        if (!fToAnnul) {
          row['Log_Anulacion'] = `Error: No se encontró factura para la Entrega #${noEntregaFila}`;
          continue;
        }

        const idFacturacion = fToAnnul.IDFacturacion || fToAnnul.IdFacturacion || fToAnnul.ID || fToAnnul.id;
        
        // --- PASO 2: Ejecutar Anulación ---
        const result = await MipresApi.anularFacturacion(nit, token, idFacturacion);
        
        row['ID_FACTURACION'] = idFacturacion;
        row['Log_Anulacion'] = (result === 'OK' || result?.Message?.includes('exito')) 
          ? '✅ Factura anulada con éxito' 
          : '⚠️ Resultado: ' + (result?.Message || JSON.stringify(result));

        await sleep(150);

      } catch (err) {
        let errorMsg = err.response?.data?.Message || err.response?.data || err.message;
        row['Log_Anulacion'] = 'Error: ' + errorMsg;
      }
    }

    const processedRows = rows.map(r => {
      const newRow = Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('__EMPTY')));
      const log = newRow['Log_Anulacion'] || '';
      const idS = newRow['ID_FACTURACION'] || '';
      delete newRow['Log_Anulacion'];
      delete newRow['ID_FACTURACION'];
      newRow['Log_Anulacion'] = log;
      newRow['ID_FACTURACION'] = idS;
      return newRow;
    });

    const newWorksheet = xlsx.utils.json_to_sheet(processedRows);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Resultados Anulación');
    const excelBuffer = xlsx.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Resumen_Anulacion_Masiva.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);

  } catch (err) {
    console.error('[Bulk Annul Error]', err);
    res.status(500).json({ ok: false, error: 'Error interno al anular lote.' });
  }
});

// ============================================================
// CONSULTA MASIVA - FACTURACIÓN (OBTENER CUFES)
// ============================================================
router.post('/query-excel', upload.single('archivo'), async (req, res) => {
  try {
    const { nit, token } = req.body;

    if (!req.file) return res.status(400).json({ ok: false, error: 'No se envió ningún archivo Excel.' });
    if (!nit || !token) return res.status(400).json({ ok: false, error: 'NIT y Token son requeridos.' });

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    let rows = xlsx.utils.sheet_to_json(worksheet, { defval: '' });

    if (rows.length === 0) return res.status(400).json({ ok: false, error: 'Excel vacío.' });

    for (const [index, row] of rows.entries()) {
      try {
        const rowKeys = Object.keys(row);
        const findKey = (search) => rowKeys.find(k => sanitizeKey(k).includes(sanitizeKey(search)));

        const keyNoMipres = findKey('N°MIPRES') || findKey('PRESCRIPCION');
        const keyNoEntrega = findKey('NOENTREGA') || findKey('ENTREGA');

        const noPrescripcion = String(row[keyNoMipres] || '').trim();
        const noEntregaFila = Number(row[keyNoEntrega]) || 0;

        if (!noPrescripcion || !noEntregaFila) {
          row['Resultado_Consulta'] = 'Omitido: N° MIPRES o Entrega incompleto';
          continue;
        }

        // --- PASO 1: Consultar facturas en SISPRO ---
        const facturas = await MipresApi.getFacturacionXPrescripcion(nit, token, noPrescripcion);
        
        if (!Array.isArray(facturas) || facturas.length === 0) {
          row['Resultado_Consulta'] = 'Sin facturas registradas para este MIPRES';
          continue;
        }

        const fFound = facturas.find(f => Number(f.NoEntrega) === noEntregaFila);
        
        if (!fFound) {
          row['Resultado_Consulta'] = `No se encontró factura para la Entrega #${noEntregaFila}`;
          continue;
        }

        // --- PASO 2: Extraer datos ---
        const cufe = fFound.NoFactura || '';
        const idBill = fFound.IDFacturacion || fFound.IdFacturacion || fFound.ID || fFound.id || '';
        const fecha = fFound.FecFactura || fFound.FecFacturacion || fFound.FechaFactura || fFound.Fecha || '';
        const valor = fFound.ValorTotFacturado || '0';

        row['CUFE_ENCONTRADO'] = cufe;
        row['ID_FACTURACION'] = idBill;
        row['FECHA_FACTURACION'] = fecha;
        row['VALOR_SISPRO'] = valor;
        row['Resultado_Consulta'] = '✅ Consulta Exitosa';

        await sleep(150);

      } catch (err) {
        let errorMsg = err.response?.data?.Message || err.response?.data || err.message;
        row['Resultado_Consulta'] = 'Error: ' + errorMsg;
      }
    }

    const processedRows = rows.map(r => {
      const newRow = Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith('__EMPTY')));
      // Priorizar columnas de resultado al final para legibilidad
      const log = newRow['Resultado_Consulta'] || '';
      const cufe = newRow['CUFE_ENCONTRADO'] || '';
      const idS = newRow['ID_FACTURACION'] || '';
      const fecha = newRow['FECHA_FACTURACION'] || '';
      
      delete newRow['Resultado_Consulta'];
      delete newRow['CUFE_ENCONTRADO'];
      delete newRow['ID_FACTURACION'];
      delete newRow['FECHA_FACTURACION'];
      
      newRow['CUFE_ENCONTRADO'] = cufe;
      newRow['FECHA_FACTURACION'] = fecha;
      newRow['ID_FACTURACION'] = idS;
      newRow['Resultado_Consulta'] = log;
      
      return newRow;
    });

    const newWorksheet = xlsx.utils.json_to_sheet(processedRows);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Resultados Consulta');
    const excelBuffer = xlsx.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Resumen_Consulta_Masiva.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(excelBuffer);

  } catch (err) {
    console.error('[Bulk Query Error]', err);
    res.status(500).json({ ok: false, error: 'Error interno al consultar lote.' });
  }
});

export default router;

import { Router } from 'express';
import multer from 'multer';
import * as xlsx from 'xlsx';
import * as MipresApi from '../services/mipresApi.js';
import * as Proceso from '../models/procesoModel.js';
import * as License from '../models/licenseModel.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const sanitizeKey = (k) => String(k).trim().toUpperCase().replace(/\s+/g, '');

router.post('/procesar', upload.single('archivo'), async (req, res) => {
  try {
    const { nit, token } = req.body;
    if (!req.file || !nit || !token) return res.status(400).json({ ok: false, error: 'NIT, Token y Archivo son requeridos.' });

    // ── VALIDACIÓN DE LICENCIA WEB ──────────────────────────
    const licenseCheck = await License.checkLicense(nit);
    if (!licenseCheck.active) {
      return res.status(403).json({ ok: false, error: licenseCheck.message });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const rows = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });

    const results = [];

    for (const row of rows) {
      const rowKeys = Object.keys(row);
      const findKey = (s) => rowKeys.find(k => sanitizeKey(k).includes(sanitizeKey(s)));
      
      const noPrescripcion = String(row[findKey('N°MIPRES') || findKey('PRESCRIPCION')] || '').trim();
      const noEntrega = Number(row[findKey('NOENTREGA') || findKey('ENTREGA')]) || 0;
      const codTec = String(row[findKey('COD_TEC') || findKey('TECNOLOGIA')] || '').trim().toUpperCase();

      if (!noPrescripcion || !noEntrega) {
        row['Resultado'] = '❌ Error: Datos incompletos';
        results.push(row);
        continue;
      }

      try {
        // --- LOGICA DE RESILIENCIA (Sincronización Inteligente) ---
        
        // 1. Verificar si ya está Reportado
        const reportes = await MipresApi.getReporteEntregaXPrescripcion(nit, token, noPrescripcion);
        const yaReportado = Array.isArray(reportes) && reportes.find(r => Number(r.NoEntrega) === noEntrega);
        if (yaReportado) {
          row['Resultado'] = '✅ Ya estaba reportado en SISPRO';
          row['ID_REPORTE'] = yaReportado.IDReporteEntrega || yaReportado.ID;
          results.push(row);
          continue;
        }

        // 2. Verificar si hay Entrega (P4)
        const entregas = await MipresApi.getEntregaXPrescripcion(nit, token, noPrescripcion);
        const entregaExistente = Array.isArray(entregas) && entregas.find(e => Number(e.NoEntrega) === noEntrega);
        
        let idEntrega = entregaExistente?.IdEntrega || entregaExistente?.ID || null;
        // ID que SISPRO necesita en P4 y P5: debe ser el IdProgramacion
        let idParaReporte = null;

        // 3. Si no hay entrega, verificar o crear Programación (P3)
        if (!idEntrega) {
          const programas = await MipresApi.getProgramacionXPrescripcion(nit, token, noPrescripcion);
          const progExistente = Array.isArray(programas) && programas.find(p => Number(p.NoEntrega) === noEntrega);
          
          if (progExistente) {
            // Ya existe programación → usar su ID
            idParaReporte = progExistente.IdProgramacion || progExistente.ID;
          } else {
            // No existe programación → crearla desde el Direccionamiento
            const dirs = await MipresApi.getDireccionamientoXPrescripcion(nit, token, noPrescripcion);
            const dir = Array.isArray(dirs) && dirs[0];
            if (!dir) throw new Error('No se encontró direccionamiento base');

            const resP3 = await MipresApi.programacion(nit, token, {
               ID: dir.ID,
               FecMaxEnt: dir.FecMaxEnt,
               TipoIDSedeProv: 'NI',
               NoIDSedeProv: nit,
               CodSedeProv: 'PROV008934',
               CodSerTecAEntregar: dir.CodSerTecAEntregar,
               CantTotAEntregar: String(dir.CantTotAEntregar)
            });
            const p3Data = Array.isArray(resP3) ? resP3[0] : resP3;
            // Priorizar el ID de programación retornado; si falla, usar el del direccionamiento
            idParaReporte = p3Data?.IdProgramacion || p3Data?.ID || dir.ID;
          }

          // Ejecutar P4 Entrega usando el idProgramacion
          const resP4 = await MipresApi.entrega(nit, token, {
            ID: Number(idParaReporte),
            CausaNoEntrega: 7
          });
          const p4Data = Array.isArray(resP4) ? resP4[0] : resP4;
          idEntrega = p4Data.IdEntrega || p4Data.ID;
        }

        // 4. Ejecutar P5 Reporte (Siempre al final)
        const resP5 = await MipresApi.reporteEntrega(nit, token, {
          ID: Number(idEntrega || idParaReporte),
          CausaNoEntrega: 7
        });
        const p5Data = Array.isArray(resP5) ? resP5[0] : resP5;

        row['Resultado'] = '✅ Procesado y Sincronizado con Éxito';
        row['ID_REPORTE'] = p5Data.IdReporteEntrega || p5Data.ID;
        results.push(row);

      } catch (err) {
        row['Resultado'] = '❌ Falló: ' + (err.response?.data?.Message || err.message);
        results.push(row);
      }
      await sleep(100);
    }

    const newWorksheet = xlsx.utils.json_to_sheet(results);
    const newWorkbook = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(newWorkbook, newWorksheet, 'Resultados');
    const buffer = xlsx.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Disposition', 'attachment; filename="Resultado_Masivo_Inteligente.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);

  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;

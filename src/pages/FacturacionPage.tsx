import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sisproGet, sisproPut } from '../services/api';
import { DataGrid } from '../components/DataGrid';
import { Modal } from '../components/Modal';
import { useAsistente } from '../context/AsistenteContext';
import { getErrorMsg } from '../utils/errorHelper';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const FacturacionPage = () => {
  const { nit, token } = useAuth();
  const {
    setError,
    setSuccess,
    clearError
  } = useAsistente();

  const [noPrescripcion, setNoPrescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  const [showAnularConfirm, setShowAnularConfirm] = useState(false);

  // Estados para Sincronización Inteligente
  const [syncRecords, setSyncRecords] = useState<any[]>([]);
  const [syncDeliveries, setSyncDeliveries] = useState<any[]>([]);
  const [syncPrograms, setSyncPrograms] = useState<any[]>([]);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [formData, setFormData] = useState({
    NoPrescripcion: '',
    TipoTec: 'M',
    ConTec: '1',
    TipoIDPaciente: 'CC',
    NoIDPaciente: '',
    NoEntrega: '1',
    NoSubEntrega: '0',
    NoFactura: '',
    NoIDEPS: '839000495',
    CodEPS: 'EPSI04',
    CodSerTecAEntregado: '',
    CantUnMinDis: '1',
    ValorUnitFacturado: '0',
    ValorTotFacturado: '0',
    CuotaModer: '0',
    Copago: '0'
  });

  // Limpiar mensajes globales al desmontar
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noPrescripcion) return setError('Ingrese NoPrescripción');
    setLoading(true);
    clearError();
    setResultados([]);

    try {
      const { data } = await sisproGet('getFacturacionXPrescripcion', nit!, token!, noPrescripcion);
      if (Array.isArray(data) && data.length > 0) {
        setResultados(data);
        setSuccess(`${data.length} registro(s) de facturación encontrado(s) en SISPRO.`);
      } else {
        setSuccess('No existen registros de facturación en SISPRO. Puede crear uno nuevo.');
        setFormData(prev => ({ ...prev, NoPrescripcion: noPrescripcion }));
      }
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    clearError();

    try {
      const payload = {
        ...formData,
        ConTec: Number(formData.ConTec),
        NoEntrega: Number(formData.NoEntrega),
        NoSubEntrega: formData.NoSubEntrega ? Number(formData.NoSubEntrega) : 0,
        // Forzar a string para campos monetarios/cantidades según documentación
        CantUnMinDis: String(formData.CantUnMinDis),
        ValorUnitFacturado: String(formData.ValorUnitFacturado),
        ValorTotFacturado: String(formData.ValorTotFacturado),
        CuotaModer: String(formData.CuotaModer),
        Copago: String(formData.Copago)
      };

      const response = await sisproPut('facturacion', nit!, token!, payload);
      // El standalone backend envuelve: { ok: true, data: <respuesta SISPRO> }
      const rawData = response.data || response;
      
      // SISPRO a veces retorna un objeto y a veces un arreglo [{ IDFacturacion: ... }]
      const billResult = Array.isArray(rawData) ? rawData[0] : rawData;
      
      // Capturar ID con todas las variaciones de nombres (SISPRO es inconsistente)
      const newBillId = billResult?.IDFacturacion || billResult?.IdFacturacion || billResult?.ID || billResult?.id || 'Registrado';
      
      setSuccess(`Facturación registrada con éxito. ID de Facturación: ${newBillId}`);
      setResultados(prev => [billResult, ...prev]);
      setShowCreateModal(false); // Cerrar modal al éxito
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSyncFromSuministros = async () => {
    if (!noPrescripcion) return setError('Ingrese NoPrescripción para sincronizar');
    setSyncLoading(true);
    setSyncRecords([]);
    try {
      // Consultar en paralelo: Reportes (P5), Entregas (P4), Programación (P3) y Facturaciones para filtrar
      const [resReports, resDeliveries, resPrograms, resBills] = await Promise.all([
        sisproGet('getReporteEntregaXPrescripcion', nit!, token!, noPrescripcion),
        sisproGet('getEntregaXPrescripcion', nit!, token!, noPrescripcion),
        sisproGet('getProgramacionXPrescripcion', nit!, token!, noPrescripcion),
        sisproGet('getFacturacionXPrescripcion', nit!, token!, noPrescripcion)
      ]);

      if (Array.isArray(resReports.data) && resReports.data.length > 0) {
        const facturasExistentes = Array.isArray(resBills.data) ? resBills.data : [];
        const normalize = (val: any) => String(val || '').replace(/[^a-zA-Z0-9]/g, '').replace(/^0+/, '').trim().toUpperCase();

        // Filtramos: Ocultamos solo si la combinación (NoEntrega + CodTec) ya está facturada
        const reportesPendientes = resReports.data.filter((r: any) => {
          const codReporte = normalize(r.CodSerTecAEntregado);
          // Buscar programación que coincida con Entrega Y Tecnología
          const program = (Array.isArray(resPrograms.data) ? resPrograms.data : []).find((p: any) => 
            Number(p.NoEntrega) === Number(r.NoEntrega) && 
            normalize(p.CodSerTecAEntregar) === codReporte
          );
          
          const codFinal = codReporte || normalize(program?.CodSerTecAEntregar);

          const yaFacturado = facturasExistentes.some((f: any) => {
            const codFacturacion = normalize(f.CodSerTecAEntregado);
            const matches = Number(f.NoEntrega) === Number(r.NoEntrega) && codFacturacion === codFinal;
            
            console.log(`[COMPARACIÓN] Entrega: ${r.NoEntrega} | Reporte: ${codFinal} | Factura: ${codFacturacion} | MATCH: ${matches}`);
            return matches;
          });
          return !yaFacturado;
        });

        if (reportesPendientes.length === 0) {
          setError('Todos los ítems de estas entregas ya han sido facturados.');
          return;
        }

        setSyncRecords(reportesPendientes);
        setSyncDeliveries(Array.isArray(resDeliveries.data) ? resDeliveries.data : []);
        setSyncPrograms(Array.isArray(resPrograms.data) ? resPrograms.data : []);
        setShowSyncModal(true);
        setSuccess(`${reportesPendientes.length} ítem(s) disponibles para facturar.`);
      } else {
        setError('No se encontraron reportes de entrega para esta prescripción.');
      }
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setSyncLoading(false);
    }
  };

  const applySync = (report: any) => {
    const idDir = report.ID || report.IdDireccionamiento;
    
    // Buscar el Paso 4 (Entrega) para obtener la cantidad real
    const delivery = syncDeliveries.find(d => (d.ID || d.IdDireccionamiento) === idDir);
    // Buscar el Paso 3 (Programación) para obtener el código de tecnología exacto
    const program = syncPrograms.find(p => (p.ID || p.IdDireccionamiento) === idDir);

    const cant = Number(delivery?.CantTotEntregada || report.CantUnMinDis || 1);
    const total = Number(report.ValorEntregado || 0);
    // Eliminar decimales según indicaciones de SISPRO
    const unitario = cant > 0 ? Math.round(total / cant).toString() : '0';

    setFormData(prev => ({
      ...prev,
      NoPrescripcion: noPrescripcion,
      TipoIDPaciente: report.TipoIDPaciente || prev.TipoIDPaciente,
      NoIDPaciente: report.NoIDPaciente || prev.NoIDPaciente,
      NoEntrega: String(report.NoEntrega || prev.NoEntrega),
      CodSerTecAEntregado: program?.CodSerTecAEntregar || report.CodSerTecAEntregado || prev.CodSerTecAEntregado,
      CantUnMinDis: String(cant),
      ValorTotFacturado: String(report.ValorEntregado || '0'),
      ValorUnitFacturado: unitario,
      TipoTec: report.TipoTec || prev.TipoTec,
      ConTec: String(report.ConTec || '1')
    }));
    setShowSyncModal(false);
    setSuccess('Datos sincronizados (P3+P4+P5) correctamente.');
  };

  const handleAnular = async () => {
    setLoading(true);
    clearError();
    try {
      // SISPRO puede devolver IDFacturacion (mayúsculas) o IdFacturacion
      const id = selectedResult.IDFacturacion || selectedResult.IdFacturacion || selectedResult.ID;
      await sisproPut('anularFacturacion', nit!, token!, null, id.toString());
      setSuccess(`Facturación ${id} anulada correctamente en SISPRO.`);
      setResultados(prev => prev.filter(r => (r.IDFacturacion || r.IdFacturacion || r.ID) !== id));
      setSelectedResult(null);
      setShowAnularConfirm(false);
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>🧾 Gestión de Facturación</h2>
        <p style={{ color: '#64748b' }}>Consulta y reporte de facturación electrónica en SISPRO (WSFACMIPRESNOPBS).</p>
      </header>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)', marginBottom: '2rem' }}>
        <form onSubmit={handleConsultar} style={{ display: 'flex', gap: '1rem' }}>
          <input
            type="text"
            placeholder="Ingrese No. Prescripción..."
            value={noPrescripcion}
            onChange={(e) => {
              setNoPrescripcion(e.target.value);
            }}
            style={{ flex: 1, padding: '0.875rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none' }}
          />
          <button type="submit" disabled={loading} style={{ padding: '0.875rem 2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
            {loading ? 'Consultando...' : 'Consultar Facturas'}
          </button>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={!noPrescripcion}
            style={{ padding: '0.875rem 1.5rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            📄 Facturar Tecnología
          </button>
        </form>
      </div>

      {resultados.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)', overflow: 'hidden', marginBottom: '2rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '1rem' }}>ID de Facturación</th>
                <th style={{ padding: '1rem' }}>No. Factura</th>
                <th style={{ padding: '1rem' }}>N° Entrega</th>
                <th style={{ padding: '1rem' }}>Tecnología</th>
                <th style={{ padding: '1rem' }}>Valor Total</th>
                <th style={{ padding: '1rem' }}>Estado</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((res, idx) => (
                <tr key={(res.IDFacturacion || res.IdFacturacion || res.ID || idx)} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{res.IDFacturacion || res.IdFacturacion || res.ID || 'S/N'}</td>
                  <td style={{ padding: '1rem', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={res.NoFactura}>
                    {res.NoFactura}
                  </td>
                  <td style={{ padding: '1rem' }}>{res.NoEntrega || '1'}</td>
                  <td style={{ padding: '1rem' }}>{res.CodSerTecAEntregado}</td>
                  <td style={{ padding: '1rem' }}>${res.ValorTotFacturado}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.85rem', 
                      fontWeight: 600,
                      background: !res.FecAnulacion ? '#dcfce7' : '#fee2e2',
                      color: !res.FecAnulacion ? '#166534' : '#991b1b'
                    }}>
                      {!res.FecAnulacion ? 'Activo' : 'Anulado'}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button
                      onClick={() => setSelectedResult(res)}
                      style={{ padding: '0.5rem 1rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}
                    >
                      👁️ Ver Detalle
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Creación Movido aquí */}
      <Modal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)}
        title="Reportar Facturación en SISPRO"
      >
        <form onSubmit={handleCrear} style={{ padding: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
            <button
              type="button"
              onClick={handleSyncFromSuministros}
              disabled={syncLoading}
              style={{ padding: '0.6rem 1rem', background: '#f8fafc', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}
            >
              {syncLoading ? '🔄 Sincronizando...' : '🔄 Traer Datos de Entrega'}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {/* Campos de Identificación */}
            <div>
              <label style={labelStyle}>Tipo ID Paciente</label>
              <select value={formData.TipoIDPaciente} onChange={(e) => setFormData({ ...formData, TipoIDPaciente: e.target.value })} style={inputStyle}>
                <option value="CC">Cédula de Ciudadanía</option>
                <option value="CE">Cédula de Extranjería</option>
                <option value="PA">Pasaporte</option>
                <option value="RC">Registro Civil</option>
                <option value="TI">Tarjeta de Identidad</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>No. ID Paciente</label>
              <input type="text" value={formData.NoIDPaciente} onChange={(e) => setFormData({ ...formData, NoIDPaciente: e.target.value })} style={inputStyle} />
            </div>

            {/* Datos Técnicos */}
            <div>
              <label style={labelStyle}>Tipo Tecnología</label>
              <select value={formData.TipoTec} onChange={(e) => setFormData({ ...formData, TipoTec: e.target.value })} style={inputStyle}>
                <option value="M">M: Medicamento</option>
                <option value="P">P: Procedimiento</option>
                <option value="D">D: Dispositivo médico</option>
                <option value="N">N: Producto Nutricional</option>
                <option value="S">S: Servicio Complementario</option>
                <option value="OTRO">OTRO</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cód. Tecnología</label>
              <input type="text" value={formData.CodSerTecAEntregado} onChange={(e) => setFormData({ ...formData, CodSerTecAEntregado: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>No. Entrega</label>
              <input type="number" value={formData.NoEntrega} onChange={(e) => setFormData({ ...formData, NoEntrega: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cant. Unidades</label>
              <input type="text" value={formData.CantUnMinDis} onChange={(e) => setFormData({ ...formData, CantUnMinDis: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>ConTec (Ítem)</label>
              <input type="number" value={formData.ConTec} onChange={(e) => setFormData({ ...formData, ConTec: e.target.value })} style={inputStyle} title="Consecutivo de tecnología del reporte de entrega" />
            </div>

            {/* Datos de Factura */}
            <div>
              <label style={labelStyle}>No. Factura / CUFE</label>
              <input type="text" value={formData.NoFactura} onChange={(e) => setFormData({ ...formData, NoFactura: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Código EPS</label>
              <select value={formData.CodEPS} onChange={(e) => setFormData({ ...formData, CodEPS: e.target.value })} style={inputStyle}>
                <option value="EPSI04">EPSI04 (Subsidiado)</option>
                <option value="EPSIC4">EPSIC4 (Contributivo)</option>
                <option value="OTRO">OTRO</option>
              </select>
            </div>

            {/* Valores Financieros */}
            <div>
              <label style={labelStyle}>Valor Unitario</label>
              <input type="text" value={formData.ValorUnitFacturado} onChange={(e) => setFormData({ ...formData, ValorUnitFacturado: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Valor Total Facturado</label>
              <input type="text" value={formData.ValorTotFacturado} onChange={(e) => setFormData({ ...formData, ValorTotFacturado: e.target.value })} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Cuota Moderadora / Copago</label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input type="text" placeholder="Cuota" value={formData.CuotaModer} onChange={(e) => setFormData({ ...formData, CuotaModer: e.target.value })} style={inputStyle} />
                <input type="text" placeholder="Copago" value={formData.Copago} onChange={(e) => setFormData({ ...formData, Copago: e.target.value })} style={inputStyle} />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            style={{ width: '100%', padding: '1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1rem' }}
          >
            {loading ? 'Procesando...' : 'Registrar Facturación en SISPRO'}
          </button>
        </form>
      </Modal>

      <Modal
        isOpen={showSyncModal}
        onClose={() => setShowSyncModal(false)}
        title="Seleccionar Entrega (Suministros)"
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          <p style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '1rem' }}>Seleccione el registro de direccionamiento del que desea importar los datos para su facturación.</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead style={{ background: '#f1f5f9' }}>
              <tr>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>N° Entrega</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Tecnología</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Pacientes</th>
                <th style={{ padding: '0.75rem', textAlign: 'left' }}>Valor SISPRO</th>
                <th style={{ padding: '0.75rem', textAlign: 'right' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {syncRecords.map((r, i) => {
                // Buscar el código de tecnología en los datos de programación (P3)
                const program = syncPrograms.find(p => p.NoEntrega === r.NoEntrega && (p.ID || p.IdDireccionamiento) === (r.ID || r.IdDireccionamiento));
                const codigoReal = program?.CodSerTecAEntregar || r.CodSerTecAEntregado || 'Sin código';
                
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem' }}>{r.NoEntrega}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: '600', color: '#2563eb' }}>{codigoReal}</div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>{r.NoIDPaciente}</td>
                    <td style={{ padding: '0.75rem', fontWeight: '600' }}>${r.ValorEntregado}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                      <button
                        onClick={() => applySync(r)}
                        style={{ padding: '0.4rem 0.8rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                      >
                        Importar 📥
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal
        isOpen={selectedResult !== null}
        onClose={() => setSelectedResult(null)}
        title="Detalle de facturación"
      >
        {selectedResult && (
          <>
            <DataGrid data={selectedResult} title="Información enviada a SISPRO" />
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button
                onClick={() => setShowAnularConfirm(true)}
                style={{ padding: '0.75rem 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                🚫 Anular Facturación
              </button>
              <button
                onClick={() => setSelectedResult(null)}
                style={{ padding: '0.75rem 1.5rem', background: '#f1f5f9', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
              >
                Cerrar
              </button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showAnularConfirm}
        onClose={() => setShowAnularConfirm(false)}
        onConfirm={handleAnular}
        title="Confirmar Anulación de Factura"
        message="⚠️ ATENCIÓN: ¿Está seguro de que desea anular esta factura en SISPRO? Esta acción es irreversible."
        confirmText="Confirmar Anulación"
        type="danger"
      />
    </div>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: '#475569',
  marginBottom: '0.4rem',
  textTransform: 'uppercase',
  letterSpacing: '0.025em'
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  border: '1px solid #cbd5e1',
  borderRadius: '8px',
  fontSize: '0.95rem',
  background: '#f8fafc'
};

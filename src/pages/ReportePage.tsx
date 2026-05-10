import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { sisproGet, sisproPut, getProcesos, exportUnitValues } from '../services/api';
import { DataGrid } from '../components/DataGrid';
import { Modal } from '../components/Modal';
import { useAsistente } from '../context/AsistenteContext';
import { getErrorMsg } from '../utils/errorHelper';
import { ConfirmDialog } from '../components/ConfirmDialog';

export const ReportePage = () => {
  const { nit, token } = useAuth();
  const { 
    setError, 
    setSuccess, 
    clearError,
  } = useAsistente();


  const [noPrescripcion, setNoPrescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  const [idLocalAsociado, setIdLocalAsociado] = useState<number | null>(null);
  const [showAnularConfirm, setShowAnularConfirm] = useState(false);

  // Estados para exportación masiva de valores
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exportingValues, setExportingValues] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  // Limpiar mensajes globales al desmontar
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleExportValues = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !nit || !token) return;

    setExportingValues(true);
    clearError();
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('archivo', file);
      formDataUpload.append('nit', nit);
      formDataUpload.append('token', token);

      const blob = await exportUnitValues(formDataUpload);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ValoresUnitarios_MIPRES_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setSuccess('Exportación de valores completada con éxito.');
      setShowExportModal(false); // Cerrar modal al terminar
    } catch (err: any) {
      setError('Error al exportar valores: ' + (err.response?.data?.error || err.message));
    } finally {
      setExportingValues(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noPrescripcion) return setError('Ingrese NoPrescripción');
    setLoading(true); clearError(); setResultados([]); setHasSearched(false);
    try {
      const { data } = await sisproGet('getReporteEntregaXPrescripcion', nit!, token!, noPrescripcion);
      if (Array.isArray(data) && data.length > 0) {
        setResultados(data);
        setSuccess(`${data.length} reporte(s) encontrado(s) en SISPRO.`);
      } else {
        setSuccess('No existen reportes en SISPRO para esta prescripción.');
      }
      setHasSearched(true);
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const handleVerDetalle = async (res: any) => {
    setSelectedResult(res);
    setIdLocalAsociado(null);
    try {
      const procesosLocales = await getProcesos();
      const match = procesosLocales.data?.find((p: any) => p.id_mipres === String(res.IdDireccionamiento || res.ID));
      if (match) setIdLocalAsociado(match.id_local);
    } catch (e) {
      console.error('Error buscando ID local', e);
    }
  };


  const handleAnular = async () => {
    setLoading(true); clearError();
    try {
      // PRIORIDAD: IDReporteEntrega es el ID técnico para anular.
      const id = selectedResult.IDReporteEntrega || selectedResult.IdReporteEntrega || selectedResult.ID;
      await sisproPut('anularReporteEntrega', nit!, token!, null, id.toString());
      setSuccess(`Reporte ${id} anulado correctamente en SISPRO.`);
      setResultados(prev => prev.filter(r => (r.IDReporteEntrega || r.IdReporteEntrega || r.ID) !== id));
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
        <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Consulta de Reportes</h2>
        <p style={{ color: '#64748b' }}>Historico de reportes de entrega realizados en SISPRO.</p>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ flex: 1, background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
          <form onSubmit={handleConsultar} style={{ display: 'flex', gap: '1rem' }}>
            <input
              type="text"
              placeholder="Ingrese No. Prescripción..."
              value={noPrescripcion}
              onChange={(e) => {
                setNoPrescripcion(e.target.value);
                setHasSearched(false);
              }}
              style={{ flex: 1, padding: '0.875rem 1rem', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '1rem', outline: 'none' }}
            />
            <button type="submit" disabled={loading} style={{ padding: '0.875rem 2rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}>
              {loading ? 'Consultando...' : 'Consultar SISPRO'}
            </button>
          </form>
        </div>

        <button 
          onClick={() => setShowExportModal(true)}
          style={{ 
            padding: '0.875rem 1.5rem', 
            background: '#8b5cf6', 
            color: 'white', 
            border: 'none', 
            borderRadius: '12px', 
            cursor: 'pointer', 
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}
        >
          📊 Exportar Valores Unitarios
        </button>
      </div>

      {resultados.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '1rem' }}>ID SISPRO (Rep)</th>
                <th style={{ padding: '1rem' }}>N° Entrega</th>
                <th style={{ padding: '1rem' }}>Estado Entrega</th>
                <th style={{ padding: '1rem' }}>Valor</th>
                <th style={{ padding: '1rem' }}>Estado</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((res, idx) => (
                <tr key={res.IDReporteEntrega || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{res.IDReporteEntrega || res.IdReporteEntrega || res.ID}</td>
                  <td style={{ padding: '1rem' }}>{res.NoEntrega || '1'}</td>
                  <td style={{ padding: '1rem' }}>{res.EstadoEntrega === 1 ? 'Efectiva' : 'No Efectiva'}</td>
                  <td style={{ padding: '1rem' }}>${res.ValorEntregado}</td>
                  <td style={{ padding: '1rem' }}>{res.FecAnulacion ? <span style={{ color: '#ef4444' }}>Anulado</span> : <span style={{ color: '#10b981' }}>Activo</span>}</td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    <button 
                      onClick={() => handleVerDetalle(res)}
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

      {hasSearched && resultados.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
          <p>No se encontraron reportes para esta prescripción.</p>
        </div>
      )}

      {/* MODAL DE EXPORTACIÓN MASIVA */}
      <Modal 
        isOpen={showExportModal} 
        onClose={() => !exportingValues && setShowExportModal(false)} 
        title="Exportación Masiva de Valores Unitarios"
      >
        <div style={{ padding: '1rem 0' }}>
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📖 Instrucciones de la Plantilla
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', color: '#0c4a6e', lineHeight: '1.6' }}>
              <li>El archivo debe ser un Excel (<strong>.xlsx</strong> o <strong>.xls</strong>).</li>
              <li>Debe contener una columna llamada exactamente <strong>N° MIPRES</strong> o <strong>PRESCRIPCION</strong>.</li>
              <li>El sistema buscará automáticamente en SISPRO el valor total reportado y lo dividirá por la cantidad entregada para darte el valor unitario por tecnología.</li>
            </ul>
          </div>

          <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed #e2e8f0', borderRadius: '12px', background: '#f8fafc' }}>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleExportValues} 
              style={{ display: 'none' }} 
              accept=".xlsx,.xls"
            />
            
            {exportingValues ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>Procesando datos en SISPRO...</p>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Esto puede tardar unos segundos dependiendo de la cantidad de registros.</p>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  style={{ 
                    padding: '1rem 2rem', 
                    background: '#8b5cf6', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    fontWeight: 700,
                    fontSize: '1rem',
                    boxShadow: '0 4px 6px -1px rgba(139, 92, 246, 0.3)'
                  }}
                >
                  📁 Seleccionar Archivo Excel
                </button>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '1rem' }}>
                  Haz clic para elegir tu plantilla de MIPRES
                </p>
              </>
            )}
          </div>
        </div>
      </Modal>

      <Modal 
        isOpen={selectedResult !== null} 
        onClose={() => setSelectedResult(null)} 
        title="Detalle de Reporte"
      >
        {selectedResult && (
          <>
            <DataGrid 
              data={{ ...selectedResult, id_local: idLocalAsociado }} 
              title="Información del Reporte" 
            />
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              {!selectedResult.FecAnulacion && (
                <button 
                  onClick={() => setShowAnularConfirm(true)}
                  style={{ padding: '0.75rem 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  🚫 Anular Reporte
                </button>
              )}
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
        title="Confirmar Anulación"
        message="⚠️ ATENCIÓN: ¿Está seguro de que desea anular este reporte de entrega en SISPRO? Esta acción no se puede deshacer."
        confirmText="Confirmar Anulación"
        type="danger"
      />

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
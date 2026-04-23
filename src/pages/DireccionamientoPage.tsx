import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sisproGet, sisproPut, getProcesos } from '../services/api';
import { DataGrid } from '../components/DataGrid';
import { Modal } from '../components/Modal';
import { useAsistente } from '../context/AsistenteContext';
import { useNavigate } from 'react-router-dom';
import { getErrorMsg } from '../utils/errorHelper';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { syncAsistenteFromSispro } from '../services/api';

export const DireccionamientoPage = () => {
  const { nit, token } = useAuth();
  const { 
    updateProcesoFromDb, 
    setError, 
    setSuccess, 
    clearError
  } = useAsistente();
  const navigate = useNavigate();

  const [noPrescripcion, setNoPrescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  const [idLocalAsociado, setIdLocalAsociado] = useState<number | null>(null);
  const [showAnularConfirm, setShowAnularConfirm] = useState(false);

  // Limpiar mensajes globales al desmontar
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noPrescripcion) return setError('Ingrese NoPrescripción');
    setLoading(true); clearError(); setResultados([]); setHasSearched(false);
    try {
      const { data } = await sisproGet('getDireccionamientoXPrescripcion', nit!, token!, noPrescripcion);
      if (Array.isArray(data) && data.length > 0) {
        setResultados(data);
        setSuccess(`${data.length} direccionamiento(s) encontrado(s) en SISPRO.`);
      } else {
        setSuccess('No existen direccionamientos en SISPRO para esta prescripción.');
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

  const handleJumpToAsistente = async (record: any) => {
    if (!nit || !token || !noPrescripcion) return;
    setLoading(true);
    try {
      const response = await syncAsistenteFromSispro({
        nit: nit!,
        token: token!,
        no_prescripcion: noPrescripcion,
        sisproRecord: record
      });
      
      if (response.ok && response.data?.proceso) {
        updateProcesoFromDb(response.data.proceso);
        navigate('/asistente');
      } else {
        setError('No se pudo sincronizar el proceso con el Asistente.');
      }
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAnular = async () => {
    setLoading(true); clearError();
    try {
      // PRIORIDAD: IdDireccionamiento es el ID técnico para anular.
      const id = selectedResult.IdDireccionamiento || selectedResult.IDDireccionamiento || selectedResult.ID;
      await sisproPut('anularDireccionamiento', nit!, token!, null, id.toString());
      setSuccess(`Direccionamiento ${id} anulado correctamente en SISPRO.`);
      setResultados(prev => prev.filter(r => (r.IdDireccionamiento || r.IDDireccionamiento || r.ID) !== id));
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
        <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Consulta de Direccionamientos</h2>
        <p style={{ color: '#64748b' }}>Historico de envios realizados a SISPRO para una prescripción.</p>
      </header>

      <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)', marginBottom: '2rem' }}>
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

      {resultados.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '1rem' }}>ID SISPRO (Direc)</th>
                <th style={{ padding: '1rem' }}>Tecnología</th>
                <th style={{ padding: '1rem' }}>N° Entrega</th>
                <th style={{ padding: '1rem' }}>Estado</th>
                <th style={{ padding: '1rem' }}>Fec. Direccionado</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((res, idx) => (
                <tr key={res.IdDireccionamiento || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{res.IdDireccionamiento || res.IDDireccionamiento || res.ID}</td>
                  <td style={{ padding: '1rem' }}>{res.TipoTec} - {res.ConTec}</td>
                  <td style={{ padding: '1rem' }}>{res.NoEntrega || '1'}</td>
                  <td style={{ padding: '1rem' }}>{res.EstDireccionamiento === 0 ? <span style={{ color: '#ef4444' }}>Anulado</span> : <span style={{ color: '#10b981' }}>Activo</span>}</td>
                  <td style={{ padding: '1rem' }}>{res.FecDireccionamiento}</td>
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
          <p>No se encontraron resultados para esta prescripción.</p>
        </div>
      )}

      <Modal 
        isOpen={selectedResult !== null} 
        onClose={() => setSelectedResult(null)} 
        title="Detalle de facturación"
      >
        {selectedResult && (
          <>
            <DataGrid 
              data={{ ...selectedResult, id_local: idLocalAsociado }} 
              title="Información Completa" 
              onOpenInAsistente={handleJumpToAsistente} 
            />
            <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              {selectedResult.EstDireccionamiento !== 0 && (
                <button 
                  onClick={() => setShowAnularConfirm(true)}
                  style={{ padding: '0.75rem 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  🚫 Anular Direccionamiento
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
        message="⚠️ ATENCIÓN: ¿Está seguro de que desea anular este direccionamiento en SISPRO? Esta acción no se puede deshacer."
        confirmText="Confirmar Anulación"
        type="danger"
      />
    </div>
  );
};
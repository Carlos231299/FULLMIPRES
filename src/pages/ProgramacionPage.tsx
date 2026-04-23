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

export const ProgramacionPage = () => {
  const { nit, token } = useAuth();
  const { 
    updateProcesoFromDb, 
    setError, 
    setSuccess, 
    clearError,
    startSyncProcess
  } = useAsistente();
  const navigate = useNavigate();

  const handleProcesarPrescripcion = async () => {
    if (!noPrescripcion) return setError('Ingrese NoPrescripción');
    setLoading(true);
    try {
      await startSyncProcess(noPrescripcion, null);
      navigate('/asistente');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const [noPrescripcion, setNoPrescripcion] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultados, setResultados] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  const [idLocalAsociado, setIdLocalAsociado] = useState<number | null>(null);
  const [showAnularConfirm, setShowAnularConfirm] = useState(false);

  const [formData, setFormData] = useState({
    ID: '',
    FecProg: new Date().toISOString().split('T')[0],
    CantProg: '1'
  });

  // Limpiar mensajes globales al desmontar
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleConsultar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noPrescripcion) return setError('Ingrese NoPrescripción');
    setLoading(true); clearError(); setResultados([]); setHasSearched(false);
    try {
      const { data } = await sisproGet('getProgramacionXPrescripcion', nit!, token!, noPrescripcion);
      if (Array.isArray(data) && data.length > 0) {
        setResultados(data);
        setSuccess(`${data.length} programación(es) encontrada(s) en SISPRO.`);
      } else {
        setSuccess('No existen programaciones en SISPRO. Puede crear una nueva.');
        setFormData(prev => ({ ...prev, NoPrescripcion: noPrescripcion }));
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

  const handleCrear = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); clearError();
    try {
      const { data } = await sisproPut('programacion', nit!, token!, formData);
      setSuccess(`Programación registrada con éxito.`);
      setResultados([data]);
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setLoading(false);
    }
  };

  const handleAnular = async () => {
    setLoading(true); clearError();
    try {
      // PRIORIDAD: Usar IdProgramacion para anular, NO el ID registro.
      const id = selectedResult.IdProgramacion || selectedResult.IDProgramacion || selectedResult.ID;
      await sisproPut('anularProgramacion', nit!, token!, null, id.toString());
      setSuccess(`Programación ${id} anulada correctamente en SISPRO.`);
      setResultados(prev => prev.filter(r => (r.IdProgramacion || r.IDProgramacion || r.ID) !== id));
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
        <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>Programación de Entregas</h2>
        <p style={{ color: '#64748b' }}>Consulta y gestión de programaciones en SISPRO.</p>
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
          <button 
            type="button" 
            disabled={loading || !noPrescripcion} 
            onClick={handleProcesarPrescripcion} 
            style={{ padding: '0.875rem 2rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
          >
             🚀 Procesar
          </button>
        </form>
      </div>

      {resultados.length > 0 && (
        <div style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '1rem' }}>ID SISPRO (Prog)</th>
                <th style={{ padding: '1rem' }}>Sede Prov.</th>
                <th style={{ padding: '1rem' }}>N° Entrega</th>
                <th style={{ padding: '1rem' }}>Fec. Max Ent.</th>
                <th style={{ padding: '1rem' }}>Cantidad</th>
                <th style={{ padding: '1rem' }}>Estado</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {resultados.map((res, idx) => (
                <tr key={res.IdProgramacion || idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '1rem', fontWeight: 600 }}>{res.IdProgramacion || res.IDProgramacion || res.ID}</td>
                  <td style={{ padding: '1rem' }}>{res.CodSedeProv}</td>
                  <td style={{ padding: '1rem' }}>{res.NoEntrega || '1'}</td>
                  <td style={{ padding: '1rem' }}>{res.FecMaxEnt}</td>
                  <td style={{ padding: '1rem' }}>{res.CantTotAEntregar}</td>
                  <td style={{ padding: '1rem' }}>{res.FecAnulacion ? <span style={{ color: '#ef4444' }}>Anulado</span> : <span style={{ color: '#10b981' }}>Activo</span>}</td>
                  <td style={{ padding: '1rem', textAlign: 'right', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                    <button 
                      onClick={() => handleVerDetalle(res)}
                      style={{ padding: '0.5rem 0.8rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer', fontWeight: 500, fontSize: '0.85rem' }}
                    >
                      👁️ Detalle
                    </button>
                    <button 
                      onClick={() => handleJumpToAsistente(res)}
                      disabled={loading || !!res.FecAnulacion}
                      style={{ padding: '0.5rem 0.8rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}
                    >
                      🚀 Procesar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {hasSearched && resultados.length === 0 && (
        <form onSubmit={handleCrear} style={{ background: 'white', padding: '2rem', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)' }}>
          <h3 style={{ marginTop: 0, marginBottom: '1.5rem', color: '#1e293b' }}>Registrar Nueva Programación</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            {Object.keys(formData).map((key) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem' }}>{key}</label>
                <input
                  type="text"
                  value={(formData as any)[key]}
                  onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                  style={{ width: '100%', padding: '0.75rem', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                />
              </div>
            ))}
          </div>
          <button type="submit" disabled={loading} style={{ width: '100%', padding: '1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem' }}>
            Confirmar en SISPRO
          </button>
        </form>
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
              {!selectedResult.FecAnulacion && (
                <button 
                  onClick={() => setShowAnularConfirm(true)}
                  style={{ padding: '0.75rem 1.5rem', background: '#ef4444', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
                >
                  🚫 Anular Programación
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
        message="⚠️ ATENCIÓN: ¿Está seguro de que desea anular esta programación en SISPRO? Esta acción no se puede deshacer."
        confirmText="Confirmar Anulación"
        type="danger"
      />
    </div>
  );
};
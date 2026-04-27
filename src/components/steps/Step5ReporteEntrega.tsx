import { useState } from 'react';
import { useAsistente } from '../../context/AsistenteContext';

import { asistenteReporte, asistenteSkipStep } from '../../services/api';
import { exportProcessToExcel } from '../../utils/excelExport';
import { getErrorMsg } from '../../utils/errorHelper';

export const Step5ReporteEntrega = () => {
  const {
    proceso,
    updateProcesoFromDb,
    isLoading,
    setIsLoading,
    setError,
    clearError,
    setSuccess,
    goBack,
    asistenteMode
  } = useAsistente();



  const isNoEntrega = asistenteMode === 'no-entrega';

  const [formData, setFormData] = useState({
    EstadoEntrega: isNoEntrega ? '' : '1',
    CausaNoEntrega: isNoEntrega ? '7' : '0',
    ValorEntregado: ''
  });
  const [successMsg, setSuccessMsg] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleExportExcel = async () => {
    if (!proceso) return;
    setIsExporting(true);
    try {
      await exportProcessToExcel(proceso);
    } catch (err: any) {
      setError('Error al generar Excel: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg('');

    const currentProceso = proceso;
    
    if (!currentProceso || !currentProceso.id_local) {
      setError('No hay un proceso activo para reportar.');
      return;
    }

    if (!currentProceso.id_mipres) {
      setError('Falta el ID de Direccionamiento. No se puede reportar.');
      return;
    }

    if (!isNoEntrega && !formData.ValorEntregado.trim()) {
      setError('El valor entregado es obligatorio.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const payload = isNoEntrega
        ? {
          ID: Number(currentProceso.id_mipres),
          EstadoEntrega: '',
          CausaNoEntrega: '7',
          ValorEntregado: ''
        }
        : {
          EstadoEntrega: Number(formData.EstadoEntrega),
          CausaNoEntrega: formData.EstadoEntrega === '1' ? 0 : Number(formData.CausaNoEntrega),
          ValorEntregado: Number(formData.ValorEntregado)
        };

      const response = await asistenteReporte(currentProceso.id_local, payload);

      if (response.ok && response.data?.proceso) {
        const msg = `Reporte registrado con éxito. ID Reporte: ${response.data.proceso.id_reporte}. ¡PROCESO COMPLETADO!`;
        setSuccessMsg(msg);
        setSuccess(msg);

        setTimeout(() => {
          updateProcesoFromDb(response.data.proceso);
        }, 3000);
      } else {
        setError('Respuesta inválida del servidor.');
      }
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    if (!proceso?.id_local) return;
    setIsLoading(true);
    clearError();
    try {
      const response = await asistenteSkipStep(proceso.id_local, 5);
      if (response.ok && response.data?.proceso) {
        updateProcesoFromDb(response.data.proceso);
      } else {
        setError('No se pudo obtener el reporte existente de SISPRO.');
      }
    } catch (err: any) {
      setError(getErrorMsg(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Paso 5: Reporte de Entrega</h3>
        {proceso?.estado !== 'REPORTADO' && (
          <button onClick={goBack} disabled={isLoading} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#e2e8f0', color: '#1e293b' }}>
            ← Regresar
          </button>
        )}
      </div>

      <div className="alert" style={{ backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <p style={{ margin: 0 }}>📌 <strong>ID Direccionamiento a referenciar:</strong> {proceso?.id_mipres || 'Ninguno'}</p>
      </div>

      {/* Botón de escape si el reporte ya fue registrado en SISPRO */}
      {proceso?.estado !== 'REPORTADO' && (
        <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
          <button
            type="button"
            onClick={handleSkip}
            disabled={isLoading}
            style={{
              background: '#f59e0b', color: 'white', border: 'none',
              borderRadius: '8px', padding: '0.6rem 1.2rem',
              fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem'
            }}
          >
            {isLoading ? '...' : '⏭️ Este paso ya está hecho → Marcar como Completado'}
          </button>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Úsalo solo si SISPRO ya tiene este reporte registrado.
          </p>
        </div>
      )}
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Finaliza el proceso reportando el valor económico de lo entregado o los motivos de no entrega física.
      </p>

      {successMsg && (
        <div className="alert" style={{ backgroundColor: '#ecfdf5', color: 'var(--success)', border: '1px solid #a7f3d0' }}>
          ✨ {successMsg}
        </div>
      )}

      {proceso?.estado === 'REPORTADO' ? (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <h2 style={{ color: 'var(--success)', marginBottom: '1rem' }}>¡Asistente {isNoEntrega ? 'No Entrega' : ''} Completado! 🎉</h2>
          <p>
            {isNoEntrega
              ? 'Se ha registrado la No Entrega administrativa (Causa 7) exitosamente.'
              : 'La información ha sido validada, entregada y reportada en SISPRO exitosamente.'
            }
          </p>
          <div style={{ marginTop: '1.5rem', padding: '1.5rem', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '0.9rem', textAlign: 'left', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <p style={{ margin: 0 }}><strong>ID Local:</strong> <span style={{ color: '#2563eb' }}>#{proceso.id_local}</span></p>
            <p style={{ margin: 0 }}><strong>ID Direccionamiento:</strong> {proceso.id_mipres}</p>
            <p style={{ margin: 0 }}><strong>Modalidad:</strong> {isNoEntrega ? 'No Entrega (Causa 7)' : 'Entrega Efectiva'}</p>
            <p style={{ margin: 0 }}><strong>ID Reporte Final:</strong> {proceso.id_reporte}</p>
          </div>

          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
            <button
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.5rem', background: '#10b981' }}
              onClick={handleExportExcel}
              disabled={isExporting}
            >
              {isExporting ? 'Generando...' : '📄 Descargar Reporte (Excel)'}
            </button>
            <button
              className="btn btn-primary"
              style={{ padding: '0.75rem 1.5rem', background: '#ef4444' }}
              onClick={() => window.location.reload()}
            >
              Iniciar Nuevo Trámite
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>

          {isNoEntrega ? (
            <div style={{ padding: '1.5rem', background: '#fff7ed', border: '1px solid #ffedd5', borderRadius: '12px', textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: 600, color: '#9a3412' }}>Cierre Administrativo del Proceso</p>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: '#c2410c' }}>
                Se reportará la Causa 7 (Administrativa) con valor $0 (vacío) a SISPRO.
              </p>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label htmlFor="EstadoEntrega">Estado de la Entrega:</label>
                <select
                  id="EstadoEntrega"
                  name="EstadoEntrega"
                  className="form-control"
                  value={formData.EstadoEntrega}
                  onChange={handleChange}
                  disabled={isLoading || !!successMsg}
                >
                  <option value="1">Entrega Efectiva (1)</option>
                  <option value="0">No se entregó (0)</option>
                </select>
              </div>

              {formData.EstadoEntrega === '0' && (
                <div className="form-group">
                  <label htmlFor="CausaNoEntrega">Causa Genérica de No Entrega:</label>
                  <select
                    id="CausaNoEntrega"
                    name="CausaNoEntrega"
                    className="form-control"
                    value={formData.CausaNoEntrega}
                    onChange={handleChange}
                    disabled={isLoading || !!successMsg}
                    required
                  >
                    <option value="0" disabled>Seleccione una causa...</option>
                    <option value="1">1 - Paciente no asiste</option>
                    <option value="2">2 - Falta de inventario / Stock</option>
                    <option value="3">3 - Problemas de transporte / Logística</option>
                    <option value="4">4 - Tecnología médica en mal estado</option>
                    <option value="5">5 - Negativa del paciente a recibir</option>
                    <option value="6">6 - Prescripción vencida</option>
                    <option value="99">99 - Otras causas operativas</option>
                  </select>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="ValorEntregado">Valor Entregado (COP):</label>
                <input
                  id="ValorEntregado"
                  name="ValorEntregado"
                  type="number"
                  className="form-control"
                  value={formData.ValorEntregado}
                  onChange={handleChange}
                  placeholder="Ej: 50000"
                  disabled={isLoading || !!successMsg}
                />
              </div>
            </>
          )}

          <div style={{ marginTop: '1rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isLoading || !!successMsg}
              style={{ width: '100%', padding: '1rem', background: isNoEntrega ? '#f97316' : '' }}
            >
              {isLoading ? 'Reportando a SISPRO...' : (isNoEntrega ? 'Confirmar Reporte No Entrega (Causa 7)' : 'Finalizar y Reportar Entrega')}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

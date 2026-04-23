import { useState, useEffect } from 'react';
import { useAsistente } from '../context/AsistenteContext';
import { Stepper } from './Stepper';

import { Step2Direccionamiento } from './steps/Step2Direccionamiento';
import { Step3Programacion } from './steps/Step3Programacion';
import { Step4Entrega } from './steps/Step4Entrega';
import { Step5ReporteEntrega } from './steps/Step5ReporteEntrega';
import { getProceso } from '../services/api';

interface AsistenteContainerProps {
  mode: 'standard' | 'no-entrega';
}

export const AsistenteContainer = ({ mode }: AsistenteContainerProps) => {
  const { 
    currentStep, 
    proceso, 
    updateProcesoFromDb, 
    clearError, 
    setError,
    setAsistenteMode 
  } = useAsistente();
  
  // Sincronizar el modo del asistente al montar el componente
  useEffect(() => {
    setAsistenteMode(mode);
  }, [mode, setAsistenteMode]);

  const [loadId, setLoadId] = useState('');
  const [isResuming, setIsResuming] = useState(false);

  const handleResume = async () => {
    if (!loadId) return;
    setIsResuming(true);
    clearError();
    try {
      const data = await getProceso(Number(loadId));
      if (data && data.id_local) {
        updateProcesoFromDb(data);
      } else {
        setError('Proceso no encontrado.');
      }
    } catch (err) {
      setError('Error al cargar proceso.');
    } finally {
      setIsResuming(false);
    }
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        // El paso 1 ahora es el inicio o token, pero como ya entran logueados, 
        // los mandamos al 2 o mostramos un inicio. Por ahora Paso 2.
        return <Step2Direccionamiento />;
      case 2:
        return <Step2Direccionamiento />;
      case 3:
        return <Step3Programacion />;
      case 4:
        return <Step4Entrega />;
      case 5:
        return <Step5ReporteEntrega />;
      default:
        return <div style={{ textAlign: 'center', padding: '2rem' }}>Asistente completado o en estado desconocido.</div>;
    }
  };

  return (
    <div className="app-container" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'flex-start', 
        marginBottom: '2rem',
        padding: '1.5rem',
        background: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        border: '1px solid #e2e8f0'
      }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            🧙 Asistente {mode === 'no-entrega' ? 'No Entrega' : 'MIPRES Inteligente'}
          </h2>
          <p style={{ color: '#64748b', marginTop: '0.5rem', fontSize: '0.9rem', maxWidth: '600px' }}>
            {mode === 'no-entrega' ? 
              'Este modo automatiza la No Entrega administrativa (Causa 7) en los pasos finales.' : 
              'Este asistente automatiza el flujo completo de SISPRO. Cada trámite genera un ID Local.'
            }
          </p>
        </div>
        
        <div style={{ marginLeft: '2rem' }}>
          {proceso ? (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'flex-end',
              gap: '0.25rem'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>Trámite Activo</span>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: 800, 
                color: '#2563eb', 
                background: '#eff6ff', 
                padding: '0.5rem 1rem', 
                borderRadius: '8px',
                border: '1px solid #bfdbfe'
              }}>
                #{proceso.id_local}
              </div>
            </div>
          ) : (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b' }}>RETOMAR TRÁMITE ANTERIOR</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="number" 
                  placeholder="Ej: 42" 
                  style={{ 
                    width: '100px', 
                    padding: '0.6rem', 
                    borderRadius: '8px', 
                    border: '1px solid #cbd5e1',
                    outline: 'none'
                  }} 
                  value={loadId} 
                  onChange={e => setLoadId(e.target.value)} 
                />
                <button 
                  onClick={handleResume} 
                  disabled={isResuming || !loadId} 
                  style={{ 
                    padding: '0.6rem 1.25rem', 
                    background: '#1e293b', 
                    color: 'white', 
                    border: 'none', 
                    borderRadius: '8px', 
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {isResuming ? '...' : 'Retomar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <Stepper />

      <div className="card">
        {renderCurrentStep()}
      </div>
    </div>
  );
};

import { useState } from 'react';
import { useAsistente } from '../../context/AsistenteContext';
import { useAuth } from '../../context/AuthContext';
import { asistenteVerificarDireccionamiento, createProceso } from '../../services/api';
import { getErrorMsg } from '../../utils/errorHelper';

// Ahora es el Paso 1 real del Asistente, aunque conserve el nombre.
export const Step2Direccionamiento = () => {
  const { proceso, setProceso, updateProcesoFromDb, isLoading, setIsLoading, setError, clearError, goBack } = useAsistente();
  const { nit, token } = useAuth();

  const [formData, setFormData] = useState({
    NoPrescripcion: ''
  });

  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg('');

    if (!formData.NoPrescripcion.trim()) {
      setError('El Número de Prescripción es obligatorio.');
      return;
    }

    if (!nit || !token) {
      setError('No hay sesión activa de SISPRO. Vuelve a iniciar sesión.');
      return;
    }

    setIsLoading(true);
    try {
      // 1. Crear el proceso a rastrear localmente si no existe
      let idLocal = proceso?.id_local;
      
      if (!idLocal) {
        const response = await createProceso({ nit, token });
        if (response.ok && response.data) {
          idLocal = response.data.id_local;
          // Sincronizar el proceso en el contexto para que los siguientes pasos lo tengan
          setProceso(response.data);
        } else {
          throw new Error('No se pudo crear el registro del proceso local.');
        }
      }

      // 2. Llamamos a la nueva ruta en el backend usando el ID obtenido
      const response = await asistenteVerificarDireccionamiento(idLocal!, {
        NoPrescripcion: formData.NoPrescripcion
      });

      if (response.ok && response.data?.proceso) {
        setSuccessMsg(`¡Verificado con éxito! ID extraído: ${response.data.proceso.id_mipres}`);
        
        setTimeout(() => {
          updateProcesoFromDb(response.data.proceso);
        }, 2000);
      } else {
        setError('Respuesta inválida del servidor.');
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
        <h3 style={{ margin: 0 }}>Paso 2: Verificar Prescripción y Direccionamiento</h3>
        <button onClick={goBack} disabled={isLoading} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#e2e8f0', color: '#1e293b' }}>
          ← Regresar
        </button>
      </div>
      
      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        El sistema verificará automáticamente en MIPRES si ya existe una entrega previa para esta prescripción. 
        Si no la hay, se extraerá el <strong>ID de Direccionamiento</strong> y los datos clínicos 
        directamente del servidor para que no debas digitarlos manualmente.
      </p>

      {successMsg && (
        <div className="alert" style={{ backgroundColor: '#ecfdf5', color: 'var(--success)', border: '1px solid #a7f3d0' }}>
          ✓ {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-group" style={{ background: '#f8fafc', padding: '1.2rem', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ fontWeight: 600, color: '#1e293b' }}>No. Prescripción:</label>
          <input
            id="NoPrescripcion"
            name="NoPrescripcion"
            type="text"
            className="form-control"
            value={formData.NoPrescripcion}
            onChange={handleChange}
            placeholder="Ej: 2024..."
            disabled={isLoading || !!successMsg}
            style={{ marginTop: '0.5rem' }}
          />
        </div>
        
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isLoading || !!successMsg}
          style={{ width: '100%', padding: '0.8rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 }}
        >
          {isLoading ? '...' : 'Guardar y Continuar'}
        </button>
      </form>
    </div>
  );
};

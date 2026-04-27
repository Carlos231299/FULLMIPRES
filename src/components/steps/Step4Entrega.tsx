import { useState } from 'react';
import { useAsistente } from '../../context/AsistenteContext';
import { asistenteEntrega, asistenteSkipStep } from '../../services/api';
import { getErrorMsg } from '../../utils/errorHelper';

export const Step4Entrega = () => {
  const { proceso, updateProcesoFromDb, isLoading, setIsLoading, setError, clearError, goBack, setSuccess } = useAsistente();

  const [formData, setFormData] = useState({
    FecEntrega: new Date().toISOString().split('T')[0],
    TipoIDRecibe: 'CC',
    NoIDRecibe: '',
    CodMunEnt: '05001',
    CausaNoEntrega: '0',
    ValorEntregado: '0'
  });

  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Validación: Si es el número de identificación, solo permitir números
    if (name === 'NoIDRecibe') {
      const onlyNums = value.replace(/[^0-9]/g, '');
      setFormData({ ...formData, [name]: onlyNums });
      return;
    }

    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg('');

    // Validación preventiva de identificación
    if (formData.CausaNoEntrega === '0' && (!formData.NoIDRecibe || formData.NoIDRecibe.length < 5)) {
      setError('El número de identificación ingresado es demasiado corto o inválido.');
      return;
    }

    if (!proceso || !proceso.id_programacion) {
      setError('Falta el ID de Programación. Completa el paso anterior.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await asistenteEntrega(proceso.id_local, {
        ...formData,
        ID: Number(proceso.id_mipres)
      });

      if (response.ok && response.data?.proceso) {
        setSuccessMsg(`Entrega registrada con éxito. ID: ${response.data.proceso.id_entrega}`);
        setSuccess('Entrega guardada.');
        setTimeout(() => {
          updateProcesoFromDb(response.data.proceso);
          setCurrentStep(5); // Avanzar solo al 5
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

  const handleSkip = async () => {
    if (!proceso?.id_local) return;
    setIsLoading(true);
    clearError();
    try {
      const response = await asistenteSkipStep(proceso.id_local, 4);
      if (response.ok && response.data?.proceso) {
        updateProcesoFromDb(response.data.proceso);
        setCurrentStep(5); // Avanzar manualmente al 5
      } else {
        setError('No se pudo obtener la entrega existente de SISPRO.');
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
        <h3 style={{ margin: 0 }}>Paso 4: Reportar Entrega Física</h3>
        <button onClick={goBack} disabled={isLoading} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#e2e8f0', color: '#1e293b' }}>
          ← Regresar
        </button>
      </div>

      <div className="alert" style={{ backgroundColor: '#f8fafc', color: '#475569', border: '1px solid #e2e8f0', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <p style={{ margin: '0 0 0.5rem 0' }}>📌 <strong>ID Direccionamiento a referenciar:</strong> {proceso?.id_mipres || 'Ninguno'}</p>
        <p style={{ margin: 0 }}>Recuerda verificar bien las cantidades antes de confirmar.</p>
      </div>

      {successMsg && (
        <div className="alert" style={{ backgroundColor: '#ecfdf5', color: 'var(--success)', border: '1px solid #a7f3d0' }}>
          ✓ {successMsg}
        </div>
      )}

      {/* Botón de escape si la entrega ya fue registrada en SISPRO */}
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
          {isLoading ? '...' : '⏭️ Este paso ya está hecho → Ir al Paso 5'}
        </button>
        <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
          Úsalo solo si SISPRO ya tiene esta entrega registrada.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-2" style={{ gap: '1rem' }}>
        <div className="form-group">
          <label>Fecha de Entrega:</label>
          <input type="date" name="FecEntrega" className="form-control" value={formData.FecEntrega} onChange={handleChange} required disabled={isLoading || !!successMsg} />
        </div>
        <div className="form-group">
          <label>Tipo ID Recibe:</label>
          <select name="TipoIDRecibe" className="form-control" value={formData.TipoIDRecibe} onChange={handleChange} required disabled={isLoading || !!successMsg}>
            <option value="CC">Cédula de Ciudadanía</option>
            <option value="TI">Tarjeta de Identidad</option>
            <option value="CE">Cédula de Extranjería</option>
            <option value="PA">Pasaporte</option>
            <option value="RC">Registro Civil</option>
            <option value="AS">Adulto Sin Identificación</option>
            <option value="MS">Menor Sin Identificación</option>
          </select>
        </div>
        <div className="form-group">
          <label>Número ID Recibe:</label>
          <input type="text" name="NoIDRecibe" className="form-control" value={formData.NoIDRecibe} onChange={handleChange} required placeholder="Documento del que recibe" disabled={isLoading || !!successMsg} />
        </div>
        <div className="form-group">
          <label>Causa No Entrega:</label>
          <select name="CausaNoEntrega" className="form-control" value={formData.CausaNoEntrega} onChange={handleChange} required disabled={isLoading || !!successMsg}>
            <option value="0">Entrega Exitosa</option>
            <option value="1">Paciente no acepta</option>
            <option value="2">Dirección no encontrada</option>
            <option value="7">No entrega administrativa</option>
          </select>
        </div>
        
        <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '0.8rem', background: '#2563eb', fontWeight: 600 }} disabled={isLoading || !!successMsg}>
            {isLoading ? 'Procesando...' : 'Confirmar Entrega en SISPRO'}
          </button>
        </div>
      </form>
    </div>
  );
};

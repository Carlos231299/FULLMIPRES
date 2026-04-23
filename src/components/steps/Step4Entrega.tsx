import { useState } from 'react';
import { useAsistente } from '../../context/AsistenteContext';
import { asistenteEntrega } from '../../services/api';

export const Step4Entrega = () => {
  const { proceso, updateProcesoFromDb, isLoading, setIsLoading, setError, clearError, goBack, setSuccess } = useAsistente();

  const [formData, setFormData] = useState({
    FecEntrega: new Date().toISOString().split('T')[0],
    TipoIDPaciente: 'CC',
    NoIDPaciente: '',
    CodMunEnt: '05001',
    CausaNoEntrega: '0',
    ValorEntregado: '0'
  });

  const [successMsg, setSuccessMsg] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg('');

    if (!proceso || !proceso.id_programacion) {
      setError('Falta el ID de Programación. Completa el paso anterior.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await asistenteEntrega(proceso.id_local, {
        ...formData,
        ID: Number(proceso.id_programacion)
      });

      if (response.ok && response.data?.proceso) {
        setSuccessMsg(`Entrega registrada con éxito. ID: ${response.data.proceso.id_entrega}`);
        setSuccess('Entrega guardada.');
        setTimeout(() => {
          updateProcesoFromDb(response.data.proceso);
        }, 2000);
      } else {
        setError('Respuesta inválida del servidor.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Error desconocido');
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
        <p style={{ margin: '0 0 0.5rem 0' }}>📌 <strong>ID Programación a referenciar:</strong> {proceso?.id_programacion || 'Ninguno'}</p>
        <p style={{ margin: 0 }}>Recuerda verificar bien las cantidades antes de confirmar.</p>
      </div>

      {successMsg && (
        <div className="alert" style={{ backgroundColor: '#ecfdf5', color: 'var(--success)', border: '1px solid #a7f3d0' }}>
          ✓ {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-2" style={{ gap: '1rem' }}>
        <div className="form-group">
          <label>Fecha de Entrega:</label>
          <input type="date" name="FecEntrega" className="form-control" value={formData.FecEntrega} onChange={handleChange} required disabled={isLoading || !!successMsg} />
        </div>
        <div className="form-group">
          <label>Tipo ID Paciente:</label>
          <select name="TipoIDPaciente" className="form-control" value={formData.TipoIDPaciente} onChange={handleChange} required disabled={isLoading || !!successMsg}>
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
          <label>Número ID Paciente:</label>
          <input type="text" name="NoIDPaciente" className="form-control" value={formData.NoIDPaciente} onChange={handleChange} required placeholder="Documento del que recibe" disabled={isLoading || !!successMsg} />
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

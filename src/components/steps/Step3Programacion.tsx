import { useState, useMemo } from 'react';
import { useAsistente } from '../../context/AsistenteContext';
import { asistenteProgramacion } from '../../services/api';

export const Step3Programacion = () => {
  const { proceso, updateProcesoFromDb, isLoading, setIsLoading, setError, clearError, goBack } = useAsistente();

  const [formData, setFormData] = useState({
    ID: proceso?.id_mipres || '',
    FecMaxEnt: proceso?.fec_max_ent ? proceso.fec_max_ent.substring(0, 10) : '',
    TipoIDSedeProv: 'NI',
    NoIDSedeProv: '57304482',
    CodSedeProv: 'PROV008934',
    CodSerTecAEntregar: proceso?.cod_ser_tec_a_entregar || '',
    CantTotAEntregar: proceso?.cant_tot_a_entregar?.toString() || ''
  });

  const [successMsg, setSuccessMsg] = useState('');

  const disponibles = useMemo(() => {
    if (!proceso?.disponibles) return [];
    if (typeof proceso.disponibles === 'string') {
      try {
        return JSON.parse(proceso.disponibles);
      } catch (e) {
        return [];
      }
    }
    return proceso.disponibles;
  }, [proceso?.disponibles]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    const selectedItem = disponibles.find((item: any) => String(item.ID || item.IdDireccionamiento) === selectedId);

    if (selectedItem) {
      setFormData({
        ...formData,
        ID: selectedId,
        FecMaxEnt: selectedItem.FecMaxEnt ? selectedItem.FecMaxEnt.substring(0, 10) : '',
        CodSerTecAEntregar: String(selectedItem.CodSerTecAEntregar || ''),
        CantTotAEntregar: selectedItem.CantTotAEntregar?.toString() || ''
      });
    } else {
      setFormData({ ...formData, ID: selectedId });
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setSuccessMsg('');

    if (!proceso || !proceso.id_mipres) {
      setError('Faltan IDs previos. Asegúrate de tener al menos un Direccionamiento activo.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await asistenteProgramacion(proceso.id_local, {
        ...formData,
        ID: Number(formData.ID || proceso.id_mipres),
        CantTotAEntregar: Number(formData.CantTotAEntregar)
      });

      if (response.ok && response.data?.proceso) {
        setSuccessMsg(`Programación exitosa. ID: ${response.data.proceso.id_programacion}`);
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

  console.log("disponibles", proceso?.disponibles);
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 style={{ margin: 0 }}>Paso 3: Programación</h3>
        <button onClick={goBack} disabled={isLoading} className="btn" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', background: '#e2e8f0', color: '#1e293b' }}>
          ← Regresar
        </button>
      </div>

      <div className="alert" style={{ backgroundColor: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <p style={{ margin: '0 0 0.5rem 0' }}>📌 <strong>ID Direccionamiento a referenciar:</strong> {proceso?.id_mipres || 'Ninguno'}</p>
        <p style={{ margin: 0 }}>Recuerda verificar bien las cantidades antes de confirmar.</p>
      </div>

      <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        Confirma la programación del servicio o tecnología. El sistema inyectará automáticamente el ID de Direccionamiento
        y el código de tecnología: <strong>{proceso?.cod_ser_tec_a_entregar || 'N/A'}</strong>.
      </p>

      {successMsg && (
        <div className="alert" style={{ backgroundColor: '#ecfdf5', color: 'var(--success)', border: '1px solid #a7f3d0' }}>
          ✓ {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 1rem' }}>

        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="ID">No. Entrega (Direccionamientos Disponibles):</label>
          <select
            id="ID"
            name="ID"
            className="form-control"
            value={formData.ID}
            onChange={handleSelectChange}
            disabled={isLoading || !!successMsg}
            style={{ border: '2px solid var(--primary-color)' }}
          >
            {disponibles && disponibles.length > 0 ? (
              disponibles.map((dir: any) => (
                <option key={dir.ID || dir.IdDireccionamiento} value={dir.ID || dir.IdDireccionamiento}>
                  No. Entrega: {dir.NoEntrega || '#'} | ID Direccionamiento: {dir.ID || dir.IdDireccionamiento} — TEC: {dir.CodSerTecAEntregar}
                </option>
              ))
            ) : (
              <option value={formData.ID || ''}>ID Direccionamiento: {formData.ID || 'Opciones no disponibles'}</option>
            )}
          </select>
        </div>

        <div className="form-group" style={{ gridColumn: 'span 2' }}>
          <label htmlFor="FecMaxEnt">Fecha Máxima de Entrega (Oficial de SISPRO):</label>
          <input
            id="FecMaxEnt"
            name="FecMaxEnt"
            type="date"
            className="form-control"
            value={formData.FecMaxEnt}
            onChange={handleChange}
            disabled={isLoading || !!successMsg}
            style={{ border: '2px solid var(--primary-color)' }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="NoIDSedeProv">Tipo ID Sede (Fijo):</label>
          <input
            id="NoIDSedeProv"
            name="NoIDSedeProv"
            type="text"
            className="form-control"
            value={formData.NoIDSedeProv}
            readOnly
            style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
          />
        </div>

        <div className="form-group">
          <label htmlFor="CodSedeProv">Cód. Sede (Fijo):</label>
          <input
            id="CodSedeProv"
            name="CodSedeProv"
            type="text"
            className="form-control"
            value={formData.CodSedeProv}
            readOnly
            style={{ backgroundColor: '#f1f5f9', cursor: 'not-allowed' }}
          />
        </div>

        <div style={{ gridColumn: 'span 2', marginTop: '1rem' }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !!successMsg}
            style={{ width: '100%', height: '3rem', fontSize: '1rem', fontWeight: 'bold' }}
          >
            {isLoading ? 'Conectando con SISPRO...' : 'Confirmar Programación'}
          </button>
        </div>
      </form>
    </div>
  );
};

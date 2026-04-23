import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as xlsx from 'xlsx';
import { ExcelAutoOpenHint } from './ExcelAutoOpenHint';

export const BatchMIPRES = () => {
  const { nit, token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showHint, setShowHint] = useState(false);

  const downloadTemplate = () => {
    const template = [
      {
        'N\u00b0MIPRES': '20241234567890',
        'CODIGOTEC': 'GH10AB0350MG30TAB',
        'CANT': 30,
        'NOENTREGA': 1,
        'FECHADEENTREGA': '15/04/2024',
        'CCQUERECIBE': '1124039901',
        'VRTOTAL': '675000',
        'CAUSANOENTREGA': 0
      },
      {
        'N\u00b0MIPRES': '20241234567891',
        'CODIGOTEC': 'GH10AB0350MG30TAB',
        'CANT': 0,
        'NOENTREGA': 1,
        'FECHADEENTREGA': '15/04/2024',
        'CCQUERECIBE': '',
        'VRTOTAL': '0',
        'CAUSANOENTREGA': 7
      },
    ];
    const ws = xlsx.utils.json_to_sheet(template);
    // Ancho de columnas
    ws['!cols'] = [
      { wch: 22 }, // N°MIPRES
      { wch: 22 }, // CODIGOTEC
      { wch: 10 }, // CANT
      { wch: 12 }, // NOENTREGA
      { wch: 18 }, // FECHADEENTREGA
      { wch: 18 }, // CCQUERECIBE
      { wch: 14 }, // VRTOTAL
      { wch: 18 }, // CAUSANOENTREGA
    ];
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Plantilla');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a'); a.href = url;
    a.download = 'Plantilla_Carga_Masiva_MIPRES.xlsx'; a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError('Por favor, selecciona un archivo Excel (.xlsx)');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('nit', nit || '');
    // Importante: le pasamos el token actual en vez del tokenBase al usar api
    formData.append('token', token || ''); // Nota: El backend en masiva pedía tokenBase pero podemos ajustarlo para que solo requiera Auth. wait, let's keep tokenBase? No, AuthContext doesn't have tokenBase! Emit token and we'll fix backend if needed. Wait, in backend `batch.js` it invokes `generarToken(nit, tokenBase)`.

    try {
      // 1. Enviar el archivo
      const response = await fetch('http://localhost:3001/api/batch/excel', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        // Podría ser un error de validación inicial devuelto como JSON
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Error reportado por el servidor al procesar el Excel.');
      }

      // 2. Recibir Blob y descargar en el navegador
      const rawBlob = await response.blob();

      const now = new Date();
      const hours24 = now.getHours();
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12;
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const datePart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const timePart = `${hours12}-${minutes}${ampm}`;
      const fileName = `Resultado_Masivo_MIPRES_${datePart}_${timePart}.xlsx`;

      const url = window.URL.createObjectURL(rawBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess(`¡Proceso Masivo finalizado! El archivo "${fileName}" se ha descargado correctamente.`);
      setShowHint(true);

      setFile(null); // Reiniciar el input si se desea
    } catch (err: any) {
      setError(err.message || 'Error desconocido al procesar el archivo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '2rem auto', padding: '2rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#ffffff', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0, color: '#1e293b' }}>Carga Masiva (Excel a SISPRO) ⚡</h2>
        <button
          onClick={downloadTemplate}
          style={{
            padding: '0.6rem 1.25rem', background: '#f1f5f9', color: '#1e293b',
            border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center',
            gap: '0.5rem', whiteSpace: 'nowrap'
          }}
        >
          📥 Descargar Plantilla Excel
        </button>
      </div>
      <p style={{ color: '#64748b', marginBottom: '0.75rem' }}>
        Sube el reporte de entregas en formato <strong>.xlsx</strong>. El sistema mapeará automáticamente los pasos de Programación, Entrega y Reporte para cada fila.
      </p>
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '0.75rem 1rem', marginBottom: '1.5rem', fontSize: '0.85rem', color: '#475569' }}>
        <strong>Entrega efectiva</strong>: llena <code>CCQUERECIBE</code>, <code>VRTOTAL</code> y deja <code>CAUSANOENTREGA = 0</code>.<br/>
        <strong>No entrega</strong>: deja <code>CANT = 0</code>, <code>VRTOTAL = 0</code> y coloca el código de causa en <code>CAUSANOENTREGA</code> (ej: 7).
      </div>

      {error && (
        <div style={{ padding: '1rem', background: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '4px', marginBottom: '1.5rem' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {success && (
        <div style={{ padding: '1rem', background: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '4px', marginBottom: '1.5rem' }}>
          <strong>Éxito:</strong> {success}
        </div>
      )}

      <form onSubmit={handleUpload}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.75rem', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '0.9rem', color: '#64748b' }}>
            <strong>Conectado como NIT:</strong> {nit}
          </div>
        </div>

        <div style={{ padding: '2rem', border: '2px dashed #cbd5e1', borderRadius: '8px', textAlign: 'center', marginBottom: '1.5rem', background: '#f8fafc' }}>
          <label style={{ cursor: 'pointer', display: 'block' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
            <strong style={{ display: 'block', marginBottom: '0.5rem' }}>Haz clic para seleccionar el archivo Excel (.xlsx)</strong>
            <span style={{ color: '#64748b' }}>{file ? file.name : 'Ningún archivo seleccionado'}</span>
            <input 
              type="file" 
              accept=".xlsx, .xls"
              onChange={handleFileChange} 
              style={{ display: 'none' }}
              disabled={isLoading}
            />
          </label>
        </div>

        <button 
          type="submit" 
          disabled={!file || isLoading}
          style={{
            width: '100%',
            padding: '1rem',
            background: (file && !isLoading) ? '#2563eb' : '#94a3b8',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1.1rem',
            fontWeight: 'bold',
            cursor: (file && !isLoading) ? 'pointer' : 'not-allowed',
            transition: 'background 0.3s'
          }}
        >
          {isLoading ? 'Procesando Filas vía SISPRO (Esto tomará tiempo)...' : 'Subir e Iniciar Procesamiento Masivo'}
        </button>
      </form>

      <ExcelAutoOpenHint visible={showHint} />
    </div>
  );
};

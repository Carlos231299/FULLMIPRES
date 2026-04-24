import { useState, useRef, type ChangeEvent } from 'react';
import { useAsistente } from '../context/AsistenteContext';
import { useAuth } from '../context/AuthContext';
import * as xlsx from 'xlsx';
import { ExcelAutoOpenHint } from '../components/ExcelAutoOpenHint';

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || '';
// Eliminamos el '/api' si viene en la variable, para evitar duplicados en las rutas
const CLEAN_BASE_URL = BACKEND_URL.endsWith('/api') ? BACKEND_URL.slice(0, -4) : BACKEND_URL;

export const FacturacionMasivaPage = () => {
  const { nit, token } = useAuth();
  const { setError, setSuccess, clearError } = useAsistente();

  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mode, setMode] = useState<'reportar' | 'anular'>('reportar');
  const [showHint, setShowHint] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const downloadTemplate = () => {
    let template = [];
    let fileName = '';

    if (mode === 'reportar') {
      template = [
        { 'N\u00b0 MIPRES': '20241234567890', 'NOENTREGA': 1, 'COD_TEC': 'M01', 'NOFACTURA': 'CUFE-EJEMPLO-LARGO-7bc8e198bf77ac0365f73b06998953a79bb68923', 'REGIMEN': 'Subsidiado', 'NOIDEPS': '839000495' },
      ];
      fileName = 'Plantilla_Facturacion_Masiva.xlsx';
    } else {
      template = [
        { 'N\u00b0 MIPRES': '20241234567890', 'NOENTREGA': 1 },
      ];
      fileName = 'Plantilla_Anulacion_Masiva.xlsx';
    }

    const ws = xlsx.utils.json_to_sheet(template);
    if (mode === 'reportar') {
      ws['!cols'] = [{ wch: 22 }, { wch: 12 }, { wch: 100 }, { wch: 16 }, { wch: 16 }];
    } else {
      ws['!cols'] = [{ wch: 22 }, { wch: 12 }];
    }

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Plantilla');
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFile(e.dataTransfer.files[0]);
      clearError();
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFile(e.target.files[0]);
      clearError();
    }
  };

  const procesarLote = async () => {
    if (!file) return setError('Seleccione un archivo Excel primero.');

    setIsProcessing(true);
    clearError();
    const actionText = mode === 'reportar' ? 'Procesando Reporte' : 'Procesando Anulaciones';
    setSuccess(`Iniciando proceso masivo: ${actionText}... Por favor, no cierre esta ventana.`);

    const formData = new FormData();
    formData.append('archivo', file);
    formData.append('nit', nit || '');
    formData.append('token', token || '');

    const endpoint = mode === 'reportar' ? '/api/batch-billing/excel' : '/api/batch-billing/annul-excel';

    try {
      const response = await fetch(`${CLEAN_BASE_URL}${endpoint}`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || 'Error reportado por el servidor al procesar el Excel.');
      }

      const rawBlob = await response.blob();

      const now = new Date();
      const hours24 = now.getHours();
      const ampm = hours24 >= 12 ? 'PM' : 'AM';
      const hours12 = hours24 % 12 || 12;
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const datePart = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
      const timePart = `${hours12}-${minutes}${ampm}`;

      const prefix = mode === 'reportar' ? 'Resumen_Facturacion' : 'Resumen_Anulacion';
      const fileName = `${prefix}_Masiva_${datePart}_${timePart}.xlsx`;

      // Descarga estándar del navegador
      const url = window.URL.createObjectURL(rawBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSuccess(`¡Procesamiento completado! El archivo "${fileName}" se ha descargado correctamente.`);
      setShowHint(true);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

    } catch (err: any) {
      setError(err.message || 'Error de conexión');
    } finally {
      setIsProcessing(false);
    }
  };

  const getModeColor = () => {
    return mode === 'reportar' ? '#10b981' : '#f59e0b';
  };

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ marginBottom: '0.5rem', color: '#1e293b' }}>
            {mode === 'reportar' ? '🗃️ Reporte Masivo Inteligente' : '🚫 Anulación Masiva'}
          </h2>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            {mode === 'reportar'
              ? 'Factura múltiples tecnologías y recupera CUFEs de registros ya existentes automáticamente.'
              : 'Cargue un archivo de Excel con N° de Prescripción y Entrega para anular facturas en SISPRO.'}
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          style={{
            padding: '0.6rem 1.25rem',
            background: '#f1f5f9',
            color: '#1e293b',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '0.875rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            whiteSpace: 'nowrap'
          }}
        >
          📥 Plantilla ({mode === 'reportar' ? 'Reporte' : 'Anulación'})
        </button>
      </header>

      <div style={{ background: 'white', padding: '2.5rem', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}>

        {/* Selector de Modo */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2.5rem', background: '#f8fafc', padding: '0.4rem', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
          <button
            onClick={() => { setMode('reportar'); clearError(); setFile(null); }}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer',
              background: mode === 'reportar' ? '#10b981' : 'transparent',
              color: mode === 'reportar' ? 'white' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            📄 Reportar y Consultar
          </button>
          <button
            onClick={() => { setMode('anular'); clearError(); setFile(null); }}
            style={{
              flex: 1, padding: '0.75rem', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer',
              background: mode === 'anular' ? '#f59e0b' : 'transparent',
              color: mode === 'anular' ? 'white' : '#64748b',
              transition: 'all 0.2s'
            }}
          >
            🚫 Anulación Masiva
          </button>
        </div>

        <div style={{ background: '#f8fafc', padding: '1.5rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '2rem' }}>
          <h4 style={{ margin: '0 0 0.5rem 0', color: '#0f172a' }}>📄 Requisitos para {mode === 'reportar' ? 'Reportar' : 'Anular'}</h4>
          <ul style={{ margin: 0, paddingLeft: '1.5rem', color: '#475569', fontSize: '0.9rem', lineHeight: '1.6' }}>
            <li>Columna <strong>N° MIPRES</strong>: Número de prescripción.</li>
            <li>Columna <strong>NOENTREGA</strong>: Número de entrega <strong style={{ color: '#dc2626' }}>(obligatorio)</strong>.</li>
            <li>Columna <strong>COD_TEC</strong>: Código de la tecnología a reportar.</li>
            {mode === 'reportar' ? (
              <>
                <li>Columna <strong>NOFACTURA</strong>: Código o CUFE de tu factura.</li>
                <li>Columna <strong>REGIMEN</strong>: <em>Subsidiado</em> o <em>Contributivo</em>.</li>
                <li>Columna <strong>NOIDEPS</strong>: NIT de la EPS (ej: 839000495).</li>
                <li style={{ color: '#059669', fontWeight: 600 }}>💡 Truco: Si ya está facturado, el sistema te traerá el CUFE y la fecha real de SISPRO automáticamente.</li>
              </>
            ) : (
              <li style={{ color: '#b45309', fontWeight: 600 }}>El sistema buscará automáticamente el ID de facturación correspondiente en SISPRO para anularlo.</li>
            )}
          </ul>
        </div>

        <div
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            border: '2px dashed',
            borderColor: getModeColor(),
            borderRadius: '12px',
            padding: '4rem 2rem',
            textAlign: 'center',
            background: isProcessing ? '#f1f5f9' : '#ffffff',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
          onClick={() => !isProcessing && fileInputRef.current?.click()}
        >
          {isProcessing ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '50%',
                border: '4px solid #e2e8f0', borderTopColor: getModeColor(),
                animation: 'spin 1s linear infinite', marginBottom: '1rem'
              }}></div>
              <style>
                {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
              </style>
              <h3 style={{ margin: 0, color: getModeColor() }}>
                Procesando registros...
              </h3>
              <p style={{ color: '#64748b', marginTop: '0.5rem' }}>Conectando con SISPRO, por favor no cierre el asistente.</p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {mode === 'reportar' ? '📥' : '🗑️'}
              </div>
              <h3 style={{ margin: '0 0 0.5rem 0', color: '#1e293b' }}>
                {file ? file.name : `Arrastra archivo para ${mode === 'reportar' ? 'reportar' : 'anular'}`}
              </h3>
              <p style={{ color: '#64748b', margin: 0 }}>
                {file ? `${(file.size / 1024).toFixed(1)} KB` : 'o haz clic para buscar en tu equipo (.xlsx)'}
              </p>
              <input
                type="file"
                accept=".xlsx, .xls"
                style={{ display: 'none' }}
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
            </>
          )}
        </div>

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={procesarLote}
            disabled={!file || isProcessing}
            style={{
              padding: '1rem 3rem',
              background: (!file || isProcessing) ? '#94a3b8' : getModeColor(),
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1.1rem',
              fontWeight: 600,
              cursor: (!file || isProcessing) ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              boxShadow: (!file || isProcessing) ? 'none' : `0 4px 6px -1px ${getModeColor()}66`
            }}
          >
            {isProcessing ? 'Procesando...' : (mode === 'reportar' ? '🚀 Iniciar Reporte' : '🚫 Iniciar Anulación')}
          </button>
        </div>
      </div>

      <ExcelAutoOpenHint visible={showHint} />
    </div>
  );
};


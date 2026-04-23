import { useState, useEffect } from 'react';

const HINT_KEY = 'excel_autopen_hint_dismissed';

/**
 * Banner de ayuda que aparece una sola vez tras la primera descarga de Excel.
 * Explica cómo configurar el navegador para que abra .xlsx automáticamente.
 * Se descarta para siempre al hacer clic en "Entendido".
 */
export const ExcelAutoOpenHint = ({ visible }: { visible: boolean }) => {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible && localStorage.getItem(HINT_KEY) !== 'true') {
      setShow(true);
    }
  }, [visible]);

  const dismiss = () => {
    localStorage.setItem(HINT_KEY, 'true');
    setShow(false);
  };

  if (!show) return null;

  return (
    <div style={{
      marginTop: '1.5rem',
      background: 'linear-gradient(135deg, #eff6ff 0%, #f0fdf4 100%)',
      border: '1.5px solid #93c5fd',
      borderRadius: '12px',
      padding: '1.25rem 1.5rem',
      position: 'relative',
      boxShadow: '0 4px 12px rgba(59,130,246,0.1)',
      animation: 'fadeInHint 0.4s ease',
    }}>
      <style>{`
        @keyframes fadeInHint {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Botón cerrar */}
      <button
        onClick={dismiss}
        title="No volver a mostrar"
        style={{
          position: 'absolute', top: '0.75rem', right: '0.75rem',
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '1.1rem', color: '#64748b', lineHeight: 1,
          padding: '4px 8px', borderRadius: '4px',
        }}
      >
        ✕
      </button>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '1.6rem', flexShrink: 0 }}>💡</span>
        <div>
          <p style={{ margin: '0 0 0.5rem 0', fontWeight: 700, color: '#1e40af', fontSize: '0.95rem' }}>
            ¿Quieres que los reportes se abran en Excel automáticamente?
          </p>
          <p style={{ margin: '0 0 0.75rem 0', color: '#475569', fontSize: '0.875rem', lineHeight: 1.6 }}>
            El archivo ya está en tu carpeta de <strong>Descargas</strong>. Para que se abra solo en Excel la próxima vez, sigue estos pasos (solo una vez):
          </p>

          {/* Pasos */}
          <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#374151', fontSize: '0.85rem', lineHeight: 1.9 }}>
            <li>
              En <strong>Chrome o Edge</strong>: busca el archivo descargado en la barra inferior del navegador.
            </li>
            <li>
              Haz clic en la <strong>flecha ▲</strong> o los <strong>tres puntos ⋮</strong> junto al archivo.
            </li>
            <li>
              Selecciona <strong>"Abrir siempre los archivos de este tipo"</strong> o <strong>"Always open files of this type"</strong>.
            </li>
          </ol>

          <p style={{ margin: '0.75rem 0 0 0', color: '#6b7280', fontSize: '0.8rem', fontStyle: 'italic' }}>
            A partir de ese momento, cada reporte se abrirá en Excel al instante. ✅
          </p>

          <button
            onClick={dismiss}
            style={{
              marginTop: '0.85rem',
              padding: '0.45rem 1.25rem',
              background: '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            Entendido, no volver a mostrar
          </button>
        </div>
      </div>
    </div>
  );
};

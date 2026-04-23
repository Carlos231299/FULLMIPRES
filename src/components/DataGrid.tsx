import { translateKey } from '../utils/mipresTranslate';

interface DataGridProps {
  data: any;
  title?: string;
  onOpenInAsistente?: (data: any) => void;
}

export const DataGrid = ({ data, title, onOpenInAsistente }: DataGridProps) => {
  if (!data) return null;

  // Filtrar nulos si se prefiere, o mostrarlos como "N/A"
  const entries = Object.entries(data).filter(([v]) => v !== 'disponibles'); // No mostrar el JSON de disponibilidad aquí

  return (
    <div style={{ 
      background: 'white', 
      borderRadius: '12px', 
      border: '1px solid #e2e8f0', 
      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      overflow: 'hidden',
      marginBottom: '2rem'
    }}>
      {title && (
        <div style={{ 
          padding: '1.25rem 1.5rem', 
          background: '#f8fafc', 
          borderBottom: '1px solid #e2e8f0',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: (data.NoEntrega || data.Noentrega) ? '0.5rem' : '0'
          }}>
            <h3 style={{ margin: 0, color: '#1e293b', fontSize: '1.1rem' }}>
              {title === 'Información enviada a SISPRO' || title === 'Información Completa' ? 'Detalle de facturación' : title}
            </h3>
            {onOpenInAsistente && (
              <button 
                onClick={() => onOpenInAsistente(data)}
                style={{
                  padding: '0.4rem 0.8rem',
                  background: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                🚀 Abrir en Asistente
              </button>
            )}
          </div>
          {(data.NoEntrega || data.Noentrega) && (
            <div style={{ 
              fontSize: '1rem', 
              color: '#2563eb', 
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              <span>📦 N° de entrega:</span>
              <span style={{ background: '#dbeafe', padding: '0.1rem 0.6rem', borderRadius: '4px' }}>
                {data.NoEntrega || data.Noentrega}
              </span>
            </div>
          )}
        </div>
      )}
      
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', 
        gap: '0', 
        padding: '0' 
      }}>
        {entries.map(([key, value]) => (
          <div key={key} style={{ 
            padding: '1rem 1.5rem', 
            borderBottom: '1px solid #f1f5f9',
            borderRight: '1px solid #f1f5f9'
          }}>
            <div style={{ 
              fontSize: '0.75rem', 
              color: '#64748b', 
              textTransform: 'uppercase', 
              letterSpacing: '0.025em',
              fontWeight: 600,
              marginBottom: '0.25rem'
            }}>
              {key === 'NoEntrega' ? 'N° de entrega' : translateKey(key)}
            </div>
            <div style={{ 
              fontSize: '1rem', 
              color: '#1e293b', 
              wordBreak: 'break-all',
              fontWeight: 500
            }}>
              {value === null || value === undefined ? (
                <span style={{ color: '#cbd5e1', fontStyle: 'italic' }}>N/A</span>
              ) : (
                String(value)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

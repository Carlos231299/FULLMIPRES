import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * LicensePage fue la pantalla de activación offline por hardware (Electron).
 * En la versión Web, el acceso se controla mediante el Login.
 * Esta página redirige directamente al login si alguien llega aquí.
 */
export const LicensePage = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1rem'
    }}>
      <Shield size={48} color="#3b82f6" />
      <h2 style={{ color: '#f8fafc', margin: 0 }}>Acceso controlado por sesión</h2>
      <p style={{ color: '#94a3b8', margin: 0 }}>Por favor inicia sesión para continuar.</p>
      <button
        onClick={() => navigate('/login', { replace: true })}
        style={{
          marginTop: '1rem', padding: '0.75rem 2rem',
          background: '#3b82f6', color: 'white',
          border: 'none', borderRadius: '8px',
          fontWeight: 600, cursor: 'pointer', fontSize: '1rem'
        }}
      >
        Ir al Login
      </button>
    </div>
  );
};

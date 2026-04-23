import { useState, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';
import { Toaster } from 'sonner';

export const Layout = ({ children }: { children: ReactNode }) => {
  const { logout, nit } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const menuItems = [
    { name: '🧙 Asistente Paso a Paso', path: '/asistente' },
    { name: '🧙 Asistente No Entrega', path: '/asistente-no-entrega' },
    { name: '📋 Direccionamiento por No. Prescripción', path: '/direccionamiento' },
    { name: '📅 Programación por No. Prescripción', path: '/programacion' },
    { name: '📦 Entrega por No. Prescripción', path: '/entrega' },
    { name: '📊 Reporte de Entrega por No. Prescripción', path: '/reporte' },
    { name: '🧾 Facturación', path: '/facturacion' },
    { name: '🗃️ Facturación Masiva', path: '/facturacion-masiva' },
    { name: '📁 Carga Masiva (Excel)', path: '/batch' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const sidebarWidth = isCollapsed ? '80px' : '300px';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f1f5f9' }}>
      {/* Sidebar */}
      <aside 
        onMouseEnter={() => setIsCollapsed(false)}
        onMouseLeave={() => setIsCollapsed(true)}
        style={{
          width: sidebarWidth,
          background: '#1e293b',
          color: 'white',
          display: 'flex',
          flexDirection: 'column',
          transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'fixed',
          height: '100vh',
          zIndex: 50,
          boxShadow: '4px 0 10px rgba(0,0,0,0.1)',
          overflow: 'hidden'
        }}
      >
        <div style={{
          padding: '1.5rem 1.25rem',
          borderBottom: '1px solid #334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '80px',
          overflow: 'hidden'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            flex: 1,
            transition: 'all 0.3s'
          }}>
            <img 
              src="./sidebar_logo.png" 
              alt="MIPRES Logo" 
              style={{ 
                maxHeight: isCollapsed ? '40px' : '64px', 
                maxWidth: isCollapsed ? '80%' : '100%',
                width: 'auto', 
                objectFit: 'contain',
                objectPosition: 'center',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
              }} 
            />
          </div>
        </div>

        <nav style={{ flex: 1, padding: '1.5rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', overflowY: 'auto', overflowX: 'hidden' }}>
          {menuItems.map((item) => {
            const icon = item.name.split(' ')[0];
            const text = item.name.substring(icon.length).trim();
            
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.name : text}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.6rem 0.75rem',
                  color: isActive ? 'white' : '#94a3b8',
                  textDecoration: 'none',
                  borderRadius: '8px',
                  background: isActive ? '#334155' : 'transparent',
                  transition: 'all 0.2s',
                  whiteSpace: 'normal', // Allow wrap if name too long
                  lineHeight: '1.1'
                })}
              >
                <div style={{ minWidth: '28px', fontSize: '1.1rem', textAlign: 'center' }}>
                  {icon}
                </div>
                {!isCollapsed && (
                  <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', fontWeight: 500, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {text}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div style={{ padding: '1rem', borderTop: '1px solid #334155', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {!isCollapsed && (
            <div style={{ fontSize: '0.7rem', color: '#64748b', textAlign: 'center', letterSpacing: '0.5px' }}>
              USUARIO NIT: <span style={{ color: '#94a3b8' }}>{nit}</span>
            </div>
          )}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            style={{
              padding: '0.75rem',
              background: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: isCollapsed ? 'center' : 'flex-start',
              gap: '0.75rem',
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.opacity = '0.9'}
            onMouseOut={(e) => e.currentTarget.style.opacity = '1'}
          >
            <span style={{ fontSize: '1.1rem' }}>🚪</span>
            {!isCollapsed && <span style={{ fontSize: '0.85rem' }}>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{
        flex: 1,
        marginLeft: sidebarWidth,
        transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        padding: '1.5rem'
      }}>
        <div style={{
          background: 'white',
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '2.5rem',
          borderRadius: '16px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          minHeight: 'calc(100vh - 4rem)'
        }}>
          {children}
        </div>
      </main>

      <ConfirmDialog 
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={handleLogout}
        title="Confirmar Cierre de Sesión"
        message="¿Estás seguro de que deseas cerrar la sesión actual? Deberás ingresar tus credenciales nuevamente para acceder."
        confirmText="Cerrar Sesión"
        type="danger"
      />
      <Toaster richColors position="top-right" />
    </div>
  );
};

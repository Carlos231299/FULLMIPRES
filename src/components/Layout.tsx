import { useState, useRef, type ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from './ConfirmDialog';
import { Toaster, toast } from 'sonner';
import { Modal } from './Modal';
import { exportUnitValues } from '../services/api';

export const Layout = ({ children }: { children: ReactNode }) => {
  const { logout, nit, token } = useAuth();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Estados para exportación masiva de valores
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [exportingValues, setExportingValues] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  const handleExportValues = async () => {
    if (!selectedFile || !nit || !token) return;

    setExportingValues(true);
    const toastId = toast.loading('Procesando reporte en SISPRO...');
    
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('archivo', selectedFile);
      formDataUpload.append('nit', nit); // Backup por si fallan los headers
      formDataUpload.append('token', token);

      const blob = await exportUnitValues(formDataUpload);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ValoresUnitarios_MIPRES_${new Date().getTime()}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Reporte generado y descargado con éxito', { id: toastId });
      setShowExportModal(false);
      setSelectedFile(null);
    } catch (err: any) {
      console.error(err);
      toast.error('Error al exportar: ' + (err.response?.data?.error || err.message), { id: toastId });
    } finally {
      setExportingValues(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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

          <div style={{ marginTop: '0.5rem', borderTop: '1px solid #334155', paddingTop: '1rem' }}>
            <button
              onClick={() => setShowExportModal(true)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                padding: '0.75rem',
                color: 'white',
                background: '#7c3aed',
                border: 'none',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.2)',
                justifyContent: isCollapsed ? 'center' : 'flex-start'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#6d28d9'}
              onMouseOut={(e) => e.currentTarget.style.background = '#7c3aed'}
            >
              <div style={{ minWidth: '28px', fontSize: '1.2rem', textAlign: 'center' }}>📊</div>
              {!isCollapsed && (
                <span style={{ marginLeft: '0.75rem', fontSize: '0.8rem', fontWeight: 700, lineHeight: '1.2' }}>
                  Exportar Valores Unitarios
                </span>
              )}
            </button>
          </div>
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

      {/* MODAL DE EXPORTACIÓN MASIVA GLOBAL */}
      <Modal 
        isOpen={showExportModal} 
        onClose={() => !exportingValues && setShowExportModal(false)} 
        title="Exportación Masiva de Valores Unitarios"
      >
        <div style={{ padding: '0.5rem 0' }}>
          <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', padding: '1.5rem', borderRadius: '12px', marginBottom: '2rem' }}>
            <h4 style={{ margin: '0 0 1rem 0', color: '#0369a1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📖 Instrucciones de la Plantilla
            </h4>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.9rem', color: '#0c4a6e', lineHeight: '1.6' }}>
              <li>Sube un Excel (<strong>.xlsx</strong> o <strong>.xls</strong>).</li>
              <li>Debe tener la columna <strong>N° MIPRES</strong> o <strong>PRESCRIPCION</strong>.</li>
              <li>El sistema calculará automáticamente el valor unitario (Reportado / Cantidad).</li>
            </ul>
          </div>

          <div style={{ textAlign: 'center', padding: '2rem', border: '2px dashed #e2e8f0', borderRadius: '16px', background: '#f8fafc' }}>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              style={{ display: 'none' }} 
              accept=".xlsx,.xls"
            />
            
            {exportingValues ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                <div className="spinner" style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                <p style={{ fontWeight: 600, color: '#1e293b', margin: 0 }}>Procesando en SISPRO...</p>
                <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>Estamos cruzando entregas con reportes de valor.</p>
              </div>
            ) : (
              <>
                {!selectedFile ? (
                  <>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      style={{ 
                        padding: '1rem 2rem', 
                        background: '#7c3aed', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '12px', 
                        cursor: 'pointer', 
                        fontWeight: 700,
                        fontSize: '1rem',
                        boxShadow: '0 4px 12px -2px rgba(124, 58, 237, 0.4)'
                      }}
                    >
                      📁 Seleccionar Archivo Excel
                    </button>
                    <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '1.25rem' }}>
                      Haz clic para elegir tu plantilla de MIPRES
                    </p>
                  </>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
                    <div style={{ background: '#ecfdf5', border: '1px solid #6ee7b7', padding: '1rem', borderRadius: '12px', width: '100%' }}>
                      <p style={{ margin: 0, fontSize: '0.9rem', color: '#065f46', fontWeight: 600 }}>
                        📄 Archivo listo: {selectedFile.name}
                      </p>
                      <button 
                        onClick={() => setSelectedFile(null)} 
                        style={{ background: 'none', border: 'none', color: '#047857', fontSize: '0.75rem', textDecoration: 'underline', cursor: 'pointer', marginTop: '0.5rem' }}
                      >
                        Cambiar archivo
                      </button>
                    </div>
                    <button 
                      onClick={handleExportValues}
                      style={{ 
                        width: '100%',
                        padding: '1rem', 
                        background: '#10b981', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '12px', 
                        cursor: 'pointer', 
                        fontWeight: 700,
                        fontSize: '1.1rem',
                        boxShadow: '0 4px 12px -2px rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      🚀 Comenzar Procesamiento
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>

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

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

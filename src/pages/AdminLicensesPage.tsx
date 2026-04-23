import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Swal from 'sweetalert2';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://127.0.0.1:3001';

interface License {
  nit: string;
  estado: string;
  expira_en: string | null;
  created_at: string;
  updated_at: string;
}

export const AdminLicensesPage = () => {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [user, setUser] = useState(localStorage.getItem('admin_user') || '');
  const [password, setPassword] = useState(localStorage.getItem('admin_pass') || '');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Formulario y Edición
  const [isEditing, setIsEditing] = useState(false);
  const [nit, setNit] = useState('');
  const [status, setStatus] = useState('ACTIVO');
  const [expiry, setExpiry] = useState('');

  const fetchLicenses = async (u = user, p = password) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/licenses`, {
        headers: { 
          'x-admin-user': u,
          'x-admin-password': p 
        }
      });
      const data = await response.json();
      
      if (!response.ok) throw new Error(data.error || 'Error de autenticación');
      
      setLicenses(data.data);
      setIsAuthorized(true);
      localStorage.setItem('admin_user', u);
      localStorage.setItem('admin_pass', p);
    } catch (err: any) {
      setIsAuthorized(false);
      if (u && p) toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user && password) fetchLicenses();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      
      toast.success('Bienvenido, Administrador');
      fetchLicenses(user, password);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/licenses`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-admin-user': user,
          'x-admin-password': password 
        },
        body: JSON.stringify({
          nit,
          estado: status,
          expira_en: expiry || null
        })
      });
      if (!response.ok) throw new Error('No se pudo guardar la licencia');

      toast.success(isEditing ? 'Licencia actualizada' : 'Licencia creada con éxito');
      resetForm();
      fetchLicenses();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (targetNit: string) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: `Vas a ELIMINAR permanentemente la licencia del NIT ${targetNit}. Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      background: '#ffffff',
      borderRadius: '16px'
    });

    if (result.isConfirmed) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/admin/licenses/${targetNit}`, {
          method: 'DELETE',
          headers: { 
            'x-admin-user': user,
            'x-admin-password': password 
          }
        });
        if (!response.ok) throw new Error('Error al eliminar');
        
        Swal.fire({
          title: 'Eliminado',
          text: 'La licencia ha sido eliminada correctamente.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
        fetchLicenses();
      } catch (err: any) {
        toast.error(err.message);
      }
    }
  };

  const handleEdit = (l: License) => {
    setIsEditing(true);
    setNit(l.nit);
    setStatus(l.estado);
    setExpiry(l.expira_en ? l.expira_en.split('T')[0] : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetForm = () => {
    setIsEditing(false);
    setNit('');
    setStatus('ACTIVO');
    setExpiry('');
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: '¿Cerrar sesión?',
      text: '¿Estás seguro de que quieres salir del panel administrativo?',
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, salir',
      cancelButtonText: 'Permanecer'
    });

    if (result.isConfirmed) {
      localStorage.removeItem('admin_user');
      localStorage.removeItem('admin_pass');
      setIsAuthorized(false);
      setUser('');
      setPassword('');
      toast.info('Sesión de administrador cerrada');
    }
  };

  // VISTA DE LOGIN
  if (!isAuthorized) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', padding: '1.5rem' }}>
        <div style={{ maxWidth: '400px', width: '100%', background: 'white', padding: '2.5rem', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ width: '64px', height: '64px', background: '#3b82f6', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '2rem' }}>🛡️</div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Panel Admin</h1>
            <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Gestión de Licencias Mipres Automatic</p>
          </div>

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Usuario</label>
              <input
                type="text"
                required
                value={user}
                onChange={(e) => setUser(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
              />
            </div>
            <div style={{ marginBottom: '2rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#334155', marginBottom: '0.5rem' }}>Contraseña</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #e2e8f0', outline: 'none' }}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              style={{ width: '100%', padding: '0.875rem', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}
            >
              {isLoading ? 'Verificando...' : 'Entrar al Panel'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // VISTA PRINCIPAL DEL DASHBOARD
  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '2rem' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
        
        {/* Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem', background: 'white', padding: '1.25rem 2rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#0f172a' }}>Sistema de Licencias</h1>
            <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Bienvenido, <strong>{user}</strong></p>
          </div>
          <button 
            onClick={handleLogout}
            style={{ padding: '0.6rem 1.25rem', background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem' }}
          >
            Cerrar Sesión
          </button>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '2rem', alignItems: 'start' }}>
          
          {/* Columna Izquierda: Tabla */}
          <section style={{ background: 'white', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 700, color: '#1e293b' }}>Licencias Activas ({licenses.length})</h2>
              <button onClick={() => fetchLicenses()} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>Actualizar lista</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', textAlign: 'left' }}>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>NIT Cliente</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Estado</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Vencimiento</th>
                  <th style={{ padding: '1rem 1.5rem', fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {licenses.map(l => (
                  <tr key={l.nit} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '1rem 1.5rem', fontWeight: 700, color: '#0f172a' }}>{l.nit}</td>
                    <td style={{ padding: '1rem 1.5rem' }}>
                      <span style={{ 
                        padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: 800,
                        background: l.estado === 'ACTIVO' ? '#dcfce7' : '#fee2e2',
                        color: l.estado === 'ACTIVO' ? '#166534' : '#991b1b'
                      }}>
                        {l.estado}
                      </span>
                    </td>
                    <td style={{ padding: '1rem 1.5rem', color: '#64748b', fontSize: '0.85rem' }}>
                      {l.expira_en ? new Date(l.expira_en).toLocaleDateString() : '♾️ Permanente'}
                    </td>
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <button onClick={() => handleEdit(l)} style={{ marginRight: '1rem', background: 'none', border: 'none', color: '#2563eb', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Editar</button>
                      <button onClick={() => handleDelete(l.nit)} style={{ background: 'none', border: 'none', color: '#ef4444', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }}>Eliminar</button>
                    </td>
                  </tr>
                ))}
                {licenses.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: '3rem', textAlign: 'center', color: '#94a3b8' }}>No hay licencias registradas.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          {/* Columna Derecha: Formulario */}
          <aside style={{ background: 'white', padding: '1.5rem', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', position: 'sticky', top: '2rem' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: '1.5rem' }}>
              {isEditing ? '📝 Editar Licencia' : '➕ Nueva Licencia'}
            </h2>
            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>NIT del Cliente</label>
                <input 
                  type="text" required placeholder="Ej: 57304482" 
                  value={nit} onChange={(e) => setNit(e.target.value)}
                  disabled={isEditing}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0', background: isEditing ? '#f8fafc' : 'white' }}
                />
              </div>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>Estado</label>
                <select 
                  value={status} onChange={(e) => setStatus(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                >
                  <option value="ACTIVO">ACTIVO (Permitir acceso)</option>
                  <option value="SUSPENDIDO">SUSPENDIDO (Bloquear)</option>
                </select>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '0.4rem' }}>Fecha de Expiración</label>
                <input 
                  type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)}
                  style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <p style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: '0.4rem' }}>Dejar vacío para licencia permanente.</p>
              </div>

              <button type="submit" style={{ width: '100%', padding: '0.75rem', background: '#0f172a', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', marginBottom: '0.75rem' }}>
                {isEditing ? 'Guardar Cambios' : 'Activar Licencia'}
              </button>
              
              {isEditing && (
                <button type="button" onClick={resetForm} style={{ width: '100%', padding: '0.75rem', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
                  Cancelar Edición
                </button>
              )}
            </form>
          </aside>

        </div>
      </div>
    </div>
  );
};

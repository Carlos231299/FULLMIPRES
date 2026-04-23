import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { asistenteToken } from '../services/api';

export interface AuthState {
  nit: string;
  token: string;
  loginTime: number;
  lastActivity: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  nit: string | null;
  token: string | null;
  login: (nit: string, tokenBase: string) => Promise<void>;
  logout: () => void;
  updateActivity: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const MAX_SESSION_TIME = 10 * 60 * 60 * 1000; // 10 horas
const MAX_INACTIVITY_TIME = 60 * 60 * 1000; // 1 hora

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [authState, setAuthState] = useState<AuthState | null>(() => {
    const saved = localStorage.getItem('mipres_auth');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const validateSession = () => {
    if (!authState) return false;
    const now = Date.now();
    if (now - authState.loginTime > MAX_SESSION_TIME) return false;
    if (now - authState.lastActivity > MAX_INACTIVITY_TIME) return false;
    return true;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (authState && !validateSession()) {
        logout();
      }
    }, 60000); // Revisar cada minuto
    return () => clearInterval(interval);
  }, [authState]);

  // Actualizar actividad en interacciones de usuario
  useEffect(() => {
    const handleUserActivity = () => {
      if (authState && validateSession()) {
        const now = Date.now();
        // Solo actualizar localStorage cada minuto mínimo para no saturar
        if (now - authState.lastActivity > 60000) {
          const newState = { ...authState, lastActivity: now };
          setAuthState(newState);
          localStorage.setItem('mipres_auth', JSON.stringify(newState));
        }
      }
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
    };
  }, [authState]);

  const login = async (nit: string, tokenBase: string) => {
    try {
      const resp = await asistenteToken({ nit, tokenBase });
      const tokenRaw = resp.data?.tokenRaw;
      
      const newState: AuthState = {
        nit,
        token: typeof tokenRaw === 'string' ? tokenRaw : JSON.stringify(tokenRaw),
        loginTime: Date.now(),
        lastActivity: Date.now()
      };
      
      setAuthState(newState);
      localStorage.setItem('mipres_auth', JSON.stringify(newState));
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      throw err;
    }
  };

  const logout = () => {
    setAuthState(null);
    localStorage.removeItem('mipres_auth');
  };

  const updateActivity = () => {
    if (authState) {
      const newState = { ...authState, lastActivity: Date.now() };
      setAuthState(newState);
      localStorage.setItem('mipres_auth', JSON.stringify(newState));
    }
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated: validateSession(),
      nit: authState?.nit || null,
      token: authState?.token || null,
      login,
      logout,
      updateActivity
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

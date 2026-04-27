import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { Proceso } from '../types/mipres';
import { toast } from 'sonner';

interface AsistenteContextType {
  proceso: Proceso | null;
  setProceso: (proceso: Proceso | null) => void;
  currentStep: number;
  setCurrentStep: (step: number) => void;
  asistenteMode: 'standard' | 'no-entrega';
  setAsistenteMode: (mode: 'standard' | 'no-entrega') => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
  error: string | null;
  setError: (error: string | null) => void;
  success: string | null;
  setSuccess: (success: string | null) => void;
  clearError: () => void;
  updateProcesoFromDb: (nuevoProceso: Proceso) => void;
  syncStep: (noPrescripcion: string, targetStep: number) => Promise<void>;
  startSyncProcess: (noPrescripcion: string, record: any) => Promise<void>;
  goBack: () => void;
}

const AsistenteContext = createContext<AsistenteContextType | undefined>(undefined);

export const AsistenteProvider = ({ children }: { children: ReactNode }) => {
  const [proceso, setProceso] = useState<Proceso | null>(null);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [asistenteMode, setAsistenteMode] = useState<'standard' | 'no-entrega'>('standard');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setErrorState] = useState<string | null>(null);
  const [success, setSuccessState] = useState<string | null>(null);

  const setError = (msg: string | null) => {
    setErrorState(msg);
    if (msg) toast.error(msg);
  };

  const setSuccess = (msg: string | null) => {
    setSuccessState(msg);
    if (msg) toast.success(msg);
  };

  const clearError = () => {
    setErrorState(null);
    setSuccessState(null);
  };

  const updateProcesoFromDb = (nuevoProceso: Proceso) => {
    try {
      setProceso(nuevoProceso);
      let siguiente = 2; 
      // Mapeo ultra-robusto basado en IDs presentes
      if (nuevoProceso.id_mipres) siguiente = 3;
      if (nuevoProceso.id_programacion) siguiente = 4;
      if (nuevoProceso.id_entrega) siguiente = 5;
      
      // Si ya está reportado, se queda en el 5 para descargar el Excel
      if (nuevoProceso.id_reporte || nuevoProceso.estado === 'REPORTADO') siguiente = 5;

      setCurrentStep(siguiente);
    } catch (e) {
      console.error('Error al actualizar proceso:', e);
      setError('Error interno al navegar entre pasos.');
    }
  };

  const syncStep = async (_noPrescripcion: string, _targetStep: number) => {
    setIsLoading(true);
    clearError();
    try {
      // Implementación simplificada para cumplir con la interfaz
      console.log('Syncing step...', _noPrescripcion, _targetStep);
    } catch (err: any) {
      setError('Error en sincronización: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const startSyncProcess = async (noPrescripcion: string, record: any) => {
    setIsLoading(true);
    clearError();
    try {
      const { syncAsistenteFromSispro } = await import('../services/api');
      const authData = localStorage.getItem('auth_data');
      if (!authData) throw new Error('No hay sesión activa.');
      const auth = JSON.parse(authData);
      
      const response = await syncAsistenteFromSispro({
        nit: auth.nit,
        token: auth.token,
        no_prescripcion: noPrescripcion,
        sisproRecord: record
      });

      if (response.ok && response.data?.proceso) {
        updateProcesoFromDb(response.data.proceso);
      } else {
        throw new Error('No se pudo sincronizar con SISPRO');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const goBack = () => {
    setCurrentStep((prev) => Math.max(1, prev - 1));
  };

  return (
    <AsistenteContext.Provider
      value={{
        proceso,
        setProceso,
        currentStep,
        setCurrentStep,
        asistenteMode,
        setAsistenteMode,
        isLoading,
        setIsLoading,
        error,
        setError,
        success,
        setSuccess,
        clearError,
        updateProcesoFromDb,
        syncStep,
        startSyncProcess,
        goBack,
      }}
    >
      {children}
    </AsistenteContext.Provider>
  );
};

export const useAsistente = () => {
  const context = useContext(AsistenteContext);
  if (context === undefined) {
    throw new Error('useAsistente must be used within an AsistenteProvider');
  }
  return context;
};

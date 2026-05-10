import axios from 'axios';
import type { AuthState } from '../context/AuthContext';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// Interceptor para inyectar NIT y Token automáticamente
api.interceptors.request.use((config) => {
  const saved = localStorage.getItem('mipres_auth');
  if (saved) {
    try {
      const auth = JSON.parse(saved) as AuthState;
      if (auth.nit && auth.token) {
        config.headers['X-NIT'] = auth.nit;
        config.headers['X-Token'] = auth.token;
      }
    } catch (e) {
      // Ignorar errores de parseo
    }
  }
  return config;
});

// ── PROCESOS (CRUD local) ────────────────────────────────────
export const getProcesos = () =>
  api.get('/procesos').then(r => r.data);

export const getProceso = (id: number) =>
  api.get(`/procesos/${id}`).then(r => r.data);

export const createProceso = (body: { nit: string; token: string }) =>
  api.post(`/procesos`, body).then(r => r.data);

// ── ASISTENTE — los 5 pasos y sincronización ────────────────────
export const asistenteToken = (body: { nit: string; tokenBase: string }) =>
  api.post('/wizard/token', body).then(r => r.data);

export const asistenteVerificarDireccionamiento = (id: number, body: object) =>
  api.post(`/wizard/${id}/verificar-direccionamiento`, body).then(r => r.data);

export const asistenteProgramacion = (id: number, body: object) =>
  api.put(`/wizard/${id}/programacion`, body).then(r => r.data);

export const asistenteEntrega = (id: number, body: object) =>
  api.put(`/wizard/${id}/entrega`, body).then(r => r.data);

export const asistenteReporte = (id: number, body: object) =>
  api.put(`/wizard/${id}/reporte`, body).then(r => r.data);

export const asistenteSkipStep = (id: number, step: number) =>
  api.post(`/wizard/${id}/skip-step`, { step }).then(r => r.data);

export const syncAsistenteFromSispro = (payload: { nit: string, token: string, no_prescripcion: string, sisproRecord: any }) =>
  api.post('/wizard/sync-from-sispro', payload).then(res => res.data);

// ── STANDALONE (Módulos independientes Mipres) ────────────────
export const sisproGet = (endpoint: string, nit: string, token: string, arg?: string) => 
  api.post(`/standalone/call/${endpoint}`, { nit, token, arg }).then(r => r.data);

export const sisproPut = (endpoint: string, nit: string, token: string, payload?: any, arg?: string) => 
  api.post(`/standalone/call/${endpoint}`, { nit, token, arg, payload }).then(r => r.data);

export const exportUnitValues = (formData: FormData) =>
  api.post('/batch/export-unit-values', formData, {
    responseType: 'blob',
    headers: { 'Content-Type': 'multipart/form-data' } 
  }).then(res => res.data);

export default api;

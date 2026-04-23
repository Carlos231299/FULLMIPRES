import 'dotenv/config';
import axios from 'axios';

// Cliente Axios configurado para la API MIPRES
const baseURL = process.env.MIPRES_BASE_URL || 'https://wsmipres.sispro.gov.co/WSSUMMIPRESNOPBS/api';

const mipres = axios.create({
  baseURL,
  timeout: 30000, 
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
});

// ── Interceptor: log de cada llamado (útil para debug) ───────
mipres.interceptors.request.use((config) => {
  console.log(`[MIPRES] → ${config.method?.toUpperCase()} ${config.url}`);
  if (config.data) {
    console.log(`[MIPRES] Payload enviado ->`, JSON.stringify(config.data));
  }
  return config;
});

mipres.interceptors.response.use(
  (res) => {
    console.log(`[MIPRES] ← ${res.status} ${res.config.url}`);
    return res;
  },
  (err) => {
    const status = err.response?.status;
    const url    = err.config?.url;
    const detail = err.response?.data ?? err.message;
    console.error(`[MIPRES] ✗ ${status} ${url}`, detail);
    return Promise.reject(err);
  }
);

// Cliente Axios para Facturación
const facturacionClient = axios.create({
  baseURL: process.env.MIPRES_BILLING_URL || 'https://wsmipres.sispro.gov.co/WSFACMIPRESNOPBS/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept':       'application/json',
  },
});

facturacionClient.interceptors.request.use((config) => {
  console.log(`[FACTURACION] → ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

// ════════════════════════════════════════════════════════════
// PASO 1 — Generar Token
// GET /api/GenerarToken/{nit}/{token}
// ════════════════════════════════════════════════════════════
export async function generarToken(nit, tokenBase) {
  const { data } = await mipres.get(`/GenerarToken/${nit}/${tokenBase}`);
  return data;
}

// ════════════════════════════════════════════════════════════
// NUEVO PASO 2 — Consultar Entrega Previa (Validar)
// GET /api/ReporteEntregaXPrescripcion/{nit}/{token}/{noPres}
// ════════════════════════════════════════════════════════════
export async function getReporteEntregaXPrescripcion(nit, token, noPres) {
  const { data } = await mipres.get(`/ReporteEntregaXPrescripcion/${nit}/${token}/${noPres}`);
  return data;
}

// NUEVAS CONSULTAS PROFUNDAS PARA HISTORIAL
export async function getProgramacionXPrescripcion(nit, token, noPres) {
  const { data } = await mipres.get(`/ProgramacionXPrescripcion/${nit}/${token}/${noPres}`);
  return data;
}

export async function getEntregaXPrescripcion(nit, token, noPres) {
  const { data } = await mipres.get(`/EntregaXPrescripcion/${nit}/${token}/${noPres}`);
  return data;
}

// ════════════════════════════════════════════════════════════
// NUEVO PASO 3 — Consultar Direccionamiento
// GET /api/DireccionamientoXPrescripcion/{nit}/{token}/{noPres}
// ════════════════════════════════════════════════════════════
export async function getDireccionamientoXPrescripcion(nit, token, noPres) {
  const { data } = await mipres.get(`/DireccionamientoXPrescripcion/${nit}/${token}/${noPres}`);
  return data;
}

// ════════════════════════════════════════════════════════════
// PASO 3 — Programación
// PUT /api/Programacion/{nit}/{token}
// ════════════════════════════════════════════════════════════
export async function programacion(nit, token, payload) {
  const { data } = await mipres.put(`/Programacion/${nit}/${token}`, payload);
  return data;
}

// ════════════════════════════════════════════════════════════
// PASO 4 — Entrega
// PUT /api/Entrega/{nit}/{token}
// ════════════════════════════════════════════════════════════
export async function entrega(nit, token, payload) {
  const { data } = await mipres.put(`/Entrega/${nit}/${token}`, payload);
  return data;
}

// ════════════════════════════════════════════════════════════
// PASO 5 — Reporte de Entrega
// PUT /api/ReporteEntrega/{nit}/{token}
// ════════════════════════════════════════════════════════════
export async function reporteEntrega(nit, token, payload) {
  const { data } = await mipres.put(`/ReporteEntrega/${nit}/${token}`, payload);
  return data;
}

// ════════════════════════════════════════════════════════════
// CONSULTAS NO DIRECCIONAMIENTO
// ════════════════════════════════════════════════════════════
export async function getNoDireccionamientoXPrescripcion(nit, token, noPres) {
  const { data } = await mipres.get(`/NODireccionamientoXPrescripcion/${nit}/${token}/${noPres}`);
  return data;
}

export async function getNoDireccionamientoXFecha(nit, token, fecha) {
  const { data } = await mipres.get(`/NODireccionamientoXFecha/${nit}/${token}/${fecha}`);
  return data;
}

export async function getNoDireccionamientoXPacienteFecha(nit, fecha, token, tipodoc, numdoc) {
  const { data } = await mipres.get(`/NODireccionamientoXPacienteFecha/${nit}/${fecha}/${token}/${tipodoc}/${numdoc}`);
  return data;
}

// ════════════════════════════════════════════════════════════
// NUEVOS ENDPOINTS STANDALONE PARA CREACIÓN DIRECTA Y NÓ DIRECCIONAMIENTO
// ════════════════════════════════════════════════════════════
export async function direccionamiento(nit, token, payload) {
  const { data } = await mipres.put(`/Direccionamiento/${nit}/${token}`, payload);
  return data;
}

export async function noDireccionamiento(nit, token, payload) {
  const { data } = await mipres.put(`/NoDireccionamiento/${nit}/${token}`, payload);
  return data;
}

// ════════════════════════════════════════════════════════════
// ANULACIONES — ORDEN CORRECTO: /{nit}/{token}/{id}
// ════════════════════════════════════════════════════════════
export async function anularDireccionamiento(nit, token, idDireccionamiento) {
  const { data } = await mipres.put(`/AnularDireccionamiento/${encodeURIComponent(nit)}/${encodeURIComponent(token)}/${encodeURIComponent(idDireccionamiento)}`);
  return data;
}

export async function anularProgramacion(nit, token, idProgramacion) {
  const { data } = await mipres.put(`/AnularProgramacion/${encodeURIComponent(nit)}/${encodeURIComponent(token)}/${encodeURIComponent(idProgramacion)}`);
  return data;
}

export async function anularEntrega(nit, token, idEntrega) {
  const { data } = await mipres.put(`/AnularEntrega/${encodeURIComponent(nit)}/${encodeURIComponent(token)}/${encodeURIComponent(idEntrega)}`);
  return data;
}

export async function anularReporteEntrega(nit, token, idReporteEntrega) {
  const { data } = await mipres.put(`/AnularReporteEntrega/${encodeURIComponent(nit)}/${encodeURIComponent(token)}/${encodeURIComponent(idReporteEntrega)}`);
  return data;
}

export async function anularNoDireccionamiento(nit, token, idNoDireccionamiento) {
  const { data } = await mipres.put(`/AnularNoDireccionamiento/${encodeURIComponent(nit)}/${encodeURIComponent(token)}/${encodeURIComponent(idNoDireccionamiento)}`);
  return data;
}

// ════════════════════════════════════════════════════════════
// FACTURACIÓN
// ════════════════════════════════════════════════════════════
export async function getFacturacionXPrescripcion(nit, token, noPres) {
  const { data } = await facturacionClient.get(`/FacturacionXPrescripcion/${nit}/${token}/${noPres}`);
  return data;
}

export async function facturacion(nit, token, payload) {
  const { data } = await facturacionClient.put(`/Facturacion/${nit}/${token}`, payload);
  return data;
}

export async function anularFacturacion(nit, token, idFacturacion) {
  const { data } = await facturacionClient.put(`/FacturacionAnular/${nit}/${token}/${idFacturacion}`);
  return data;
}

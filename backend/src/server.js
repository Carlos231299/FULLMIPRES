import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import procesosRouter from './routes/procesos.js';
import wizardRouter   from './routes/wizard.js';
import batchRouter    from './routes/batch.js';
import billingBatchRouter from './routes/billingBatch.js';
import standaloneRouter from './routes/standalone.js';
import asistenteMasivoRouter from './routes/asistenteMasivo.js';
import adminRouter from './routes/admin.js';

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';

// ── CORS ───────────────────────────────────────────────────
// En desarrollo: permite todo. En producción: solo el dominio configurado.
const corsOptions = process.env.CORS_ORIGIN
  ? { origin: process.env.CORS_ORIGIN.split(','), credentials: true }
  : { origin: true }; // desarrollo: acepta cualquier origen

app.use(cors(corsOptions));

// ── Middlewares ────────────────────────────────────────────
app.use(express.json());

// ── Health check ────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Servidor MIPRES funcionando ✅' });
});

// ── Rutas ──────────────────────────────────────────────────
app.use('/api/procesos', procesosRouter);
app.use('/api/wizard',   wizardRouter);
app.use('/api/batch',    batchRouter);
app.use('/api/batch-billing', billingBatchRouter);
app.use('/api/standalone', standaloneRouter);
app.use('/api/asistente-masivo', asistenteMasivoRouter);
app.use('/api/admin', adminRouter);

// ── Arranque del servidor ───────────────────────────────────
app.listen(PORT, HOST, () => {
  console.log(`🚀 Servidor MIPRES corriendo en http://${HOST}:${PORT}`);
  console.log(`✅ Modo: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 CORS: ${process.env.CORS_ORIGIN || 'abierto (dev)'}`);
});

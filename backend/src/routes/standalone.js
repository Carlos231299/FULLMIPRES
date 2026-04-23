import { Router } from 'express';
import * as MipresApi from '../services/mipresApi.js';

const router = Router();

// Proxy Seguro para cualquier método (POST con body para evitar problemas de URL)
router.post('/call/:method', async (req, res) => {
  try {
    const { method } = req.params;
    const { nit, token, arg, payload } = req.body;
    
    if (typeof MipresApi[method] !== 'function') {
      return res.status(404).json({ ok: false, error: 'Método SISPRO no encontrado.' });
    }

    const result = await MipresApi[method](nit, token, arg || payload);
    res.json({ ok: true, data: result });
  } catch (error) {
    res.status(error.response?.status || 500).json({ 
      ok: false, 
      error: error.response?.data || error.message 
    });
  }
});

export default router;

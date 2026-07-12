/**
 * Gemini proxy route — thin HTTP wrapper around the generation service.
 *
 * All actual Vertex logic (cost tracking, storage upload, asset rows, LRO
 * handling) lives in backend/services/generation.ts so the MCP connector can
 * share the exact same execution path. This route only adds: auth, the AI
 * rate limiter, the ~58s abort timeout, and HTTP response shaping.
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { aiLimiter } from '../config/cors.ts';
import { runGeneration, GenerationHttpError } from '../services/generation.ts';

const router = express.Router();

router.post('/', requireAuth, aiLimiter, async (req, res) => {
  // User is already authenticated via requireAuth middleware
  const userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 58000);

  try {
    const { method, params } = req.body;
    const data = await runGeneration({ method, params, userId, signal: controller.signal, via: 'app' });
    return res.json({ success: true, data });
  } catch (err: any) {
    if (err instanceof GenerationHttpError) {
      return res.status(err.status).json(err.payload);
    }
    console.error('Gemini proxy error:', err);
    if (err.name === 'AbortError') return res.status(504).json({ error: 'Upstream request timed out (504).' });
    return res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    clearTimeout(timeoutId);
  }
});

export default router;

/**
 * Gemini proxy route — thin HTTP wrapper around the generation service.
 *
 * All actual Vertex logic (cost tracking, storage upload, asset rows, LRO
 * handling) lives in backend/services/generation.ts so the MCP connector can
 * share the exact same execution path. This route only adds: auth, the AI
 * rate limiter, the request deadline, and HTTP response shaping.
 */

import express from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { aiLimiter } from '../config/cors.ts';
import { runGeneration, GenerationHttpError } from '../services/generation.ts';

const router = express.Router();

/**
 * How long a generation may take before we give up and answer.
 *
 * The binding limit is Cloudflare, which abandons an origin request at ~100s
 * and serves its own HTML error page — the client then gets markup where it
 * expected JSON. nginx allows 120s, so Cloudflare is what we must stay under.
 *
 * 90s leaves room for the quota gate to hold a request (up to 30s) and the
 * generation itself (15-30s typically) without either being cut short. Aborting
 * mid-generation is worse than waiting: Google bills for the work regardless,
 * and the quota slot is spent either way.
 */
const REQUEST_DEADLINE_MS = Number(process.env.GENERATION_DEADLINE_MS || 90_000);

/**
 * Readable text out of a Vertex failure. `vertexRest` throws with the raw
 * response body as its message, which is a JSON envelope — surface the message
 * inside it rather than a wall of JSON.
 */
function upstreamMessage(err: any): string {
  const raw = err?.message ?? '';
  try {
    return JSON.parse(raw)?.error?.message || raw || 'Upstream request failed';
  } catch {
    return raw || 'Upstream request failed';
  }
}

router.post('/', requireAuth, aiLimiter, async (req, res) => {
  // User is already authenticated via requireAuth middleware
  const userId = (req as any).user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'User not authenticated' });
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_DEADLINE_MS);

  try {
    const { method, params } = req.body;
    // Inbound payload size. Referenced assets are resolved server-side, so this
    // stays in the low kB even with images attached — a jump to megabytes means
    // something started inlining base64 again.
    const bytes = Number(req.headers['content-length']) || 0;
    console.log(`[Proxy] ${method} ${params?.model ?? ''} payload=${bytes < 1024 ? `${bytes}B` : `${Math.round(bytes / 1024)}KB`}`);

    const data = await runGeneration({ method, params, userId, signal: controller.signal, via: 'app' });
    return res.json({ success: true, data });
  } catch (err: any) {
    if (err instanceof GenerationHttpError) {
      const retryAfter = err.payload.retryAfterSeconds;
      if (typeof retryAfter === 'number') res.set('Retry-After', String(retryAfter));
      return res.status(err.status).json(err.payload);
    }
    console.error('Gemini proxy error:', err);
    if (err.name === 'AbortError') return res.status(504).json({ error: 'Upstream request timed out (504).' });

    // Upstream 4xx must keep its status. Collapsing everything into 500 is what
    // made the client treat a rate limit as a transient fault and retry it into
    // an already-exhausted quota. 5xx stays 500 — that one really is transient.
    const upstream = typeof err.status === 'number' ? err.status : err.code;
    if (typeof upstream === 'number' && upstream >= 400 && upstream < 500) {
      if (upstream === 429) {
        res.set('Retry-After', '60');
        return res.status(429).json({
          error: 'Google rejected the request as over quota. Try again in a minute.',
          retryAfterSeconds: 60,
        });
      }
      return res.status(upstream).json({ error: upstreamMessage(err) });
    }

    return res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    clearTimeout(timeoutId);
  }
});

export default router;

import express from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { corsMiddleware } from './backend/config/cors.ts';
import { AUTH_CONFIG } from './backend/config/auth.ts';

// New routes (SQLite + Local Storage)
import authRoutes from './backend/routes/auth-new.ts';
import projectsRoutes from './backend/routes/projects.ts';
import workflowsRoutes from './backend/routes/workflows.ts';
import chatsRoutes from './backend/routes/chats.ts';
import assetsRoutes from './backend/routes/assets.ts';
import presetsRoutes from './backend/routes/presets.ts';
import usageRoutes from './backend/routes/usage.ts';

// Legacy routes (for Vertex AI integration)
import uploadRoutes from './backend/routes/upload.ts';
import imageProxyRoutes from './backend/routes/imageProxy.ts';
import geminiRoutes from './backend/routes/gemini.ts';
import upscaleRoutes from './backend/routes/upscale.ts';
import interpolateRoutes from './backend/routes/interpolate.ts';
import videoRoutes from './backend/routes/video.ts';
import batchsizeRoutes from './backend/routes/batchsize.ts';
import promptRoutes from './backend/routes/prompts.ts';

// MCP connector (remote MCP server + OAuth endpoints)
import { mountMcp } from './backend/mcp/index.ts';

// Initialize database on startup
import './backend/services/database.ts';

dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_PRODUCTION = AUTH_CONFIG.isProduction;

/**
 * Builds the Express app (API + MCP connector, and optionally the SPA).
 * Exported so tests can boot the real thing in-process — `serveFrontend: false`
 * skips Vite/dist, which a backend test has no use for.
 */
export async function createApp({ serveFrontend = true }: { serveFrontend?: boolean } = {}) {
  const app = express();

  // Trust exactly one proxy hop (Cloudflare sits directly in front of this
  // process — no local nginx). Without this, Express ignores X-Forwarded-For
  // and express-rate-limit throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR on every
  // request, plus rate limits would key off Cloudflare's IP for everyone.
  if (IS_PRODUCTION) {
    app.set('trust proxy', 1);
  }

  // Compression middleware for all responses
  app.use(compression());

  // Security headers — CSP and COOP disabled for simple internal tool
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  }));
  app.use(corsMiddleware);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  // API Routes
  const apiRouter = express.Router();

  // New API routes (SQLite + Local Storage)
  apiRouter.use('/auth', authRoutes);
  apiRouter.use('/projects', projectsRoutes);
  apiRouter.use('/workflows', workflowsRoutes);
  apiRouter.use('/chats', chatsRoutes);
  apiRouter.use('/assets', assetsRoutes);
  apiRouter.use('/presets', presetsRoutes);
  apiRouter.use('/usage', usageRoutes);

  // Legacy routes (Vertex AI integration)
  apiRouter.use('/', uploadRoutes);
  apiRouter.use('/proxy-image', imageProxyRoutes);
  apiRouter.use('/gemini/proxy', geminiRoutes);
  apiRouter.use('/upscale', upscaleRoutes);
  apiRouter.use('/interpolate', interpolateRoutes);
  apiRouter.use('/video', videoRoutes);
  apiRouter.use('/batchsize', batchsizeRoutes);
  apiRouter.use('/prompts', promptRoutes);

  // Health check
  apiRouter.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Storage status (for debugging)
  apiRouter.get('/storage-status', async (_req, res) => {
    try {
      const { getStorageStats } = await import('./backend/services/storage.ts');
      const stats = getStorageStats();
      res.json({
        storage: stats,
        storagePath: process.env.STORAGE_PATH || './storage'
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/api', apiRouter);

  // MCP connector — must mount before the SPA catch-all below, or the prod
  // `app.get('*')` would swallow /mcp and every OAuth endpoint.
  mountMcp(app);

  // Serve static storage files with 7-day browser caching
  const STORAGE_PATH = process.env.STORAGE_PATH || path.join(process.cwd(), 'storage');
  app.use('/storage', express.static(STORAGE_PATH, {
    maxAge: '7d',
    immutable: true,
    etag: true,
  }));

  // Serve frontend
  if (serveFrontend) {
    if (!IS_PRODUCTION) {
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa', base: '/' });
      app.use('/', vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use('/', express.static(distPath));
      app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
    }
  }

  // Error handler
  app.use((err: any, _req: any, res: any, _next: any) => {
    console.error('Server error:', err);
    res.status(err.status || 500).json({ success: false, error: err.message || 'Internal Server Error' });
  });

  return { app, storagePath: STORAGE_PATH };
}

async function startServer() {
  const PORT = parseInt(process.env.PORT || '3000');
  const { app, storagePath } = await createApp();

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n✅ Minn Creative Studio running on http://localhost:${PORT}`);
    console.log(`📁 Storage: ${storagePath}`);
    console.log(`🔐 Auth: Local (2 users: mounir.nawwar, rana.tadmori)`);
    console.log(`🤖 Vertex AI: Configure GOOGLE_APPLICATION_CREDENTIALS\n`);
  });
}

// Only auto-start when run as the entry point (tests import createApp directly)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}

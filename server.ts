import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { corsMiddleware } from './backend/config/cors.ts';
import { AUTH_CONFIG } from './backend/config/auth.ts';
import authRoutes from './backend/routes/auth.ts';
import uploadRoutes from './backend/routes/upload.ts';
import imageProxyRoutes from './backend/routes/imageProxy.ts';
import geminiRoutes from './backend/routes/gemini.ts';
import upscaleRoutes from './backend/routes/upscale.ts';
import interpolateRoutes from './backend/routes/interpolate.ts';
import videoRoutes from './backend/routes/video.ts';
import batchsizeRoutes from './backend/routes/batchsize.ts';
import promptRoutes from './backend/routes/prompts.ts';
// Side-effect import: triggers Firebase Admin initialization
import './backend/services/firebase.ts';

dotenv.config({ path: '.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const IS_PRODUCTION = AUTH_CONFIG.isProduction;

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000');

  // Security headers — CSP and COOP disabled:
  // CSP: simple 2-user internal tool, not needed
  // COOP: Firebase popup auth uses window.opener.postMessage across origins
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: false,
  }));
  app.use(corsMiddleware);
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  const apiRouter = express.Router();

  apiRouter.use('/', authRoutes);
  apiRouter.use('/upload', uploadRoutes);
  apiRouter.use('/proxy-image', imageProxyRoutes);
  apiRouter.use('/gemini/proxy', geminiRoutes);
  apiRouter.use('/upscale', upscaleRoutes);
  apiRouter.use('/interpolate', interpolateRoutes);
  apiRouter.use('/video', videoRoutes);
  apiRouter.use('/batchsize', batchsizeRoutes);
  apiRouter.use('/prompts', promptRoutes);

  apiRouter.get('/health', (_req, res) => res.json({ status: 'ok' }));
  apiRouter.get('/storage-status', async (_req, res) => {
    try {
      const { getStorageStatus } = await import('./backend/services/firebase.ts');
      const { getStorage: getAdminStorage } = await import('firebase-admin/storage');
      const sa = process.env.FIREBASE_SERVICE_ACCOUNT?.trim()
        ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
        : null;
      let availableBuckets: string[] = [];
      try {
        const [buckets] = await (getAdminStorage() as any).getBuckets();
        availableBuckets = buckets.map((x: any) => x.name);
      } catch (e: any) {
        availableBuckets = [`Error: ${e.message}`];
      }
      res.json({ ...getStorageStatus(), saProjectId: sa?.project_id || 'missing', availableBuckets });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use('/api', apiRouter);

  if (!IS_PRODUCTION) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa', base: '/' });
    app.use('/', vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/', express.static(distPath));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status || 500).json({ success: false, error: err.message || 'Internal Server Error' });
  });

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();

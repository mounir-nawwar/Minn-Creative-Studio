import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
import { initializeApp, cert, getApps, App } from 'firebase-admin/app';
import { getStorage as getAdminStorage } from 'firebase-admin/storage';
import { GoogleGenAI } from '@google/genai';
import firebaseConfig from './firebase-applet-config.json';
import upscaleRoutes from './backend/routes/upscale.ts';
import interpolateRoutes from './backend/routes/interpolate.ts';
import videoRoutes from './backend/routes/video.ts';

dotenv.config({ override: false });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// --- Firebase Admin ---
let adminApp: App | null = null;
let resolvedBucketName: string | null = null;
const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
const configBucketName = (process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || '').replace('gs://', '').trim();

function initFirebaseAdmin() {
  if (getApps().length > 0) { adminApp = getApps()[0]; return; }
  if (!serviceAccountStr) { console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not set.'); return; }
  try {
    const sa = JSON.parse(serviceAccountStr);
    adminApp = initializeApp({ credential: cert(sa), storageBucket: configBucketName });
  } catch (err: any) {
    console.error('❌ Firebase Admin init failed:', err.message);
  }
}

async function getWorkingBucket() {
  if (resolvedBucketName) return getAdminStorage().bucket(resolvedBucketName);
  const storage = getAdminStorage();
  const sa = serviceAccountStr ? JSON.parse(serviceAccountStr) : null;
  const fallbacks = new Set<string>();
  for (const id of [sa?.project_id, firebaseConfig.projectId].filter(Boolean)) {
    fallbacks.add(`${id}.appspot.com`);
    fallbacks.add(`${id}.firebasestorage.app`);
  }
  if (configBucketName) fallbacks.add(configBucketName);
  for (const name of fallbacks) {
    try {
      const bucket = storage.bucket(name);
      const [exists] = await bucket.exists();
      if (exists) { resolvedBucketName = name; return bucket; }
    } catch {}
  }
  try {
    const [buckets] = await (storage as any).getBuckets();
    if (buckets.length > 0) { resolvedBucketName = buckets[0].name; return buckets[0]; }
  } catch {}
  return storage.bucket();
}

initFirebaseAdmin();

// Fetches { _imageUrl } markers server-side and replaces with { inlineData }
async function resolveImageUrls(contents: any): Promise<any> {
  const resolveParts = (parts: any[]) =>
    Promise.all(parts.map(async (part: any) => {
      if (!part._imageUrl) return part;
      const r = await fetch(part._imageUrl);
      if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
      const buf = await r.arrayBuffer();
      return { inlineData: { data: Buffer.from(buf).toString('base64'), mimeType: r.headers.get('content-type') || 'image/jpeg' } };
    }));
  if (Array.isArray(contents)) return Promise.all(contents.map(async (c: any) => c?.parts ? { ...c, parts: await resolveParts(c.parts) } : c));
  if (contents?.parts) return { ...contents, parts: await resolveParts(contents.parts) };
  return contents;
}

// Vertex AI only accepts role 'user'|'model' — normalize roles and extract system prompts
function sanitizeForVertex(params: any): any {
  if (!params.contents) return params;
  const arr: any[] = Array.isArray(params.contents) ? params.contents : [params.contents];
  const systemParts = arr.filter((c: any) => c?.role === 'system').flatMap((c: any) => c?.parts ?? []);
  const sanitized = arr
    .filter((c: any) => c?.role !== 'system')
    .map((c: any) => ({ ...c, role: c.role === 'assistant' ? 'model' : (c.role || 'user') }));
  const result: any = { ...params, contents: sanitized };
  if (systemParts.length > 0) {
    const systemText = systemParts.map((p: any) => p.text ?? '').join('\n');
    const existing = result.config?.systemInstruction;
    result.config = { ...result.config, systemInstruction: existing ? `${typeof existing === 'string' ? existing : existing?.parts?.[0]?.text ?? ''}\n${systemText}` : systemText };
  }
  return result;
}

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000');

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
  const apiRouter = express.Router();

  apiRouter.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    try {
      if (!adminApp) throw new Error('Firebase Admin is not initialized.');
      const bucket = await getWorkingBucket();
      const destination = `projects/${req.body.projectId || 'default'}/assets/${Date.now()}-${req.file.originalname}`;
      await bucket.file(destination).save(req.file.buffer, { metadata: { contentType: req.file.mimetype }, public: true });
      return res.json({ success: true, url: `https://storage.googleapis.com/${bucket.name}/${destination}`, fileName: destination });
    } catch (err: any) {
      const isBucketMissing = err.message?.includes('does not exist') || err.code === 404;
      return res.status(500).json({ error: isBucketMissing ? 'Firebase Storage bucket not found. Enable it in Firebase Console: Build → Storage → Get Started.' : err.message });
    }
  });

  apiRouter.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ username }, SESSION_SECRET, { expiresIn: '30d' });
      res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: 30 * 24 * 60 * 60 * 1000 });
      return res.json({ success: true });
    }
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  });

  apiRouter.post('/logout', (req, res) => {
    res.clearCookie('session', { httpOnly: true, secure: true, sameSite: 'none' });
    res.json({ success: true });
  });

  apiRouter.get('/me', (req, res) => {
    const token = req.cookies.session;
    if (!token) return res.status(401).json({ authenticated: false });
    try {
      res.json({ authenticated: true, user: jwt.verify(token, SESSION_SECRET) });
    } catch {
      res.status(401).json({ authenticated: false });
    }
  });

  apiRouter.use('/upscale', upscaleRoutes);
  apiRouter.use('/interpolate', interpolateRoutes);
  apiRouter.use('/video', videoRoutes);

  apiRouter.get('/health', (_req, res) => res.json({ status: 'ok' }));

  apiRouter.get('/storage-status', async (_req, res) => {
    try {
      const sa = serviceAccountStr ? JSON.parse(serviceAccountStr) : null;
      let availableBuckets: string[] = [];
      if (adminApp) {
        try { const [b] = await (getAdminStorage() as any).getBuckets(); availableBuckets = b.map((x: any) => x.name); }
        catch (e: any) { availableBuckets = [`Error: ${e.message}`]; }
      }
      res.json({ adminInitialized: !!adminApp, saProjectId: sa?.project_id || 'missing', configBucket: configBucketName, resolvedBucket: resolvedBucketName || 'not yet resolved', availableBuckets });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  apiRouter.post('/proxy-image', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });
    try {
      const response = await fetch(url);
      if (!response.ok) return res.status(502).json({ error: `Failed to fetch image: ${response.status}` });
      const buffer = await response.arrayBuffer();
      res.json({ data: Buffer.from(buffer).toString('base64'), mimeType: response.headers.get('content-type') || 'image/jpeg' });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  apiRouter.post('/gemini/proxy', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!IS_PRODUCTION && !apiKey) return res.status(500).json({ error: 'API key not configured' });

    try {
      const { method } = req.body;
      let params = req.body.params;

      const ai = IS_PRODUCTION
        ? new GoogleGenAI({ vertexai: true, project: process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0639313445', location: process.env.GOOGLE_CLOUD_LOCATION || 'global' })
        : new GoogleGenAI({ apiKey: apiKey! });

      if (method === 'generateContent') {
        if (params?.contents) params = { ...params, contents: await resolveImageUrls(params.contents) };
        if (IS_PRODUCTION) params = sanitizeForVertex(params);
        const response = await ai.models.generateContent(params);
        const candidates = response.candidates ?? [];
        const text = candidates.flatMap((c: any) => (c?.content?.parts ?? []).filter((p: any) => p.text).map((p: any) => p.text)).join('');
        const promptBlock = (response as any).promptFeedback?.blockReason;
        const hasImage = candidates.some((c: any) => c?.content?.parts?.some((p: any) => p.inlineData));
        if (promptBlock && !hasImage) return res.status(422).json({ success: false, error: `Prompt blocked: ${promptBlock}` });
        return res.json({ success: true, data: { candidates, text, promptFeedback: (response as any).promptFeedback } });
      }

      if (method === 'generateImages') return res.json({ success: true, data: await ai.models.generateImages(params) });
      if (method === 'generateVideos') return res.json({ success: true, data: await ai.models.generateVideos(params) });
      if (method === 'getOperation') return res.json({ success: true, data: await ai.operations.getVideosOperation(params) });

      if (method === 'fetchVideoFile') {
        const headers: Record<string, string> = {};
        if (apiKey) headers['x-goog-api-key'] = apiKey;
        const r = await fetch(params.url, { headers });
        const base64 = Buffer.from(await r.arrayBuffer()).toString('base64');
        return res.json({ success: true, data: { base64, contentType: r.headers.get('content-type') || 'video/mp4' } });
      }

      return res.status(400).json({ error: `Unknown method: ${method}` });
    } catch (err: any) {
      console.error('Gemini proxy error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
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

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));

  app.use((err: any, _req: any, res: any, _next: any) => {
    res.status(err.status || 500).json({ success: false, error: err.message || 'Internal Server Error' });
  });
}

startServer();

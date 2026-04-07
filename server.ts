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

// Cloud Run injects GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION which cause
// the @google/genai SDK to attempt Vertex AI auth instead of using the API key.
delete process.env.GOOGLE_CLOUD_PROJECT;
delete process.env.GOOGLE_CLOUD_LOCATION;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';

// --- Firebase Admin Initialization ---
let adminApp: App | null = null;
let resolvedBucketName: string | null = null;

const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT?.trim();
const configBucketName = (process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket || '').replace('gs://', '').trim();

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return;
  }

  if (!serviceAccountStr) {
    console.warn('⚠️  FIREBASE_SERVICE_ACCOUNT not set. Backend uploads will be disabled.');
    return;
  }

  try {
    const sa = JSON.parse(serviceAccountStr);
    console.log(`[Admin] Initializing for Project: ${sa.project_id}`);
    
    adminApp = initializeApp({
      credential: cert(sa),
      storageBucket: configBucketName
    });
    console.log('✅ Firebase Admin initialized successfully.');
  } catch (err: any) {
    console.error('❌ Failed to initialize Firebase Admin:', err.message);
  }
}

// Helper to find a working bucket
async function getWorkingBucket() {
  if (resolvedBucketName) return getAdminStorage().bucket(resolvedBucketName);
  
  const storage = getAdminStorage();
  const sa = serviceAccountStr ? JSON.parse(serviceAccountStr) : null;
  const saProjectId = sa?.project_id?.trim();

  const fallbacks = new Set<string>();
  
  // 1. Try variations of the Project ID (Most common working buckets)
  if (saProjectId) {
    fallbacks.add(`${saProjectId}.appspot.com`);
    fallbacks.add(`${saProjectId}.firebasestorage.app`);
    fallbacks.add(saProjectId);
  }
  
  if (firebaseConfig.projectId) {
    const pid = firebaseConfig.projectId.trim();
    fallbacks.add(`${pid}.appspot.com`);
    fallbacks.add(`${pid}.firebasestorage.app`);
    fallbacks.add(pid);
  }

  // 2. Try the provided bucket name from env
  if (configBucketName) {
    fallbacks.add(configBucketName);
  }

  console.log(`[Storage] Probing buckets: ${Array.from(fallbacks).join(', ')}`);

  for (const name of Array.from(fallbacks)) {
    try {
      const bucket = storage.bucket(name);
      const [exists] = await bucket.exists();
      if (exists) {
        console.log(`[Storage] ✅ Found working bucket: ${name}`);
        resolvedBucketName = name;
        return bucket;
      }
    } catch (e: any) {
      console.warn(`[Storage] ⚠️  Bucket ${name} check failed: ${e.message}`);
    }
  }

  // 3. Last Resort: List all buckets and pick the first one
  try {
    console.log('[Storage] ℹ️  Attempting to list all available buckets...');
    const [buckets] = await storage.getBuckets();
    if (buckets.length > 0) {
      const firstBucket = buckets[0];
      console.log(`[Storage] ✅ Using first discovered bucket: ${firstBucket.name}`);
      resolvedBucketName = firstBucket.name;
      return firstBucket;
    }
  } catch (e: any) {
    console.warn('[Storage] ⚠️  Could not list buckets:', e.message);
  }

  // Final fallback: try the system default
  return storage.bucket();
}

initFirebaseAdmin();

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || '3000');

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  const upload = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
  });

  const apiRouter = express.Router();

  apiRouter.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    try {
      if (!adminApp) {
        throw new Error('Firebase Admin is not initialized. Please check FIREBASE_SERVICE_ACCOUNT.');
      }

      const bucket = await getWorkingBucket();
      const sa = serviceAccountStr ? JSON.parse(serviceAccountStr) : {};
      
      console.log(`[Storage] Using bucket: ${bucket.name} for upload. (SA Project: ${sa.project_id})`);

      const projectId = req.body.projectId || 'default';
      const destination = `projects/${projectId}/assets/${Date.now()}-${req.file.originalname}`;
      
      const file = bucket.file(destination);
      
      await file.save(req.file.buffer, {
        metadata: { contentType: req.file.mimetype },
        public: true,
      });

      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
      console.log(`[Storage] ✅ Upload successful: ${publicUrl}`);
      
      return res.json({ success: true, url: publicUrl, fileName: destination });
    } catch (err: any) {
      console.error('[Storage] ❌ Upload error:', err.message);

      const isBucketMissing = err.message?.includes('does not exist') || err.code === 404;
      return res.status(500).json({
        error: isBucketMissing
          ? 'Firebase Storage bucket not found. Please enable Firebase Storage in the Firebase Console: Build → Storage → Get Started.'
          : err.message || 'Internal Server Error',
      });
    }
  });

  // Auth endpoints
  apiRouter.post('/login', (req, res) => {
    const { username, password } = req.body;
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      const token = jwt.sign({ username }, SESSION_SECRET, { expiresIn: '30d' });
      res.cookie('session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      });
      return res.json({ success: true });
    }
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  });

  apiRouter.post('/logout', (req, res) => {
    res.clearCookie('session', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    res.json({ success: true });
  });

  apiRouter.get('/me', (req, res) => {
    const token = req.cookies.session;
    if (!token) return res.status(401).json({ authenticated: false });

    try {
      const decoded = jwt.verify(token, SESSION_SECRET);
      res.json({ authenticated: true, user: decoded });
    } catch (err) {
      res.status(401).json({ authenticated: false });
    }
  });

  // API routes
  apiRouter.use('/upscale', upscaleRoutes);
  apiRouter.use('/interpolate', interpolateRoutes);
  apiRouter.use('/video', videoRoutes);

  apiRouter.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  apiRouter.get('/storage-status', async (req, res) => {
    try {
      const sa = serviceAccountStr ? JSON.parse(serviceAccountStr) : null;
      let availableBuckets: string[] = [];
      
      if (adminApp) {
        try {
          const [buckets] = await getAdminStorage().getBuckets();
          availableBuckets = buckets.map(b => b.name);
        } catch (e: any) {
          availableBuckets = [`Error listing buckets: ${e.message}`];
        }
      }

      res.json({
        adminInitialized: !!adminApp,
        hasServiceAccount: !!serviceAccountStr,
        saProjectId: sa?.project_id || 'missing',
        configProjectId: firebaseConfig.projectId,
        configBucket: configBucketName,
        resolvedBucket: resolvedBucketName || 'not yet resolved',
        availableBuckets
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Image proxy — fetches a URL server-side and returns base64 (avoids browser CORS on Firebase Storage)
  apiRouter.post('/proxy-image', async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'url required' });
    try {
      const response = await fetch(url);
      if (!response.ok) return res.status(502).json({ error: `Failed to fetch image: ${response.status}` });
      const buffer = await response.arrayBuffer();
      const mimeType = response.headers.get('content-type') || 'image/jpeg';
      const data = Buffer.from(buffer).toString('base64');
      res.json({ data, mimeType });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Gemini Proxy Route
  apiRouter.post('/gemini/proxy', async (req, res, next) => {
    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

    try {
      const { method, params } = req.body;
      const ai = new GoogleGenAI({ apiKey });

      if (method === 'generateContent') {
        const response = await ai.models.generateContent(params);
        return res.json({ 
          success: true, 
          data: {
            ...response,
            text: response.text
          } 
        });
      }

      if (method === 'generateImages') {
        const response = await ai.models.generateImages(params);
        return res.json({ success: true, data: response });
      }

      if (method === 'generateVideos') {
        const operation = await ai.models.generateVideos(params);
        return res.json({ success: true, data: operation });
      }

      if (method === 'getOperation') {
        const operation = await ai.operations.getVideosOperation(params);
        return res.json({ success: true, data: operation });
      }

      if (method === 'fetchVideoFile') {
        const { url } = params;
        const videoRes = await fetch(url, {
          headers: { 'x-goog-api-key': apiKey }
        });
        const arrayBuffer = await videoRes.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const contentType = videoRes.headers.get('content-type') || 'video/mp4';
        return res.json({ success: true, data: { base64, contentType } });
      }

      return res.status(400).json({ error: `Unknown method: ${method}` });
    } catch (err: any) {
      console.error('Gemini proxy error:', err);
      return res.status(500).json({ error: err.message || 'Internal server error' });
    }
  });

  app.use('/api', apiRouter);

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      base: '/',
    });
    app.use('/', vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/', express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Global Error Handler:', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  });
}

startServer();

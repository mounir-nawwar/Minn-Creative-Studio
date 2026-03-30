import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  app.use(cookieParser());

  // Check for required Firebase environment variables
  let bucketName = process.env.FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket;
  if (bucketName && bucketName.startsWith('gs://')) {
    bucketName = bucketName.replace('gs://', '');
  }
  // Ensure bucketName is not the string "undefined" or "null"
  if (bucketName === 'undefined' || bucketName === 'null') {
    bucketName = firebaseConfig.storageBucket;
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

  console.log('--- Firebase Configuration Check ---');
  console.log(`Config Project ID: ${firebaseConfig.projectId}`);
  console.log(`Config Storage Bucket: ${firebaseConfig.storageBucket}`);
  console.log(`Resolved Bucket Name: ${bucketName}`);
  console.log(`Service Account Present: ${!!serviceAccount}`);
  if (serviceAccount) {
    try {
      const sa = JSON.parse(serviceAccount);
      console.log(`Service Account Project ID: ${sa.project_id}`);
      if (sa.project_id !== firebaseConfig.projectId) {
        console.warn('⚠️  PROJECT ID MISMATCH detected on startup!');
      }
    } catch (e) {
      console.error('❌ Failed to parse Service Account JSON on startup');
    }
  }
  console.log('------------------------------------');

  if (!bucketName || !serviceAccount) {
    console.warn('\n⚠️  MISSING FIREBASE CONFIGURATION');
    if (!bucketName) console.warn('   - FIREBASE_STORAGE_BUCKET is not set');
    if (!serviceAccount) console.warn('   - FIREBASE_SERVICE_ACCOUNT is not set');
    console.warn('   Please add these to your environment variables in AI Studio Settings.\n');
  }

  const upload = multer({ 
    storage: multer.memoryStorage(), 
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB limit
  });

  const apiRouter = express.Router();

  apiRouter.post('/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });

    try {
      if (!bucketName || !serviceAccount) {
        throw new Error('Firebase Storage is not configured on the server. Please add FIREBASE_STORAGE_BUCKET and FIREBASE_SERVICE_ACCOUNT.');
      }

      // Initialize Firebase Admin if not already done
      if (!getApps().length) {
        console.log(`Initializing Firebase Admin with bucket: ${bucketName}`);
        try {
          const sa = JSON.parse(serviceAccount);
          console.log(`Service Account Project ID: ${sa.project_id}`);
          
          if (sa.project_id !== firebaseConfig.projectId) {
            console.warn(`⚠️  PROJECT ID MISMATCH: Service account project ID (${sa.project_id}) does not match config project ID (${firebaseConfig.projectId}). This may cause authentication errors.`);
          }

          initializeApp({ 
            credential: cert(sa), 
            storageBucket: bucketName 
          });
        } catch (parseErr: any) {
          throw new Error(`Failed to parse FIREBASE_SERVICE_ACCOUNT: ${parseErr.message}`);
        }
      }

      const sa = JSON.parse(serviceAccount);
      const saProjectId = sa.project_id;

      const projectId = req.body.projectId || 'default';
      const fileName = `projects/${projectId}/assets/${Date.now()}-${req.file.originalname}`;

      const trySave = async (targetBucketName: string) => {
        console.log(`Attempting to upload to bucket: ${targetBucketName}`);
        const currentBucket = getAdminStorage().bucket(targetBucketName);
        const currentFile = currentBucket.file(fileName);
        await currentFile.save(req.file.buffer, {
          metadata: { contentType: req.file.mimetype },
          public: true,
        });
        return targetBucketName;
      };

      let finalBucketName = bucketName;
      const triedBuckets: string[] = [];

      try {
        triedBuckets.push(bucketName);
        finalBucketName = await trySave(bucketName);
      } catch (saveErr: any) {
        if (saveErr.code === 404) {
          console.warn(`Primary bucket ${bucketName} not found. Trying fallbacks...`);
          
          const fallbacks = new Set<string>();
          
          // Pattern 1: .appspot.com
          if (bucketName.endsWith('.firebasestorage.app')) {
            fallbacks.add(bucketName.replace('.firebasestorage.app', '.appspot.com'));
          } else if (bucketName.endsWith('.appspot.com')) {
            fallbacks.add(bucketName.replace('.appspot.com', '.firebasestorage.app'));
          }

          // Pattern 2: Project IDs
          const projectIds = new Set([firebaseConfig.projectId, saProjectId]);
          for (const pid of projectIds) {
            fallbacks.add(pid);
            fallbacks.add(`${pid}.appspot.com`);
            fallbacks.add(`${pid}.firebasestorage.app`);
          }

          let success = false;
          for (const fallback of fallbacks) {
            if (triedBuckets.includes(fallback)) continue;
            triedBuckets.push(fallback);
            try {
              finalBucketName = await trySave(fallback);
              success = true;
              bucketName = fallback; // Update for future uploads
              console.log(`Successfully uploaded to fallback bucket: ${fallback}`);
              break;
            } catch (fallbackErr: any) {
              console.warn(`Fallback bucket ${fallback} failed: ${fallbackErr.message}`);
            }
          }
          
          if (!success) {
            const errorWithContext = new Error(`All storage buckets failed. Tried: ${triedBuckets.join(', ')}. Original error: ${saveErr.message}`);
            (errorWithContext as any).triedBuckets = triedBuckets;
            (errorWithContext as any).response = saveErr.response;
            throw errorWithContext;
          }
        } else {
          throw saveErr;
        }
      }

      const publicUrl = `https://storage.googleapis.com/${finalBucketName}/${fileName}`;
      return res.json({ success: true, url: publicUrl, fileName });
    } catch (err: any) {
      console.error('Upload error:', err);
      
      let errorMessage = err.message;
      let errorDetails = err.response?.data || undefined;

      // Handle GaxiosError specifically if it has a response
      if (err.response && err.response.data && err.response.data.error) {
        errorMessage = err.response.data.error.message || errorMessage;
      }

      return res.status(500).json({ 
        error: errorMessage,
        details: errorDetails,
        triedBuckets: (err as any).triedBuckets || [bucketName]
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

  // Gemini Proxy Route
  apiRouter.post('/gemini/proxy', async (req, res, next) => {
    const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key not configured on server' });

    const maskedKey = apiKey.length > 8 
      ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`
      : '********';
    console.log(`Gemini Proxy using key: ${maskedKey}`);

    try {
      const { method, params } = req.body;
      console.log(`Gemini Proxy: ${method}`, JSON.stringify(params).substring(0, 100) + '...');
      const ai = new GoogleGenAI({ apiKey });

      if (method === 'generateContent') {
        const response = await ai.models.generateContent(params);
        return res.json({ 
          success: true, 
          data: {
            ...response,
            text: response.text // Explicitly include the text property
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

  app.use('/studio/api', apiRouter);

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      base: '/studio/',
    });
    app.use('/studio', vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use('/studio', express.static(distPath));
    app.get('/studio/*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // Global Error Handler
  app.use((err: any, req: any, res: any, next: any) => {
    console.error('Global Error Handler:', err);
    res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Internal Server Error'
    });
  });
}

startServer();

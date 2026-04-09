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
import { GoogleAuth } from 'google-auth-library';
import firebaseConfig from './firebase-applet-config.json';
import upscaleRoutes from './backend/routes/upscale.ts';
import interpolateRoutes from './backend/routes/interpolate.ts';
import videoRoutes from './backend/routes/video.ts';

dotenv.config({ path: '.env.local' });
dotenv.config({ override: false });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SESSION_SECRET = process.env.SESSION_SECRET || 'default-secret';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const IS_PRODUCTION = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;
// Always use Vertex AI for all AI calls (local and production behave identically)
const USE_VERTEX_AI = true;

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

const VERTEX_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || 'gen-lang-client-0639313445';
console.log(`[Vertex] Active Project: ${VERTEX_PROJECT}`);
const vertexAuth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });

// Direct Vertex AI v1 REST — bypasses @google/genai SDK which is hardcoded to v1beta for video
async function vertexRest(url: string, method = 'GET', body?: any) {
  const token = await vertexAuth.getAccessToken();
  const res = await fetch(url, {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(text);
  return JSON.parse(text);
}

async function vertexGenerateVideos(params: any) {
  const { model, prompt, image, config = {} } = params;
  const instance: any = { prompt: prompt || 'Animate this' };
  if (image?.imageBytes) {
    instance.image = {
      bytesBase64Encoded: image.imageBytes,
      mimeType: image.mimeType || 'image/jpeg',
      ...(config.resizeMode && { resizeMode: config.resizeMode }),
    };
  }
  if (config.lastFrame?.imageBytes) instance.lastFrame = { bytesBase64Encoded: config.lastFrame.imageBytes, mimeType: config.lastFrame.mimeType || 'image/jpeg' };
  const parameters: any = {
    aspectRatio: config.aspectRatio || '16:9',
    sampleCount: Math.min(Math.max(config.sampleCount || 1, 1), 4),
    durationSeconds: config.duration || 8,
  };
  if (config.resolution) parameters.resolution = config.resolution;
  if (config.negativePrompt) parameters.negativePrompt = config.negativePrompt;
  if (config.seed !== undefined) parameters.seed = config.seed;
  if (config.personGeneration) parameters.personGeneration = config.personGeneration;
  if (config.audio !== undefined) parameters.enableNativeAudio = config.audio;
  console.log('[Veo] Sending parameters:', JSON.stringify(parameters));
  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/us-central1/publishers/google/models/${model}:predictLongRunning`;
  const op = await vertexRest(url, 'POST', { instances: [instance], parameters });
  // Return in SDK-compatible shape so geminiService.ts polling loop works unchanged
  return { name: op.name, done: false };
}

async function vertexGetOperation(operation: any) {
  const name = typeof operation === 'string' ? operation : operation?.name;
  // Operation name format: projects/.../publishers/google/models/{MODEL}/operations/{ID}
  // Must poll via fetchPredictOperation POST — plain GET on that path returns 404
  const modelMatch = name?.match(/publishers\/google\/models\/([^/]+)\/operations\//);
  const model = modelMatch?.[1];
  if (!model) throw new Error(`Cannot extract model from operation name: ${name}`);
  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/us-central1/publishers/google/models/${model}:fetchPredictOperation`;
  const op = await vertexRest(url, 'POST', { operationName: name });
  if (!op.done) return { name: op.name ?? name, done: false };
  // Log full operation to diagnose response structure
  console.log('[Veo] Operation done. Full op keys:', Object.keys(op));
  console.log('[Veo] Raw response:', JSON.stringify(op.response ?? op, null, 2));
  // Cover all known response shapes from Vertex AI video/audio generation
  const samples =
    op.response?.videos                                      // ← video v1 shape
    ?? op.response?.audioSamples                             // ← lyria shape
    ?? op.response?.predictions                              // legacy predict
    ?? op.response?.generateVideoResponse?.generatedSamples  // v1 nested alt
    ?? op.response?.generatedSamples                         // v1 flat alt
    ?? op.predictions
    ?? [];
  
  console.log('[Vertex LRO] Samples count:', samples.length);

  const results = await Promise.all(samples.map(async (s: any) => {
    // Video result
    const videoUri = s?.video?.uri ?? s?.gcsUri;
    if (videoUri) return { video: { uri: videoUri, mimeType: s?.video?.mimeType || 'video/mp4' } };

    // Audio/Lyria result
    const audioData = s?.bytesBase64Encoded || s?.audio?.bytesBase64Encoded;
    if (audioData) {
      let data = audioData;
      let mimeType = s?.mimeType || s?.audio?.mimeType || 'audio/wav';

      // Auto-convert L16 to WAV
      if (mimeType.includes('audio/l16') || model.includes('lyria')) {
        const buf = Buffer.from(data, 'base64');
        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
        const wavBuf = addWavHeader(buf, sampleRate);
        data = wavBuf.toString('base64');
        mimeType = 'audio/wav';
      }
      return { content: { parts: [{ inlineData: { data, mimeType } }] } };
    }
    return null;
  }));

  const filteredResults = results.filter(Boolean);
  return { name: op.name ?? name, done: true, response: { generatedVideos: filteredResults.filter((r: any) => r.video), candidates: filteredResults.filter((r: any) => r.content) } };
}

async function vertexFetchGCS(gcsUri: string) {
  // gs://bucket/path/file → GCS download API
  const withoutScheme = gcsUri.replace('gs://', '');
  const slashIdx = withoutScheme.indexOf('/');
  const bucket = withoutScheme.slice(0, slashIdx);
  const object = encodeURIComponent(withoutScheme.slice(slashIdx + 1));
  const token = await vertexAuth.getAccessToken();
  const res = await fetch(`https://storage.googleapis.com/download/storage/v1/b/${bucket}/o/${object}?alt=media`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GCS fetch failed: ${res.status}`);
  const buf = await res.arrayBuffer();
  return { base64: Buffer.from(buf).toString('base64'), contentType: res.headers.get('content-type') || 'video/mp4' };
}

// Lazy Vertex AI clients — global for Gemini/preview models, us-central1 for Veo/Imagen
const vertexClients: Record<string, GoogleGenAI> = {};
function getVertexClient(model = ''): GoogleGenAI {
  // Veo, Imagen, Lyra/TTS/Audio require us-central1 (high-compute TPU hardware)
  const needsUsCentral = /^(veo-|imagen-)/.test(model) || model.includes('tts') || model.includes('lyra') || model.includes('audio');
  const location = needsUsCentral ? 'us-central1' : 'global';
  if (!vertexClients[location]) {
    vertexClients[location] = new GoogleGenAI({ vertexai: true, project: VERTEX_PROJECT, location });
  }
  return vertexClients[location];
}

// Vertex AI only accepts role 'user'|'model' — normalize roles and extract system prompts
function sanitizeForVertex(params: any): any {
  if (!params.contents) return params;
  // Normalize string shorthand to a proper Content array
  if (typeof params.contents === 'string') {
    return { ...params, contents: [{ role: 'user', parts: [{ text: params.contents }] }] };
  }
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

// Helper to add WAV header to raw L16 PCM data
function addWavHeader(pcmData: Buffer, sampleRate = 24000, numChannels = 1): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmData.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * 2, 28);
  header.writeUInt16LE(numChannels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmData.length, 40);
  return Buffer.concat([header, pcmData]);
}

// Upload all inlineData parts to Firebase Storage, return storageUrl in place of base64
async function uploadInlineData(parts: any[], projectId: string): Promise<any[]> {
  return Promise.all(parts.map(async (part: any, i: number) => {
    if (!part.inlineData?.data) return part;
    let { data, mimeType } = part.inlineData;
    let buf = Buffer.from(data, 'base64') as any;
    let ext = mimeType?.split('/')[1]?.split(';')[0] || 'bin';

    // Fix for Lyria/TTS outputting raw L16
    if (mimeType?.includes('audio/l16')) {
      const rateMatch = mimeType.match(/rate=(\d+)/);
      const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
      buf = addWavHeader(buf, sampleRate);
      mimeType = 'audio/wav';
      ext = 'wav';
    }

    const bucket = await getWorkingBucket();
    const dest = `projects/${projectId}/assets/${Date.now()}-${i}-generated.${ext}`;
    await bucket.file(dest).save(buf, { metadata: { contentType: mimeType }, public: true });
    const storageUrl = `https://storage.googleapis.com/${bucket.name}/${dest}`;
    console.log(`[Upload] ${Math.round(buf.byteLength / 1024)}KB → ${storageUrl}`);
    return { ...part, inlineData: { storageUrl, mimeType } };
  }));
}

async function vertexPredict(params: any) {
  const { model, contents, config = {} } = params;
  const parts = Array.isArray(contents) ? contents[0]?.parts : contents?.parts;
  if (!parts) throw new Error('No parts found in contents');

  const instance: any = {};
  const reference_images: any[] = [];
  
  for (const part of parts) {
    if (part.text) instance.prompt = part.text;
    if (part.inlineData) {
      reference_images.push({
        bytesBase64Encoded: part.inlineData.data,
        mimeType: part.inlineData.mimeType
      });
    }
  }

  // Lyria specific: reference_images must be in instances
  if (reference_images.length > 0) {
    instance.reference_images = reference_images;
  }

  // Lyria specific parameters must be in instances, NOT in parameters
  if (config.negative_prompt) instance.negative_prompt = config.negative_prompt;
  if (config.seed !== undefined) instance.seed = config.seed;
  if (config.duration) instance.duration = config.duration;

  const parameters: any = {
    sampleCount: config.sampleCount || 1,
    candidateCount: config.sampleCount || 1,
    temperature: config.temperature,
    topP: config.topP,
    topK: config.topK,
  };

  const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/us-central1/publishers/google/models/${model}:predict`;
  const response = await vertexRest(url, 'POST', { instances: [instance], parameters });
  
  // Transform prediction response back to SDK-like response for the frontend
  const predictions = response.predictions || [];
  const candidates = predictions.map((p: any) => {
    const part: any = {};
    // Lyria output can be bytesBase64Encoded or in a nested audio object
    const audioData = p.bytesBase64Encoded || p.audio?.bytesBase64Encoded;
    if (audioData) {
      let data = audioData;
      let mimeType = p.mimeType || p.audio?.mimeType || 'audio/wav';

      // Auto-convert L16 to WAV if detected
      if (mimeType.includes('audio/l16') || model.includes('lyria')) {
        const buf = Buffer.from(data, 'base64');
        const rateMatch = mimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
        const wavBuf = addWavHeader(buf, sampleRate);
        data = wavBuf.toString('base64');
        mimeType = 'audio/wav';
      }

      part.inlineData = { data, mimeType };
    } else if (p.text) {
      part.text = p.text;
    }
    return { content: { parts: [part] } };
  });

  return { candidates };
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
    if (!USE_VERTEX_AI && !apiKey) return res.status(500).json({ error: 'API key not configured' });

    try {
      const { method } = req.body;
      let params = req.body.params;

      const devAi = !USE_VERTEX_AI ? new GoogleGenAI({ apiKey: apiKey! }) : null;
      const ai = (model: string) => USE_VERTEX_AI ? getVertexClient(model) : devAi!;

      if (method === 'generateContent') {
        if (params?.contents) params = { ...params, contents: await resolveImageUrls(params.contents) };
        if (USE_VERTEX_AI) params = sanitizeForVertex(params);
        const { projectId, ...sdkParams } = params;

        let response;
        if (USE_VERTEX_AI && sdkParams.model?.includes('lyria')) {
          if (sdkParams.model.includes('pro')) {
            // Lyria Pro requires Long-Running Prediction
            const { model, contents, config = {} } = sdkParams;
            const parts = Array.isArray(contents) ? contents[0]?.parts : contents?.parts;
            const instance: any = { prompt: parts.find((p: any) => p.text)?.text };
            const refs = parts.filter((p: any) => p.inlineData).map((p: any) => ({
              bytesBase64Encoded: p.inlineData.data,
              mimeType: p.inlineData.mimeType
            }));
            if (refs.length > 0) instance.reference_images = refs;
            if (config.negative_prompt) instance.negative_prompt = config.negative_prompt;
            if (config.seed !== undefined) instance.seed = config.seed;
            if (config.duration) instance.duration = config.duration;

            const url = `https://us-central1-aiplatform.googleapis.com/v1/projects/${VERTEX_PROJECT}/locations/us-central1/publishers/google/models/${model}:predictLongRunning`;
            const op = await vertexRest(url, 'POST', { instances: [instance], parameters: { sampleCount: 1 } });
            return res.json({ success: true, data: { operation: op.name, isLro: true } });
          } else {
            response = await vertexPredict(sdkParams);
          }
        } else {
          response = await ai(sdkParams.model).models.generateContent(sdkParams);
        }

        const candidates = (response as any).candidates ?? [];
        // Upload inlineData (images, audio) to Storage server-side — avoids base64 round-trip through browser
        if (projectId && adminApp) {
          for (const c of candidates) {
            if (c?.content?.parts) c.content.parts = await uploadInlineData(c.content.parts, projectId);
          }
        }
        const text = candidates.flatMap((c: any) => (c?.content?.parts ?? []).filter((p: any) => p.text).map((p: any) => p.text)).join('');
        const promptBlock = (response as any).promptFeedback?.blockReason;
        const hasImage = candidates.some((c: any) => c?.content?.parts?.some((p: any) => p.inlineData));
        if (promptBlock && !hasImage) return res.status(422).json({ success: false, error: `Prompt blocked: ${promptBlock}` });
        return res.json({ success: true, data: { candidates, text, promptFeedback: (response as any).promptFeedback || {} } });
      }

      if (method === 'generateImages') {
        const { projectId, ...sdkParams } = params;
        const genData = await ai(sdkParams.model).models.generateImages(sdkParams);
        if (projectId && adminApp) {
          for (const img of (genData.generatedImages ?? [])) {
            if (img.image?.imageBytes) {
              try {
                const bucket = await getWorkingBucket();
                const buf = Buffer.from(img.image.imageBytes, 'base64');
                const dest = `projects/${projectId}/assets/${Date.now()}-generated.png`;
                await bucket.file(dest).save(buf, { metadata: { contentType: 'image/png' }, public: true });
                (img.image as any).storageUrl = `https://storage.googleapis.com/${bucket.name}/${dest}`;
                console.log(`[Upload] Imagen ${Math.round(buf.byteLength / 1024)}KB → ${(img.image as any).storageUrl}`);
                delete img.image.imageBytes;
              } catch (e) {
                console.error('Storage upload failed:', e);
              }
            }
          }
        }
        return res.json({ success: true, data: genData });
      }

      // Video: @google/genai SDK hardcodes v1beta which doesn't have Veo 3.1 GA — use v1 REST directly
      if (method === 'generateVideos') {
        if (USE_VERTEX_AI) return res.json({ success: true, data: await vertexGenerateVideos(params) });
        return res.json({ success: true, data: await devAi!.models.generateVideos(params) });
      }
      if (method === 'getOperation') {
        if (USE_VERTEX_AI) return res.json({ success: true, data: await vertexGetOperation(params.operation ?? params) });
        return res.json({ success: true, data: await devAi!.operations.getVideosOperation(params) });
      }

      if (method === 'fetchVideoFile') {
        const { url, projectId } = params;

        // Step 1: resolve URL → base64
        let base64: string;
        let contentType: string;

        if (url?.startsWith('data:')) {
          const [header, b64] = url.split(',');
          contentType = header.split(':')[1]?.split(';')[0] || 'video/mp4';
          base64 = b64;
        } else if (USE_VERTEX_AI && url?.startsWith('gs://')) {
          ({ base64, contentType } = await vertexFetchGCS(url));
        } else {
          const headers: Record<string, string> = {};
          if (apiKey) headers['x-goog-api-key'] = apiKey;
          const r = await fetch(url, { headers });
          base64 = Buffer.from(await r.arrayBuffer()).toString('base64');
          contentType = r.headers.get('content-type') || 'video/mp4';
        }

        // Step 2: if projectId provided, upload directly to Firebase Storage — skip the browser round-trip
        if (projectId && adminApp) {
          try {
            const bucket = await getWorkingBucket();
            const buf = Buffer.from(base64, 'base64');
            const dest = `projects/${projectId}/assets/${Date.now()}-generated-video.mp4`;
            await bucket.file(dest).save(buf, { metadata: { contentType }, public: true });
            const storageUrl = `https://storage.googleapis.com/${bucket.name}/${dest}`;
            console.log(`[Veo] Uploaded to Storage: ${storageUrl}`);
            return res.json({ success: true, data: { storageUrl } });
          } catch (uploadErr: any) {
            console.error('[Veo] Storage upload failed, falling back to base64:', uploadErr.message);
          }
        }

        return res.json({ success: true, data: { base64, contentType } });
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

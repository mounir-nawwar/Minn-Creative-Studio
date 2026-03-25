import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import upscaleRoutes from './backend/routes/upscale.ts';
import interpolateRoutes from './backend/routes/interpolate.ts';
import videoRoutes from './backend/routes/video.ts';

dotenv.config();

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

  // Auth endpoints
  app.post('/api/login', (req, res) => {
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

  app.post('/api/logout', (req, res) => {
    res.clearCookie('session', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    res.json({ success: true });
  });

  app.get('/api/me', (req, res) => {
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
  app.use('/api/upscale', upscaleRoutes);
  app.use('/api/interpolate', interpolateRoutes);
  app.use('/api/video', videoRoutes);

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Gemini Proxy Route
  app.post('/api/gemini/proxy', async (req, res, next) => {
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

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode...`);
  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
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

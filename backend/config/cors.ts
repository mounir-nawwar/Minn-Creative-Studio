import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { AUTH_CONFIG } from './auth.ts';

const IS_PRODUCTION = AUTH_CONFIG.isProduction;

export const allowedOrigins = IS_PRODUCTION
  ? ['https://studio.minnagency.com', 'http://150.230.52.15:3000', 'https://150.230.52.15:3000']
  : ['http://localhost:5173', 'http://localhost:3000'];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Same-origin requests (served from the same Express app) and tools like curl
    // send no Origin header — always allow those.
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    console.warn(`[CORS] Blocked origin: ${origin}`);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
});

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please slow down' },
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many AI requests, please wait a moment' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => !IS_PRODUCTION,
});

import express from 'express';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import { AUTH_CONFIG } from '../config/auth.ts';
import { loginLimiter } from '../config/cors.ts';
import { validateBody, loginSchema } from '../middleware/validation.ts';

const router = express.Router();

router.post('/login', loginLimiter, validateBody(loginSchema), (req, res) => {
  const { username, password } = req.body;

  const usernameMatch = username && AUTH_CONFIG.adminUsername &&
    username.length === AUTH_CONFIG.adminUsername.length &&
    timingSafeEqual(Buffer.from(username), Buffer.from(AUTH_CONFIG.adminUsername));
  const passwordMatch = password && AUTH_CONFIG.adminPassword &&
    password.length === AUTH_CONFIG.adminPassword.length &&
    timingSafeEqual(Buffer.from(password), Buffer.from(AUTH_CONFIG.adminPassword));

  if (usernameMatch && passwordMatch) {
    const token = jwt.sign({ username }, AUTH_CONFIG.sessionSecret, { expiresIn: '30d' });
    res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'none', maxAge: AUTH_CONFIG.cookieMaxAge });
    return res.json({ success: true });
  }
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('session', { httpOnly: true, secure: true, sameSite: 'none' });
  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const token = req.cookies.session;
  if (!token) return res.status(401).json({ authenticated: false });
  try {
    res.json({ authenticated: true, user: jwt.verify(token, AUTH_CONFIG.sessionSecret) });
  } catch {
    res.status(401).json({ authenticated: false });
  }
});

export default router;

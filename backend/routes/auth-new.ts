/**
 * Authentication Routes
 * Handles login, logout, and session management
 */

import express from 'express';
import { login, verifyToken, refreshToken } from '../services/auth.ts';

const router = express.Router();

/**
 * POST /api/auth/login
 * Login with username/email and password
 */
router.post('/login', async (req: any, res: any) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const result = await login({ username, password });

    if (!result) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      success: true,
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      user: result.user
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * POST /api/auth/logout
 * Logout (client should delete tokens)
 */
router.post('/logout', (req: any, res: any) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', (req: any, res: any) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const result = refreshToken(token);

    if (!result) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    res.json({
      success: true,
      accessToken: result.accessToken
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user
 */
router.get('/me', (req: any, res: any) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required', authenticated: false });
    }

    const token = authHeader.substring(7);
    const user = verifyToken(token);

    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired session', authenticated: false });
    }

    res.json({
      authenticated: true,
      user
    });
  } catch (error: any) {
    console.error('Auth check error:', error);
    res.status(500).json({ error: 'Authentication check failed', authenticated: false });
  }
});

export default router;

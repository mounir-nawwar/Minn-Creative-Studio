import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AUTH_CONFIG } from '../config/auth.ts';

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Auth middleware that supports both:
 * 1. JWT Bearer token in Authorization header (new auth)
 * 2. Session cookie (legacy auth for backwards compatibility)
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  // Try JWT Bearer token first
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as any;
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        email: decoded.email
      };
      next();
      return;
    } catch (err) {
      // Token invalid, fall through to cookie auth
    }
  }

  // Try session cookie (legacy)
  if (!AUTH_CONFIG.isProduction) {
    // In development, allow through
    next();
    return;
  }

  const sessionToken = req.cookies?.session;
  if (sessionToken) {
    try {
      jwt.verify(sessionToken, AUTH_CONFIG.sessionSecret);
      next();
      return;
    } catch {
      // Invalid session
    }
  }

  // No valid auth found
  res.status(401).json({ error: 'Authentication required' });
};

/**
 * Optional auth - populates req.user if token present but doesn't require it
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, JWT_SECRET!) as any;
      req.user = {
        id: decoded.userId,
        username: decoded.username,
        email: decoded.email
      };
    } catch {
      // Invalid token, continue without user
    }
  }
  next();
};

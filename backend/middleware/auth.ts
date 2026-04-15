import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AUTH_CONFIG } from '../config/auth.ts';

const IS_PRODUCTION = AUTH_CONFIG.isProduction;

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  if (!IS_PRODUCTION) {
    console.warn('[Auth] Skipping authentication in development mode');
    return next();
  }
  
  const token = req.cookies?.session;
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  
  try {
    jwt.verify(token, AUTH_CONFIG.sessionSecret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
};

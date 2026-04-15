import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AUTH_CONFIG } from '../config/auth.ts';

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
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

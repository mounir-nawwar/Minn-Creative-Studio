/**
 * JWT Authentication Service for Minn Creative Studio
 * Replaces Firebase Auth with simple username/password authentication
 * Supports exactly two hardcoded users: mounir.nawwar and rana.tadmori
 * 
 * SECURITY FEATURES:
 * - Async password hashing (non-blocking)
 * - Separate secrets for access/refresh tokens
 * - Token type validation
 * - Constant-time password comparison
 * - Timing-safe user enumeration prevention
 */

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { users, verifyPassword, generateId } from './database.ts';

// Security: Require JWT secrets in production
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (JWT_SECRET ? JWT_SECRET + '-refresh' : undefined);

if (!JWT_SECRET) {
  console.error('❌ FATAL: JWT_SECRET environment variable is required');
  console.error('   Set it in your .env file with a secure random string (32+ characters)');
  process.exit(1);
}

const JWT_EXPIRES_IN = '1h'; // 1 hour for access token (short-lived)
const JWT_REFRESH_EXPIRES_IN = '30d'; // 30 days for refresh token

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  photoUrl?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// Dummy hash for timing-safe user enumeration prevention
const DUMMY_HASH = '$dummy$' + crypto.randomBytes(32).toString('hex');

/**
 * Async password hashing (non-blocking)
 */
async function hashPasswordAsync(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      else resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

/**
 * Async password verification (non-blocking)
 */
async function verifyPasswordAsync(password: string, storedHash: string): Promise<boolean> {
  // Handle dummy hash for timing attack prevention
  if (storedHash.startsWith('$dummy$')) {
    // Still perform the hash to maintain timing
    await new Promise<void>((resolve) => {
      crypto.pbkdf2(password, 'dummy', 100000, 64, 'sha512', () => resolve());
    });
    return false;
  }
  
  const [salt, hash] = storedHash.split(':');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(password, salt, 100000, 64, 'sha512', (err, derivedKey) => {
      if (err) reject(err);
      else {
        // Constant-time comparison
        const expectedHash = Buffer.from(hash, 'hex');
        const actualHash = derivedKey;
        resolve(crypto.timingSafeEqual(expectedHash, actualHash));
      }
    });
  });
}

// Initialize the two authorized users
async function initializeUsers(): Promise<void> {
  // Check if users already exist
  const existingUsers = users.getAll();
  
  // Get passwords from environment
  const mounirPassword = process.env.USER_MOUNIR_PASSWORD;
  const ranaPassword = process.env.USER_RANA_PASSWORD;
  
  // Require passwords in production
  if (!mounirPassword || !ranaPassword) {
    console.error('❌ FATAL: User passwords not configured');
    console.error('   Set USER_MOUNIR_PASSWORD and USER_RANA_PASSWORD in .env');
    process.exit(1);
  }
  
  // Check if we need to create or update users
  const mounirExists = existingUsers.find(u => u.username === 'mounir.nawwar');
  const ranaExists = existingUsers.find(u => u.username === 'rana.tadmori');
  
  if (!mounirExists) {
    const hashedPassword = await hashPasswordAsync(mounirPassword);
    users.create(
      generateId(),
      'mounir.nawwar',
      'nawwarmounir@gmail.com',
      mounirPassword, // Will be hashed by users.create
      'Mounir Nawwar'
    );
    console.log('✅ Created user: mounir.nawwar');
  }
  
  if (!ranaExists) {
    const hashedPassword = await hashPasswordAsync(ranaPassword);
    users.create(
      generateId(),
      'rana.tadmori',
      'rstadmori@gmail.com',
      ranaPassword,
      'Rana Tadmori'
    );
    console.log('✅ Created user: rana.tadmori');
  }
  
  if (mounirExists && ranaExists) {
    console.log('✅ Users already initialized');
  }
}

/**
 * Login with username and password
 */
export async function login(credentials: LoginCredentials): Promise<AuthTokens | null> {
  const { username, password } = credentials;

  // Find user by username or email
  let user = users.findByUsername(username);
  if (!user) {
    user = users.findByEmail(username);
  }

  // Timing-safe: always perform password verification even if user not found
  const hashToVerify = user ? user.password_hash : DUMMY_HASH;
  const passwordValid = await verifyPasswordAsync(password, hashToVerify);
  
  if (!user || !passwordValid) {
    // Use generic error message to prevent user enumeration
    console.log(`❌ Login failed for: ${username}`);
    return null;
  }

  // Update last login
  users.updateLastLogin(user.id);

  // Generate tokens with different secrets
  const payload = {
    userId: user.id,
    username: user.username,
    email: user.email
  };

  const accessToken = jwt.sign(payload, JWT_SECRET!, { 
    expiresIn: JWT_EXPIRES_IN,
    subject: 'access'
  });
  
  const refreshToken = jwt.sign(
    { ...payload, type: 'refresh' }, 
    JWT_REFRESH_SECRET!, 
    { expiresIn: JWT_REFRESH_EXPIRES_IN, subject: 'refresh' }
  );

  console.log(`✅ User logged in: ${user.username}`);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      photoUrl: user.photo_url
    }
  };
}

/**
 * Verify JWT token and return user
 * SECURITY: Rejects refresh tokens when used as access tokens
 */
export function verifyToken(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET!, { subject: 'access' }) as any;
    
    // Security: Ensure this is NOT a refresh token
    if (decoded.type === 'refresh') {
      console.warn('⚠️  Attempted to use refresh token as access token');
      return null;
    }
    
    // Get fresh user data from database
    const user = users.findById(decoded.userId);
    if (!user) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.display_name,
      photoUrl: user.photo_url
    };
  } catch (error) {
    return null;
  }
}

/**
 * Refresh access token using refresh token
 */
export function refreshToken(refreshToken: string): { accessToken: string } | null {
  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET!, { subject: 'refresh' }) as any;
    
    // Security: Ensure this IS a refresh token
    if (decoded.type !== 'refresh') {
      return null;
    }

    const user = users.findById(decoded.userId);
    if (!user) {
      return null;
    }

    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email
    };

    const accessToken = jwt.sign(payload, JWT_SECRET!, { 
      expiresIn: JWT_EXPIRES_IN,
      subject: 'access'
    });

    return { accessToken };
  } catch (error) {
    return null;
  }
}

/**
 * Logout (invalidate token on client side)
 * With JWT, we don't need server-side logout unless we implement a blacklist
 */
export function logout(): void {
  // Client should delete the token
  console.log('✅ User logged out');
}

/**
 * Get user by ID
 */
export function getUserById(userId: string): AuthUser | null {
  const user = users.findById(userId);
  if (!user) return null;

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.display_name,
    photoUrl: user.photo_url
  };
}

/**
 * Check if user is authorized (email whitelist)
 */
export function isAuthorizedUser(email: string): boolean {
  const authorizedEmails = [
    'nawwarmounir@gmail.com',
    'rstadmori@gmail.com'
  ];
  return authorizedEmails.includes(email.toLowerCase());
}

/**
 * Express middleware to protect routes
 */
export function authMiddleware(req: any, res: any, next: any): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.substring(7);
  const user = verifyToken(token);

  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }

  req.user = user;
  next();
}

/**
 * Optional auth middleware - populates user if token present but doesn't require it
 */
export function optionalAuthMiddleware(req: any, res: any, next: any): void {
  const authHeader = req.headers.authorization;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const user = verifyToken(token);
    if (user) {
      req.user = user;
    }
  }
  
  next();
}

// Initialize users asynchronously on startup
initializeUsers().catch(err => {
  console.error('Failed to initialize users:', err);
  process.exit(1);
});

export default {
  login,
  verifyToken,
  refreshToken,
  logout,
  getUserById,
  isAuthorizedUser,
  authMiddleware,
  optionalAuthMiddleware
};

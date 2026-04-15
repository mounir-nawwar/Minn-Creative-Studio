import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    if (process.env.NODE_ENV === 'production' || process.env.K_SERVICE) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    console.warn(`⚠️  ${name} not set, using development default`);
  }
  return value || '';
}

function parseAuthorizedEmails(): Set<string> {
  const envValue = process.env.AUTHORIZED_EMAILS || '';
  if (!envValue) return new Set();
  
  return new Set(
    envValue
      .split(',')
      .map(email => email.trim().toLowerCase())
      .filter(email => email.length > 0 && email.includes('@'))
  );
}

export const AUTH_CONFIG = {
  sessionSecret: requireEnv('SESSION_SECRET') || 'dev-secret-change-in-production',
  adminUsername: requireEnv('ADMIN_USERNAME') || 'admin',
  adminPassword: requireEnv('ADMIN_PASSWORD') || 'admin',
  authorizedEmails: parseAuthorizedEmails(),
  jwtExpiresIn: '30d',
  cookieMaxAge: 30 * 24 * 60 * 60 * 1000,
  isProduction: process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE
};

export function isAuthorizedEmail(email: string): boolean {
  if (!email) return false;
  return AUTH_CONFIG.authorizedEmails.has(email.toLowerCase());
}

export function getAuthorizedEmailsList(): string[] {
  return Array.from(AUTH_CONFIG.authorizedEmails);
}

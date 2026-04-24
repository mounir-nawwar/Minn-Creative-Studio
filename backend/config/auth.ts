import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const isProduction = process.env.NODE_ENV === 'production' || !!process.env.K_SERVICE;

function requireEnv(name: string, devDefault?: string): string {
  const value = process.env[name];
  if (!value) {
    if (isProduction) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    if (devDefault) {
      console.warn(`⚠️  ${name} not set, using development default`);
      return devDefault;
    }
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function requireSecureEnv(name: string): string {
  if (isProduction) {
    return requireEnv(name);
  }
  const value = process.env[name];
  if (!value) {
    console.warn(`⚠️  ${name} not set, using development default (NOT SECURE)`);
    return `dev-${name.toLowerCase()}-change-in-production`;
  }
  return value;
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
  sessionSecret: requireSecureEnv('SESSION_SECRET'),
  adminUsername: requireSecureEnv('ADMIN_USERNAME'),
  adminPassword: requireSecureEnv('ADMIN_PASSWORD'),
  authorizedEmails: parseAuthorizedEmails(),
  jwtExpiresIn: '30d',
  cookieMaxAge: 30 * 24 * 60 * 60 * 1000,
  isProduction
};

export function isAuthorizedEmail(email: string): boolean {
  if (!email) return false;
  return AUTH_CONFIG.authorizedEmails.has(email.toLowerCase());
}

export function getAuthorizedEmailsList(): string[] {
  return Array.from(AUTH_CONFIG.authorizedEmails);
}

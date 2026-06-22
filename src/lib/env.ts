type EnvValue = string | undefined;
type EnvSchema = Record<string, {
  required: boolean;
  defaultValue?: string;
  validate?: (value: EnvValue) => boolean;
  description?: string;
}>;

interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  env: Record<string, string>;
}

const envSchema: EnvSchema = {
  API_KEY: {
    required: false,
    description: 'API key for backend services',
  },
  ADMIN_USERNAME: {
    required: false,
    defaultValue: 'admin',
    description: 'Admin username for authentication',
  },
  ADMIN_PASSWORD: {
    required: false,
    description: 'Admin password (should be changed in production)',
  },
  SESSION_SECRET: {
    required: true,
    description: 'Secret key for session management',
    validate: (value) => !!(value && value.length >= 32),
  },
  GOOGLE_CLOUD_PROJECT: {
    required: false,
    description: 'Google Cloud project ID used for Vertex AI',
  },
};

function getEnvValue(key: string, defaultValue?: string): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] || defaultValue || '';
  }
  return defaultValue || '';
}

export function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const env: Record<string, string> = {};

  for (const [key, config] of Object.entries(envSchema)) {
    const value = getEnvValue(key, config.defaultValue);
    env[key] = value;

    if (config.required && !value) {
      errors.push(`Missing required environment variable: ${key}${config.description ? ` (${config.description})` : ''}`);
      continue;
    }

    if (value && config.validate && !config.validate(value)) {
      errors.push(`Invalid value for environment variable: ${key}`);
    }

    if (!config.required && !value) {
      warnings.push(`Optional environment variable not set: ${key}${config.description ? ` (${config.description})` : ''}`);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    if (env.ADMIN_PASSWORD === 'change-me' || env.ADMIN_PASSWORD === 'admin') {
      warnings.push('ADMIN_PASSWORD should be changed from default value in production');
    }
    if (env.SESSION_SECRET && env.SESSION_SECRET.length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters in production');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    env,
  };
}

let validationCache: EnvValidationResult | null = null;

export function getValidatedEnv(): EnvValidationResult {
  if (!validationCache) {
    validationCache = validateEnv();
    if (!validationCache.valid) {
      console.error('[Environment] Validation failed:', validationCache.errors);
    }
    if (validationCache.warnings.length > 0) {
      console.warn('[Environment] Warnings:', validationCache.warnings);
    }
  }
  return validationCache;
}

export function requireEnv(key: string): string {
  const { env, valid } = getValidatedEnv();
  if (!valid) {
    throw new Error(`Environment validation failed. Check console for details.`);
  }
  const value = env[key];
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

export function getEnv(key: string, fallback?: string): string {
  const { env } = getValidatedEnv();
  return env[key] || fallback || '';
}

export function isEnvValid(): boolean {
  return getValidatedEnv().valid;
}

export function getEnvErrors(): string[] {
  return getValidatedEnv().errors;
}

export function getEnvWarnings(): string[] {
  return getValidatedEnv().warnings;
}

export function initEnvValidation(): void {
  const result = getValidatedEnv();
  
  if (process.env.NODE_ENV === 'development') {
    console.log('[Environment] Validation result:', {
      valid: result.valid,
      errors: result.errors.length,
      warnings: result.warnings.length,
    });
  }
}

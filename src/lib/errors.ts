export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ErrorCategory = 
  | 'api'
  | 'validation'
  | 'network'
  | 'storage'
  | 'auth'
  | 'generation'
  | 'upload'
  | 'unknown';

export interface AppErrorOptions {
  message: string;
  code?: string;
  severity?: ErrorSeverity;
  category?: ErrorCategory;
  cause?: Error;
  context?: Record<string, unknown>;
  recoverable?: boolean;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly category: ErrorCategory;
  public readonly context: Record<string, unknown>;
  public readonly recoverable: boolean;
  public readonly timestamp: Date;
  public readonly cause?: Error;

  constructor(options: AppErrorOptions) {
    super(options.message);
    this.name = 'AppError';
    this.code = options.code || 'UNKNOWN_ERROR';
    this.severity = options.severity || 'medium';
    this.category = options.category || 'unknown';
    this.context = options.context || {};
    this.recoverable = options.recoverable ?? true;
    this.timestamp = new Date();
    this.cause = options.cause;

    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      category: this.category,
      context: this.context,
      recoverable: this.recoverable,
      timestamp: this.timestamp.toISOString(),
      cause: this.cause?.message,
    };
  }
}

export function createError(
  category: ErrorCategory,
  message: string,
  options?: Partial<AppErrorOptions>
): AppError {
  return new AppError({
    message,
    category,
    ...options,
  });
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function getErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred';
}

export function getErrorCode(error: unknown): string {
  if (isAppError(error)) {
    return error.code;
  }
  return 'UNKNOWN_ERROR';
}

export function isErrorRecoverable(error: unknown): boolean {
  if (isAppError(error)) {
    return error.recoverable;
  }
  return true;
}

export function logError(error: unknown, context?: string): void {
  const appError = isAppError(error) 
    ? error 
    : createError('unknown', getErrorMessage(error), { cause: error instanceof Error ? error : undefined });

  const logData = {
    ...appError.toJSON(),
    context,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  };

  if (process.env.NODE_ENV === 'development') {
    console.error('[AppError]', logData);
  } else {
    console.error(`[${appError.severity.toUpperCase()}] ${appError.category}: ${appError.message}`);
  }

  // In production, send to error tracking service
  // if (process.env.NODE_ENV === 'production') {
  //   Sentry.captureException(appError, { extra: logData });
  // }
}

export function handleApiError(error: unknown, endpoint?: string): AppError {
  if (isAppError(error)) return error;

  const message = getErrorMessage(error);
  
  if (error instanceof TypeError && message.includes('fetch')) {
    return createError('network', 'Network request failed. Please check your connection.', {
      code: 'NETWORK_ERROR',
      severity: 'medium',
      context: { endpoint },
      cause: error instanceof Error ? error : undefined,
    });
  }

  return createError('api', message, {
    code: 'API_ERROR',
    context: { endpoint },
    cause: error instanceof Error ? error : undefined,
  });
}

export function handleGenerationError(error: unknown, model?: string): AppError {
  const message = getErrorMessage(error);
  
  if (message.includes('quota') || message.includes('rate limit')) {
    return createError('generation', 'API quota exceeded. Please try again later.', {
      code: 'QUOTA_EXCEEDED',
      severity: 'high',
      recoverable: true,
      context: { model },
      cause: error instanceof Error ? error : undefined,
    });
  }

  if (message.includes('invalid') || message.includes('parameter')) {
    return createError('validation', 'Invalid parameters provided for generation.', {
      code: 'INVALID_PARAMETERS',
      severity: 'medium',
      context: { model },
      cause: error instanceof Error ? error : undefined,
    });
  }

  return createError('generation', `Generation failed: ${message}`, {
    code: 'GENERATION_FAILED',
    context: { model },
    cause: error instanceof Error ? error : undefined,
  });
}

export function handleUploadError(error: unknown, fileName?: string): AppError {
  const message = getErrorMessage(error);

  if (message.includes('size') || message.includes('large')) {
    return createError('upload', 'File size exceeds the maximum allowed limit.', {
      code: 'FILE_TOO_LARGE',
      severity: 'medium',
      recoverable: false,
      context: { fileName },
    });
  }

  if (message.includes('type') || message.includes('format')) {
    return createError('upload', 'File type is not supported.', {
      code: 'UNSUPPORTED_FILE_TYPE',
      severity: 'medium',
      recoverable: false,
      context: { fileName },
    });
  }

  return createError('upload', `Upload failed: ${message}`, {
    code: 'UPLOAD_FAILED',
    context: { fileName },
    cause: error instanceof Error ? error : undefined,
  });
}

export function withErrorHandling<T>(
  fn: () => T,
  category: ErrorCategory,
  fallbackValue: T
): T {
  try {
    return fn();
  } catch (error) {
    logError(error);
    const appError = isAppError(error) 
      ? error 
      : createError(category, getErrorMessage(error));
    console.warn(`[${appError.code}] Using fallback value due to error: ${appError.message}`);
    return fallbackValue;
  }
}

export async function withAsyncErrorHandling<T>(
  fn: () => Promise<T>,
  category: ErrorCategory,
  fallbackValue: T
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logError(error);
    const appError = isAppError(error) 
      ? error 
      : createError(category, getErrorMessage(error));
    console.warn(`[${appError.code}] Using fallback value due to error: ${appError.message}`);
    return fallbackValue;
  }
}

import { API_BASE } from "../../constants";
import { authHeader } from "../../lib/api";

export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;
export const TIMEOUT_ERROR_MESSAGE = "Request timed out. Please try again with a shorter duration or simpler prompt.";

export interface BackendError extends Error {
  status?: number;
  isClientError?: boolean;
  /** Present on 429s — how long the server says to wait. */
  retryAfterSeconds?: number;
  /** Undefined means the request never got an answer (network failure). */
  retryable?: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Which failures are worth sending again.
 *
 * Status codes only. This used to substring-match the error text, which meant
 * Google's two spellings of the same rate limit behaved differently: "Resource
 * has been exhausted (e.g. check quota)" contained "quota" and stopped, while
 * "Resource exhausted. Please try again later" did not and was retried three
 * times — into a bucket of 2 requests per minute, guaranteeing failure and
 * starving the next real request.
 *
 * 429 is never retried here: the server already waited for a slot on our behalf
 * (see backend/services/quotaGate.ts), so if it still says no, the wait is
 * longer than a retry loop should hide from the user.
 */
function isRetryableStatus(status: number): boolean {
  if (status === 429) return false;             // rate limited — respect it
  return status >= 500 && status < 600;         // transient server-side only
}

export async function callBackend(method: string, params: any, signal?: AbortSignal, retryCount = 0): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}/gemini/proxy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ method, params }),
      signal
    });

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok || !data.success) {
        const error = new Error(data.error || 'Backend proxy call failed') as BackendError;
        error.status = response.status;
        error.isClientError = response.status >= 400 && response.status < 500;
        if (typeof data.retryAfterSeconds === 'number') error.retryAfterSeconds = data.retryAfterSeconds;
        // The server answered, so its status is the whole story. A 2xx that
        // reports success:false is a considered refusal — sending it again
        // will get the same refusal.
        error.retryable = response.ok ? false : isRetryableStatus(response.status);
        throw error;
      }
      return data.data;
    } else {
      const text = await response.text();
      console.error('Non-JSON response from backend:', text.substring(0, 500));
      const error = new Error(`Server returned non-JSON response (${response.status}). Check console for details.`) as BackendError;
      error.status = response.status;
      error.isClientError = response.status >= 400 && response.status < 500;
      error.retryable = false; // a misconfigured response, not a transient fault
      throw error;
    }
  } catch (err: unknown) {
    const backendError = err as BackendError;
    const isTimeout = err instanceof Error && (
      err.name === 'AbortError' ||
      err.message.includes('abort') ||
      err.message.includes('timeout')
    );

    // No `retryable` means fetch itself threw — no answer came back, so it is
    // worth another go.
    const isRetryable = !isTimeout &&
      err instanceof Error &&
      retryCount < MAX_RETRIES &&
      (backendError.retryable ?? true);

    if (isRetryable) {
      // Jitter so two tabs (or a sampleCount loop) don't line their retries up
      // and arrive together — synchronised retries are what saturate a bucket.
      const backoff = RETRY_DELAY_MS * Math.pow(2, retryCount);
      const delay = Math.round(backoff * (0.5 + Math.random() * 0.5));
      console.warn(`[Retry ${retryCount + 1}/${MAX_RETRIES}] ${method} failed (${backendError.status ?? 'network'}), retrying in ${delay}ms...`);
      await sleep(delay);
      return callBackend(method, params, signal, retryCount + 1);
    }

    if (isTimeout) {
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }

    throw err;
  }
}

/**
 * True when the bytes exist only in this browser tab, so the backend has no way
 * to obtain them and they must be uploaded.
 *
 * Everything else — a `/storage` Library asset, or any http(s) url — the server
 * can resolve itself, and sending it a reference instead of the bytes avoids
 * uploading a file back to the machine that already stores it.
 */
export function isLocalOnlyUrl(url: string): boolean {
  return url.startsWith('blob:') || url.startsWith('data:');
}

/**
 * Base64 for media the server cannot reach. Only ever call this on a
 * local-only url — see isLocalOnlyUrl.
 */
export async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({ data: base64, mimeType: blob.type });
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    // A blob: url dies with the page that created it, which is the usual cause.
    console.warn('[urlToBase64] Unreadable local url:', url.slice(0, 64));
    throw new Error('Local preview image session expired. Please re-select or re-upload the image in the node.');
  }
}

/** A generateContent part: inline bytes for local media, a reference otherwise. */
export async function imageRefPart(url: string): Promise<Record<string, unknown>> {
  if (!isLocalOnlyUrl(url)) return { _imageUrl: url };
  const { data, mimeType } = await urlToBase64(url);
  return { inlineData: { data, mimeType } };
}

/** The image shape the video APIs take: inline bytes for local media, a reference otherwise. */
export async function imageRefBytes(url: string): Promise<Record<string, unknown>> {
  if (!isLocalOnlyUrl(url)) return { _imageUrl: url };
  const { data, mimeType } = await urlToBase64(url);
  return { imageBytes: data, mimeType };
}

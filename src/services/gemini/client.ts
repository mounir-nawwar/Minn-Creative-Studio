import { API_BASE } from "../../constants";
import { authHeader } from "../../lib/api";

export const MAX_RETRIES = 3;
export const RETRY_DELAY_MS = 1000;
export const TIMEOUT_ERROR_MESSAGE = "Request timed out. Please try again with a shorter duration or simpler prompt.";

export interface BackendError extends Error {
  status?: number;
  isClientError?: boolean;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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
        throw error;
      }
      return data.data;
    } else {
      const text = await response.text();
      console.error('Non-JSON response from backend:', text.substring(0, 500));
      const error = new Error(`Server returned non-JSON response (${response.status}). Check console for details.`) as BackendError;
      error.status = response.status;
      error.isClientError = response.status >= 400 && response.status < 500;
      throw error;
    }
  } catch (err: unknown) {
    const backendError = err as BackendError;
    const isTimeout = err instanceof Error && (
      err.name === 'AbortError' ||
      err.message.includes('abort') ||
      err.message.includes('timeout')
    );

    const isClientError = backendError.isClientError === true ||
      (err instanceof Error && (
        err.message.includes('blocked') ||
        err.message.includes('Invalid') ||
        err.message.includes('non-JSON response') ||
        err.message.includes('No image generated') ||
        err.message.includes('No audio generated') ||
        err.message.includes('quota') ||
        err.message.includes('exceeded') ||
        err.message.includes('failed') ||
        err.message.includes('authentication') ||
        err.message.includes('unauthorized') ||
        err.message.includes('forbidden')
      ));

    const isRetryable = !isTimeout &&
      !isClientError &&
      retryCount < MAX_RETRIES &&
      err instanceof Error;

    if (isRetryable) {
      const delay = RETRY_DELAY_MS * Math.pow(2, retryCount);
      console.warn(`[Retry ${retryCount + 1}/${MAX_RETRIES}] ${method} failed, retrying in ${delay}ms...`);
      await sleep(delay);
      return callBackend(method, params, signal, retryCount + 1);
    }

    if (isTimeout) {
      throw new Error(TIMEOUT_ERROR_MESSAGE);
    }

    throw err;
  }
}

export async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  // Google Cloud Storage (Vertex GCS) URLs can't be fetched directly from the browser due to CORS — proxy through backend
  if (url.includes('storage.googleapis.com')) {
    const res = await fetch(`${API_BASE}/proxy-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error(`Image proxy failed: ${res.status}`);
    return res.json();
  }
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve({ data: base64, mimeType: blob.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

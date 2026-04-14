import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function stripUndefined<T>(obj: T): T {
  if (obj === undefined) return null as any;
  if (obj === null) return obj;
  if (typeof obj === 'function') return null as any;
  if (typeof obj === 'number') return (isFinite(obj) ? obj : null) as any;
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Date) return obj; // Firestore supports Date natively
  if (Array.isArray(obj)) {
    return (obj as any[])
      .map(item =>
        // Firestore doesn't support nested arrays — convert inner arrays to JSON strings
        Array.isArray(item) ? JSON.stringify(item) : stripUndefined(item)
      )
      .filter(v => v !== undefined) as unknown as T;
  }
  // Only recurse into plain objects — class instances get converted to null to avoid
  // Firestore "invalid nested entity" errors from non-serializable types
  if (Object.getPrototypeOf(obj) !== Object.prototype) {
    return null as any;
  }
  return Object.fromEntries(
    Object.entries(obj as object)
      .filter(([, v]) => v !== undefined && typeof v !== 'function')
      .map(([k, v]) => [k, stripUndefined(v)])
  ) as T;
}

/**
 * Robustly downloads a file by fetching it as a blob.
 * Firebase Storage URLs are proxied through the backend to avoid CORS restrictions.
 */
export async function downloadFile(url: string, filename: string) {
  try {
    let blob: Blob;

    // data: URLs — decode directly, no fetch needed
    if (url.startsWith('data:')) {
      const [header, b64] = url.split(',');
      const mime = header.split(':')[1].split(';')[0];
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      blob = new Blob([arr], { type: mime });
    } else if (
      url.includes('firebasestorage.googleapis.com') ||
      url.includes('storage.googleapis.com')
    ) {
      // Firebase Storage URLs have CORS restrictions — proxy through backend
      const res = await fetch('/api/proxy-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) throw new Error(`Proxy failed: ${res.status}`);
      const { data, mimeType } = await res.json();
      const bytes = atob(data);
      const arr = new Uint8Array(bytes.length);
      for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
      blob = new Blob([arr], { type: mimeType });
    } else {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);
      blob = await response.blob();
    }

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
  } catch (err) {
    console.error('Download failed:', err);
    window.open(url, '_blank');
  }
}

/**
 * Calculates the CSS top position for a handle based on its index and total handles.
 * This encapsulates the handle positioning math for cleaner UI components.
 * 
 * @param index - Zero-based index of the handle
 * @param total - Total number of handles
 * @returns CSS top value as percentage string
 * 
 * @example
 * ```typescript
 * // Single handle at 50%
 * calcHandlePosition(0, 1) // "50%"
 * 
 * // First of 3 handles at 20%
 * calcHandlePosition(0, 3) // "20%"
 * 
 * // Middle of 3 handles at 50%
 * calcHandlePosition(1, 3) // "50%"
 * ```
 */
export function calcHandlePosition(index: number, total: number): string {
  return total > 1 
    ? `${20 + (index * 60 / (total - 1))}%` 
    : '50%';
}

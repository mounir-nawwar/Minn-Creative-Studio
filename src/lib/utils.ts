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
 * Bypasses browser restrictions on cross-origin "download" attribute.
 */
export async function downloadFile(url: string, filename: string) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Fetch failed with status ${response.status}`);
    
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 100);
  } catch (err) {
    console.error('Download failed:', err);
    // Fallback: try opening in new tab if blob download fails
    window.open(url, '_blank');
  }
}

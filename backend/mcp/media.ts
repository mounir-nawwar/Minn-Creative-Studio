/**
 * Media reference helpers for MCP tools.
 *
 * Tool inputs reference images by URL — either a Library asset
 * (`/storage/...` or the absolute PUBLIC_BASE_URL form) or an external
 * http(s) URL. Library files are read straight from disk (the backend can't
 * fetch its own relative URLs); external URLs become `_imageUrl` parts that
 * backend/utils/media.ts resolveImageUrls fetches, or are fetched here when
 * raw bytes are required (video start frames).
 */

import * as fs from 'fs';
import * as path from 'path';
import { STORAGE_PATH } from '../services/storage.ts';
import { assets } from '../services/database.ts';
import { getPublicBaseUrl } from './config.ts';

const EXTENSION_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Normalize any accepted URL form to a `/storage/...` path, or null if external. */
export function toStoragePath(url: string): string | null {
  const base = getPublicBaseUrl();
  if (url.startsWith(`${base}/storage/`)) return url.slice(base.length);
  if (url.startsWith('/storage/')) return url;
  return null;
}

/** Read a Library asset from disk. Throws on traversal attempts or missing files. */
export function readStorageFile(storageUrl: string): { data: string; mimeType: string } {
  const relative = storageUrl.replace(/^\/storage\//, '');
  const filePath = path.resolve(STORAGE_PATH, relative);
  if (!filePath.startsWith(path.resolve(STORAGE_PATH))) {
    throw new Error('Invalid storage path');
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`Asset file not found for ${storageUrl} — check the url with search_library`);
  }
  const asset = assets.findByUrl(storageUrl);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mimeType = asset?.mime_type || EXTENSION_MIME[ext] || 'image/png';
  return { data: fs.readFileSync(filePath).toString('base64'), mimeType };
}

/**
 * Build a generateContent part for an image reference.
 * Library URLs → inlineData from disk; external http(s) → `_imageUrl`
 * (resolved server-side by the generation service).
 */
export function imagePartFromUrl(url: string): Record<string, unknown> {
  const storageUrl = toStoragePath(url);
  if (storageUrl) {
    const { data, mimeType } = readStorageFile(storageUrl);
    return { inlineData: { data, mimeType } };
  }
  if (/^https?:\/\//.test(url)) {
    return { _imageUrl: url };
  }
  throw new Error(`Unsupported image url: ${url} — use a /storage Library url or an http(s) url`);
}

/** Raw bytes for APIs that need imageBytes (video start/end frames, references). */
export async function imageBytesFromUrl(url: string): Promise<{ imageBytes: string; mimeType: string }> {
  const storageUrl = toStoragePath(url);
  if (storageUrl) {
    const { data, mimeType } = readStorageFile(storageUrl);
    return { imageBytes: data, mimeType };
  }
  if (!/^https?:\/\//.test(url)) {
    throw new Error(`Unsupported image url: ${url}`);
  }
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch image (${r.status}): ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { imageBytes: buf.toString('base64'), mimeType: r.headers.get('content-type') || 'image/jpeg' };
}

/**
 * Media Utilities for Minn Creative Studio
 * Handles image resolution and inline data processing
 */

import { addWavHeader } from './audio.ts';

/**
 * Resolve image URLs to inline base64 data for Vertex AI
 * Fetches images from URLs and converts to base64 inline data
 */
export async function resolveImageUrls(contents: any): Promise<any> {
  const resolveParts = (parts: any[]) =>
    Promise.all(parts.map(async (part: any) => {
      if (!part._imageUrl) return part;
      try {
        const r = await fetch(part._imageUrl);
        if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
        const buf = await r.arrayBuffer();
        return {
          inlineData: {
            data: Buffer.from(buf).toString('base64'),
            mimeType: r.headers.get('content-type') || 'image/jpeg'
          }
        };
      } catch (err) {
        console.error('Failed to resolve image URL:', part._imageUrl, err);
        return part; // Return original part on failure
      }
    }));

  if (Array.isArray(contents)) {
    return Promise.all(contents.map(async (c: any) =>
      c?.parts ? { ...c, parts: await resolveParts(c.parts) } : c
    ));
  }
  if (contents?.parts) {
    return { ...contents, parts: await resolveParts(contents.parts) };
  }
  return contents;
}

/**
 * Process inline data parts - handles audio conversion for WAV header
 */
export function processInlineData(data: string, mimeType: string): { buffer: Buffer; mimeType: string; extension: string } {
  let buf: Buffer = Buffer.from(data, 'base64');
  let ext = mimeType?.split('/')[1]?.split(';')[0] || 'bin';

  // Handle raw PCM audio - add WAV header
  if (mimeType?.includes('audio/l16')) {
    const rateMatch = mimeType.match(/rate=(\d+)/);
    const sampleRate = rateMatch ? parseInt(rateMatch[1]) : 24000;
    buf = addWavHeader(buf, sampleRate);
    mimeType = 'audio/wav';
    ext = 'wav';
  }

  return { buffer: buf, mimeType, extension: ext };
}

/**
 * Convert base64 data to buffer with proper mime type handling
 */
export function base64ToBuffer(base64: string, mimeType?: string): Buffer {
  return Buffer.from(base64, 'base64');
}

/**
 * Get extension from mime type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/webm': 'webm',
    'application/pdf': 'pdf',
    'application/json': 'json',
  };
  return extensions[mimeType] || mimeType?.split('/')[1]?.split(';')[0] || 'bin';
}

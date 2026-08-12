/**
 * Media Utilities for Minn Creative Studio
 * Handles inline data processing for generated media.
 *
 * Resolving a media *reference* (a `/storage` or http url) into bytes lives in
 * ./mediaRefs.ts — this file only deals with data already in hand.
 */

import { addWavHeader } from './audio.ts';

/**
 * Process inline data parts - handles audio conversion for WAV header
 */
export function processInlineData(data: string, mimeType: string): { buffer: Buffer; mimeType: string; extension: string } {
  let buf: Buffer = Buffer.from(data, 'base64');
  // Delegate rather than deriving the extension here: the naive subtype split
  // this used to do produced ".mpeg" for audio/mpeg, so a Lyria track was
  // stored as .mp3 but recorded under a .mpeg filename.
  let ext = getExtensionFromMimeType(mimeType);

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
 * File extension for a mime type — the single place this mapping lives.
 *
 * The subtype is not always the extension (audio/mpeg is .mp3, image/jpeg is
 * .jpg), so the table wins and the subtype is only a last resort. Parameters
 * (`audio/l16;rate=24000`) are stripped before lookup so they can't defeat it.
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
    'video/quicktime': 'mov',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'webm',
    'application/pdf': 'pdf',
    'application/json': 'json',
  };
  const base = mimeType?.split(';')[0]?.trim().toLowerCase();
  return extensions[base] || base?.split('/')[1] || 'bin';
}

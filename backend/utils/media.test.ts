// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { getExtensionFromMimeType, processInlineData } from './media.ts';

describe('getExtensionFromMimeType', () => {
  it('maps types whose subtype is not the extension', () => {
    // The bug this guards: audio/mpeg -> "mpeg" instead of "mp3", so a Lyria
    // track was written as .mp3 but recorded under a .mpeg filename.
    expect(getExtensionFromMimeType('audio/mpeg')).toBe('mp3');
    expect(getExtensionFromMimeType('image/jpeg')).toBe('jpg');
    expect(getExtensionFromMimeType('video/quicktime')).toBe('mov');
  });

  it('ignores mime parameters', () => {
    expect(getExtensionFromMimeType('audio/mpeg; codecs="mp3"')).toBe('mp3');
    expect(getExtensionFromMimeType('AUDIO/MPEG')).toBe('mp3');
  });

  it('falls back to the subtype, then to bin', () => {
    expect(getExtensionFromMimeType('image/png')).toBe('png');
    expect(getExtensionFromMimeType('application/x-thing')).toBe('x-thing');
    expect(getExtensionFromMimeType('')).toBe('bin');
  });
});

describe('processInlineData', () => {
  const b64 = Buffer.from('test').toString('base64');

  it('uses the same extension mapping as getExtensionFromMimeType', () => {
    // Both call sites must agree — they used to derive the extension
    // independently, which is how the .mp3/.mpeg mismatch appeared.
    for (const mime of ['audio/mpeg', 'image/jpeg', 'video/mp4', 'audio/wav']) {
      expect(processInlineData(b64, mime).extension).toBe(getExtensionFromMimeType(mime));
    }
  });

  it('converts raw PCM to WAV and reports it as such', () => {
    const result = processInlineData(b64, 'audio/l16;rate=24000');
    expect(result.mimeType).toBe('audio/wav');
    expect(result.extension).toBe('wav');
    // A RIFF header was prepended, so the buffer grew.
    expect(result.buffer.length).toBeGreaterThan(Buffer.from(b64, 'base64').length);
  });

  it('passes non-PCM data through untouched', () => {
    const result = processInlineData(b64, 'audio/mpeg');
    expect(result.mimeType).toBe('audio/mpeg');
    expect(result.buffer.toString()).toBe('test');
  });
});

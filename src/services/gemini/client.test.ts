/**
 * The invariant: an asset the server already stores travels as a reference, not
 * as re-uploaded bytes. Only media that exists solely in this tab (`blob:`,
 * `data:`) may be inlined.
 *
 * This regressed silently once already — `imageService` gated on
 * `url.startsWith('http')` while every Library url is relative (`/storage/...`),
 * so the reference path was dead code and everything was uploaded. Hence both a
 * behavioural test and a source guard below.
 */
import { describe, test, expect, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { isLocalOnlyUrl, imageRefPart, imageRefBytes } from './client';

const STORAGE_URL = '/storage/projects/p1/shot.png';
const EXTERNAL_URL = 'https://example.com/cat.png';

afterEach(() => {
  vi.restoreAllMocks();
});

/** Minimal fetch stub — a real Response drops the Blob's type in this environment. */
function mockBlobFetch(mimeType: string) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    blob: async () => new Blob(['abc'], { type: mimeType }),
  } as unknown as Response);
}

describe('isLocalOnlyUrl', () => {
  test('only blob: and data: are local to this tab', () => {
    expect(isLocalOnlyUrl('blob:http://localhost:3000/abc')).toBe(true);
    expect(isLocalOnlyUrl('data:image/png;base64,AAAA')).toBe(true);
    expect(isLocalOnlyUrl(STORAGE_URL)).toBe(false);
    expect(isLocalOnlyUrl(EXTERNAL_URL)).toBe(false);
  });
});

describe('imageRefPart', () => {
  test('sends a reference for a stored asset — and reads nothing', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await expect(imageRefPart(STORAGE_URL)).resolves.toEqual({ _imageUrl: STORAGE_URL });
    expect(spy).not.toHaveBeenCalled();
  });

  test('sends a reference for an external url', async () => {
    await expect(imageRefPart(EXTERNAL_URL)).resolves.toEqual({ _imageUrl: EXTERNAL_URL });
  });

  test('inlines local-only media, since the server cannot reach it', async () => {
    mockBlobFetch('image/png');
    const part = await imageRefPart('blob:http://localhost:3000/abc') as any;
    expect(part.inlineData.mimeType).toBe('image/png');
    expect(part.inlineData.data).toBeTruthy();
  });
});

describe('imageRefBytes', () => {
  test('sends a reference for a stored asset', async () => {
    await expect(imageRefBytes(STORAGE_URL)).resolves.toEqual({ _imageUrl: STORAGE_URL });
  });

  test('inlines local-only media in the video-api shape', async () => {
    mockBlobFetch('image/jpeg');
    const image = await imageRefBytes('blob:http://localhost:3000/abc') as any;
    expect(image.mimeType).toBe('image/jpeg');
    expect(image.imageBytes).toBeTruthy();
  });
});

describe('source guard: only client.ts may turn a url into bytes', () => {
  test('no generation service calls urlToBase64 directly', () => {
    const dir = path.resolve(__dirname);
    const offenders = fs.readdirSync(dir)
      .filter((f) => f.endsWith('.ts') && f !== 'client.ts' && !f.endsWith('.test.ts'))
      .filter((f) => fs.readFileSync(path.join(dir, f), 'utf8').includes('urlToBase64'));

    // Use imageRefPart / imageRefBytes instead — they inline only local-only
    // media and let the server resolve everything it can already reach.
    expect(offenders).toEqual([]);
  });
});

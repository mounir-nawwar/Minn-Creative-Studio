// @vitest-environment node
/**
 * The rule this file protects: an asset the server already stores must never be
 * uploaded back to it. Callers send a reference; these helpers turn it into
 * bytes — off disk for Library assets, over the network for external urls only.
 */
import { describe, test, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const STORAGE_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'minn-mediarefs-'));

vi.mock('../services/storage.ts', () => ({ STORAGE_PATH: STORAGE_ROOT }));
vi.mock('../services/database.ts', () => ({
  assets: { findByUrl: (url: string) => (url.endsWith('song.mp3') ? { mime_type: 'audio/mpeg' } : null) },
}));

const {
  toStoragePath,
  readStorageFile,
  resolveMediaUrl,
  imagePartFromUrl,
  imageBytesFromUrl,
  assertFetchableUrl,
} = await import('./mediaRefs.ts');

const PIXEL = Buffer.from('fake-png-bytes');

beforeAll(() => {
  fs.mkdirSync(path.join(STORAGE_ROOT, 'projects', 'p1'), { recursive: true });
  fs.writeFileSync(path.join(STORAGE_ROOT, 'projects', 'p1', 'shot.png'), PIXEL);
  fs.writeFileSync(path.join(STORAGE_ROOT, 'projects', 'p1', 'song.mp3'), PIXEL);
  fs.writeFileSync(path.join(STORAGE_ROOT, 'secret.txt'), 'top secret');
});

afterAll(() => {
  fs.rmSync(STORAGE_ROOT, { recursive: true, force: true });
});

describe('toStoragePath', () => {
  const original = process.env.PUBLIC_BASE_URL;
  beforeEach(() => { process.env.PUBLIC_BASE_URL = 'https://studio.example.com'; });
  afterEach(() => { process.env.PUBLIC_BASE_URL = original; });

  test('accepts the relative form assets are actually stored with', () => {
    expect(toStoragePath('/storage/projects/p1/shot.png')).toBe('/storage/projects/p1/shot.png');
  });

  test('accepts our own absolute origin', () => {
    expect(toStoragePath('https://studio.example.com/storage/projects/p1/shot.png'))
      .toBe('/storage/projects/p1/shot.png');
  });

  test('a foreign origin with a /storage path is NOT one of ours', () => {
    // Otherwise https://evil.com/storage/x would be served out of our own disk.
    expect(toStoragePath('https://evil.com/storage/projects/p1/shot.png')).toBeNull();
  });

  test('external and local-only urls are not storage paths', () => {
    expect(toStoragePath('https://example.com/cat.png')).toBeNull();
    expect(toStoragePath('data:image/png;base64,AAAA')).toBeNull();
  });
});

describe('readStorageFile', () => {
  test('reads bytes off disk', () => {
    const { data } = readStorageFile('/storage/projects/p1/shot.png');
    expect(Buffer.from(data, 'base64').toString()).toBe(PIXEL.toString());
  });

  test('prefers the mime type recorded on the asset row', () => {
    expect(readStorageFile('/storage/projects/p1/song.mp3').mimeType).toBe('audio/mpeg');
  });

  test('falls back to the extension when there is no asset row', () => {
    expect(readStorageFile('/storage/projects/p1/shot.png').mimeType).toBe('image/png');
  });

  test('rejects traversal out of the storage root', () => {
    expect(() => readStorageFile('/storage/../secret.txt')).toThrow(/Invalid storage path/);
  });

  test('names the url when the file is missing rather than passing silently', () => {
    expect(() => readStorageFile('/storage/projects/p1/nope.png')).toThrow(/nope\.png/);
  });
});

describe('assertFetchableUrl', () => {
  test.each([
    ['loopback', 'http://127.0.0.1/x.png'],
    ['ipv6 loopback', 'http://[::1]/x.png'],
    ['private class A', 'http://10.0.0.5/x.png'],
    ['private class B', 'http://172.16.4.4/x.png'],
    ['private class C', 'http://192.168.1.1/x.png'],
    ['cloud metadata', 'http://169.254.169.254/latest/meta-data/'],
    ['ipv4-mapped ipv6', 'http://[::ffff:10.0.0.1]/x.png'],
  ])('refuses %s', async (_label, url) => {
    await expect(assertFetchableUrl(url)).rejects.toThrow(/private or loopback/);
  });

  test('refuses non-http schemes', async () => {
    await expect(assertFetchableUrl('file:///etc/passwd')).rejects.toThrow(/scheme/);
  });

  test('refuses a host that will not resolve', async () => {
    await expect(assertFetchableUrl('https://nonexistent.invalid/x.png'))
      .rejects.toThrow(/Could not resolve host/);
  });

  test('allows a public address', async () => {
    await expect(assertFetchableUrl('https://8.8.8.8/img.png')).resolves.toBeUndefined();
  });
});

describe('reference resolution', () => {
  test('a Library url resolves from disk, never over the network', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    const { data } = await resolveMediaUrl('/storage/projects/p1/shot.png');
    expect(Buffer.from(data, 'base64').toString()).toBe(PIXEL.toString());
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('imagePartFromUrl inlines Library assets and defers external urls', () => {
    expect(imagePartFromUrl('/storage/projects/p1/shot.png')).toHaveProperty('inlineData');
    expect(imagePartFromUrl('https://example.com/cat.png')).toEqual({ _imageUrl: 'https://example.com/cat.png' });
  });

  test('imageBytesFromUrl returns the video-api shape', async () => {
    const result = await imageBytesFromUrl('/storage/projects/p1/shot.png');
    expect(result.mimeType).toBe('image/png');
    expect(Buffer.from(result.imageBytes, 'base64').toString()).toBe(PIXEL.toString());
  });

  test('local-only urls are rejected — the caller must inline them', async () => {
    await expect(resolveMediaUrl('data:image/png;base64,AAAA')).rejects.toThrow(/Unsupported media url/);
    await expect(resolveMediaUrl('blob:http://localhost/abc')).rejects.toThrow(/Unsupported media url/);
  });
});

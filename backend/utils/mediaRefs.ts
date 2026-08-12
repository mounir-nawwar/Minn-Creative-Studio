/**
 * Media references — the one place bytes are produced from a media URL.
 *
 * Callers (browser, MCP tools, graphRunner) pass a *reference* rather than
 * bytes; this module turns it into bytes. Two forms are accepted:
 *
 *   - a Library asset (`/storage/...`, or the absolute PUBLIC_BASE_URL form)
 *     → read straight off disk. The backend cannot fetch its own relative
 *       URLs, and it would be wasteful to try — the file is right there.
 *   - an external `http(s)` URL → fetched, behind the SSRF guard below.
 *
 * Anything else (`data:`, `blob:`) is genuinely local to whoever holds it and
 * must be inlined by that caller before it ever reaches the backend.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as dns from 'dns';
import * as net from 'net';
import { STORAGE_PATH } from '../services/storage.ts';
import { assets } from '../services/database.ts';

/** Fallback when an asset row carries no mime type — the DB value wins when present. */
const EXTENSION_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
};

export interface MediaBytes {
  data: string;
  mimeType: string;
}

/**
 * Origins that mean "this server". An absolute `/storage` URL only counts as a
 * Library asset when it points at us — otherwise `https://evil.com/storage/x.png`
 * would be served from our own disk instead of being fetched.
 */
function ownOrigins(): string[] {
  const port = process.env.PORT || '3000';
  const origins = [`http://localhost:${port}`, `http://127.0.0.1:${port}`];
  const configured = process.env.PUBLIC_BASE_URL?.replace(/\/+$/, '');
  if (configured) origins.unshift(configured);
  return origins;
}

/** Normalize any accepted URL form to a `/storage/...` path, or null if not a Library asset. */
export function toStoragePath(url: string): string | null {
  if (url.startsWith('/storage/')) return url;
  for (const origin of ownOrigins()) {
    if (url.startsWith(`${origin}/storage/`)) return url.slice(origin.length);
  }
  return null;
}

/** Read a Library asset from disk. Throws on traversal attempts or missing files. */
export function readStorageFile(storageUrl: string): MediaBytes {
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
 * Expand an IPv6 address to its eight 16-bit groups, or null if unparseable.
 *
 * Needed because the textual form varies: `new URL()` rewrites
 * `::ffff:10.0.0.1` as `::ffff:a00:1`, so matching on the dotted-quad spelling
 * alone lets a private address through.
 */
function ipv6Groups(address: string): number[] | null {
  let text = address;
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split('.').map(Number);
    text = text.slice(0, dotted.index) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const [head, tail] = text.split('::');
  const toGroups = (s?: string) => (s ? s.split(':').filter(Boolean).map((g) => parseInt(g, 16)) : []);
  const headGroups = toGroups(head);
  if (tail === undefined) return headGroups.length === 8 ? headGroups : null;

  const tailGroups = toGroups(tail);
  const fill = 8 - headGroups.length - tailGroups.length;
  if (fill < 0) return null;
  return [...headGroups, ...Array(fill).fill(0), ...tailGroups];
}

/** True for addresses that must never be reachable from a user-supplied URL. */
function isBlockedAddress(address: string): boolean {
  if (net.isIPv6(address)) {
    const groups = ipv6Groups(address.toLowerCase());
    if (!groups || groups.some(Number.isNaN)) return true; // unparseable → refuse
    // IPv4-mapped (::ffff:a.b.c.d) — judge the embedded address instead.
    if (groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff) {
      const embedded = [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.');
      return isBlockedAddress(embedded);
    }
    if (groups.every((g) => g === 0)) return true;                              // ::
    if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true; // ::1
    if ((groups[0] & 0xfe00) === 0xfc00) return true;                            // fc00::/7 unique-local
    if ((groups[0] & 0xffc0) === 0xfe80) return true;                            // fe80::/10 link-local
    return false;
  }

  const [a, b] = address.split('.').map(Number);
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;               // link-local + cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;      // CGNAT
  if (a === 192 && b === 0) return true;                  // IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return true;    // benchmarking
  if (a >= 224) return true;                              // multicast + reserved
  return false;
}

/**
 * Reject URLs that would turn the backend into a proxy for its own network.
 *
 * Note this resolves DNS and checks the answer, so a hostname pointing at a
 * private address is caught — but the check is not atomic with the fetch that
 * follows, so a determined DNS-rebinding attack remains theoretically possible.
 * That is an accepted trade-off for a two-user private tool; closing it needs a
 * pinned-IP agent, which is not worth the complexity here.
 */
export async function assertFetchableUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`Unsupported media url: ${url}`);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsupported media url scheme: ${parsed.protocol}`);
  }

  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (net.isIP(host)) {
    addresses = [host];
  } else {
    try {
      addresses = (await dns.promises.lookup(host, { all: true })).map((entry) => entry.address);
    } catch {
      throw new Error(`Could not resolve host: ${parsed.hostname}`);
    }
  }

  if (addresses.some(isBlockedAddress)) {
    throw new Error(`Refusing to fetch a private or loopback address: ${parsed.hostname}`);
  }
}

/** Fetch an external http(s) media URL. */
export async function fetchExternalMedia(url: string): Promise<MediaBytes> {
  await assertFetchableUrl(url);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch media (${r.status}): ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return { data: buf.toString('base64'), mimeType: r.headers.get('content-type') || 'image/jpeg' };
}

/** Bytes for any supported reference — Library asset from disk, external URL by fetch. */
export async function resolveMediaUrl(url: string): Promise<MediaBytes> {
  const storageUrl = toStoragePath(url);
  if (storageUrl) return readStorageFile(storageUrl);
  if (/^https?:\/\//i.test(url)) return fetchExternalMedia(url);
  throw new Error(`Unsupported media url: ${url} — use a /storage Library url or an http(s) url`);
}

/**
 * Build a generateContent part for an image reference.
 * Library URLs → inlineData from disk; external http(s) → `_imageUrl`, which
 * the generation service resolves (it may need the network, callers are sync).
 */
export function imagePartFromUrl(url: string): Record<string, unknown> {
  const storageUrl = toStoragePath(url);
  if (storageUrl) {
    const { data, mimeType } = readStorageFile(storageUrl);
    return { inlineData: { data, mimeType } };
  }
  if (/^https?:\/\//i.test(url)) {
    return { _imageUrl: url };
  }
  throw new Error(`Unsupported image url: ${url} — use a /storage Library url or an http(s) url`);
}

/** Raw bytes for APIs that need imageBytes (video start/end frames, references). */
export async function imageBytesFromUrl(url: string): Promise<{ imageBytes: string; mimeType: string }> {
  const { data, mimeType } = await resolveMediaUrl(url);
  return { imageBytes: data, mimeType };
}

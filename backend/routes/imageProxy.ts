import express from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { assertFetchableUrl } from '../utils/mediaRefs.ts';

const router = express.Router();

interface ProxyCacheEntry {
  buffer: Buffer;
  mimeType: string;
  timestamp: number;
}

const TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_ENTRIES = 100;
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15MB size guard
const imageCache = new Map<string, ProxyCacheEntry>();

function getCachedImage(url: string): ProxyCacheEntry | null {
  const entry = imageCache.get(url);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    imageCache.delete(url);
    return null;
  }
  return entry;
}

function setCachedImage(url: string, entry: ProxyCacheEntry) {
  if (imageCache.size >= MAX_CACHE_ENTRIES) {
    // Evict oldest entry (first key in Map insertion order)
    const oldestKey = imageCache.keys().next().value;
    if (oldestKey) imageCache.delete(oldestKey);
  }
  imageCache.set(url, entry);
}

router.post('/', requireAuth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  // Shares the one SSRF guard with the generation path. It resolves DNS before
  // judging, so a hostname pointing at a private address is caught too — the
  // hostname-pattern check this replaced let those straight through.
  try {
    await assertFetchableUrl(url);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid URL' });
  }

  // Check in-memory cache hit
  const cached = getCachedImage(url);
  if (cached) {
    return res.json({
      data: cached.buffer.toString('base64'),
      mimeType: cached.mimeType,
      cached: true,
    });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ error: `Failed to fetch image: ${response.status}` });

    // Check Content-Length header guard
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE_BYTES) {
      return res.status(413).json({ error: 'Image size exceeds maximum allowed limit (15MB)' });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_IMAGE_SIZE_BYTES) {
      return res.status(413).json({ error: 'Image size exceeds maximum allowed limit (15MB)' });
    }

    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    setCachedImage(url, {
      buffer,
      mimeType,
      timestamp: Date.now(),
    });

    res.json({
      data: buffer.toString('base64'),
      mimeType,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
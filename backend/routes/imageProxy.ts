import express from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { isValidImageUrl } from '../utils/imageValidation.ts';

const router = express.Router();

interface ProxyCacheEntry {
  data: string;
  mimeType: string;
  timestamp: number;
}

const TTL_MS = 15 * 60 * 1000; // 15 minutes
const MAX_CACHE_ENTRIES = 100;
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

  const validation = isValidImageUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Check in-memory cache hit
  const cached = getCachedImage(url);
  if (cached) {
    return res.json({
      data: cached.data,
      mimeType: cached.mimeType,
      cached: true,
    });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ error: `Failed to fetch image: ${response.status}` });
    const buffer = await response.arrayBuffer();
    const data = Buffer.from(buffer).toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';

    setCachedImage(url, {
      data,
      mimeType,
      timestamp: Date.now(),
    });

    res.json({
      data,
      mimeType,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;
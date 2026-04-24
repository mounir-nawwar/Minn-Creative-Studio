import express from 'express';
import { requireAuth } from '../middleware/auth.ts';
import { isValidImageUrl } from '../utils/imageValidation.ts';

const router = express.Router();

router.post('/', requireAuth, async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'url required' });

  const validation = isValidImageUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return res.status(502).json({ error: `Failed to fetch image: ${response.status}` });
    const buffer = await response.arrayBuffer();
    res.json({
      data: Buffer.from(buffer).toString('base64'),
      mimeType: response.headers.get('content-type') || 'image/jpeg',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;

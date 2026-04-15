import express from 'express';
import { interpolateVideo } from '../processing/rife.ts';
import { requireAuth } from '../middleware/auth.ts';
import { validateBody, interpolateSchema } from '../middleware/validation.ts';

const router = express.Router();

router.post('/', requireAuth, validateBody(interpolateSchema), async (req, res) => {
  const { videoUrl, targetFps } = req.body;
  try {
    const interpolatedVideoUrl = await interpolateVideo(videoUrl, targetFps);
    res.json({ video: interpolatedVideoUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;

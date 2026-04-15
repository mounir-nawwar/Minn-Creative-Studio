import express from 'express';
import { upscaleVideo } from '../processing/esrgan.ts';
import { requireAuth } from '../middleware/auth.ts';
import { validateBody, upscaleVideoSchema } from '../middleware/validation.ts';

const router = express.Router();

router.post('/video', requireAuth, validateBody(upscaleVideoSchema), async (req, res) => {
  const { videoUrl, scale } = req.body;
  try {
    const upscaledVideoUrl = await upscaleVideo(videoUrl, scale);
    res.json({ video: upscaledVideoUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;

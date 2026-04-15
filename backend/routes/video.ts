import express from 'express';
import { processVideo } from '../processing/video.ts';
import { requireAuth } from '../middleware/auth.ts';
import { validateBody, videoProcessSchema } from '../middleware/validation.ts';

const router = express.Router();

router.post('/process', requireAuth, validateBody(videoProcessSchema), async (req, res) => {
  const { videoUrl, type, config } = req.body;
  try {
    const processedVideoUrl = await processVideo(videoUrl, type, config);
    res.json({ video: processedVideoUrl });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

export default router;

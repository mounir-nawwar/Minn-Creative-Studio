import express from 'express';
import { interpolateVideo } from '../processing/rife.ts';

const router = express.Router();

// Frame Interpolator (RIFE)
router.post('/', async (req, res) => {
  const { videoUrl, targetFps } = req.body;
  try {
    const interpolatedVideoUrl = await interpolateVideo(videoUrl, targetFps);
    res.json({ video: interpolatedVideoUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

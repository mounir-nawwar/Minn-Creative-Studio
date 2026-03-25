import express from 'express';
import { upscaleVideo } from '../processing/esrgan.js';

const router = express.Router();

// Video Upscaler (ESRGAN)
router.post('/video', async (req, res) => {
  const { videoUrl, scale } = req.body;
  try {
    const upscaledVideoUrl = await upscaleVideo(videoUrl, scale);
    res.json({ video: upscaledVideoUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

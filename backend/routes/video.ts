import express from 'express';
import { processVideo } from '../processing/video.js';

const router = express.Router();

// Video Matte / Mask
router.post('/process', async (req, res) => {
  const { videoUrl, type, config } = req.body;
  try {
    const processedVideoUrl = await processVideo(videoUrl, type, config);
    res.json({ video: processedVideoUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

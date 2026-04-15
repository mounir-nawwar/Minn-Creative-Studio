import express from 'express';
import fetch from 'node-fetch';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../middleware/auth.ts';
import { validateBody, batchSizeSchema } from '../middleware/validation.ts';

if (!ffmpegStatic) {
  throw new Error('ffmpeg-static path not found. Ensure ffmpeg-static is installed.');
}
ffmpeg.setFfmpegPath(ffmpegStatic);

const router = express.Router();

router.post('/', requireAuth, validateBody(batchSizeSchema), async (req, res) => {
  const { imageUrl, sizes } = req.body;
  
  const inputPath = path.join('/tmp', `input_${Date.now()}.png`);
  const outputPaths: string[] = [];
  
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const buffer = await response.buffer();
    fs.writeFileSync(inputPath, buffer);

    const results: { size: string; url: string }[] = [];

    for (const size of sizes) {
      const outputPath = path.join('/tmp', `output_${size.replace(':', '_')}_${Date.now()}.png`);
      outputPaths.push(outputPath);
      
      let filter = '';
      if (size === '1:1') filter = 'crop=min(iw\\,ih):min(iw\\,ih),scale=1024:1024';
      else if (size === '4:5') filter = 'crop=ih*0.8:ih,scale=1080:1350';
      else if (size === '9:16') filter = 'crop=ih*9/16:ih,scale=1080:1920';
      else if (size === '16:9') filter = 'crop=iw:iw*9/16,scale=1920:1080';
      else if (size === '1.91:1') filter = 'crop=iw:iw/1.91,scale=1200:628';
      else filter = 'scale=1024:1024';

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions(['-vf', filter])
          .save(outputPath)
          .on('end', resolve)
          .on('error', reject);
      });

      const outputBuffer = fs.readFileSync(outputPath);
      results.push({
        size,
        url: `data:image/png;base64,${outputBuffer.toString('base64')}`
      });
    }

    res.json({ images: results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('Batch Resize Error:', err);
    res.status(500).json({ error: message });
  } finally {
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    for (const outputPath of outputPaths) {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    }
  }
});

export default router;

import express from 'express';
import fetch from 'node-fetch';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';

ffmpeg.setFfmpegPath(ffmpegStatic!);

const router = express.Router();

router.post('/', async (req: any, res: any) => {
  const { imageUrl, sizes } = req.body;
  
  try {
    const response = await fetch(imageUrl);
    const buffer = await response.buffer();
    const inputPath = path.join('/tmp', `input_${Date.now()}.png`);
    fs.writeFileSync(inputPath, buffer);

    const results = [];

    for (const size of sizes) {
      const outputPath = path.join('/tmp', `output_${size.replace(':', '_')}_${Date.now()}.png`);
      
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

      fs.unlinkSync(outputPath);
    }

    fs.unlinkSync(inputPath);
    res.json({ images: results });
  } catch (err: any) {
    console.error('Batch Resize Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

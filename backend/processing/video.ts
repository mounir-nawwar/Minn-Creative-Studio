import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export async function processVideo(videoUrl: string, type: string, config: any) {
  const tempDir = path.join(process.cwd(), 'temp', `video_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, 'input.mp4');
  const outputPath = path.join(tempDir, 'output.mp4');

  try {
    // Download video
    const response = await fetch(videoUrl);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(inputPath, Buffer.from(buffer));

    // Process using ffmpeg
    await new Promise((resolve, reject) => {
      let command = ffmpeg(inputPath);

      if (type === 'matte') {
        const { blur = 0, threshold = 128 } = config;
        // Apply blur and threshold to simulate matte adjustment
        // This is a simplified approach using ffmpeg filters
        let filter = `format=gray,threshold=threshold=${threshold}/255`;
        if (blur > 0) {
          filter += `,boxblur=${blur}`;
        }
        command = command.videoFilters(filter);
      } else if (type === 'mask') {
        // For mask by text, we'd ideally use a model.
        // As a fallback, we'll just convert to grayscale to look like a mask.
        command = command.videoFilters('format=gray');
      }

      command
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Read output and return as base64
    const outputBuffer = fs.readFileSync(outputPath);
    const base64Video = `data:video/mp4;base64,${outputBuffer.toString('base64')}`;

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });

    return base64Video;
  } catch (err: any) {
    fs.rmSync(tempDir, { recursive: true, force: true });
    throw err;
  }
}

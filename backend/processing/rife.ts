import { exec } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import path from 'path';
import fs from 'fs';
import { promisify } from 'util';

const execPromise = promisify(exec);
if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}

export async function interpolateVideo(videoUrl: string, targetFps: number) {
  const tempDir = path.join(process.cwd(), 'temp', `interpolate_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, 'input.mp4');
  const framesDir = path.join(tempDir, 'frames');
  const interpolatedFramesDir = path.join(tempDir, 'interpolated_frames');
  fs.mkdirSync(framesDir);
  fs.mkdirSync(interpolatedFramesDir);

  try {
    // Download video
    const response = await fetch(videoUrl);
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(inputPath, Buffer.from(buffer));

    // Extract frames
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .output(path.join(framesDir, 'frame_%04d.png'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Run RIFE on frames
    // RIFE usually takes input frames and generates intermediate frames.
    // Let's assume a RIFE CLI exists.
    await execPromise(`rife-ncnn-vulkan -i ${framesDir} -o ${interpolatedFramesDir} -f ${targetFps}`);

    // Reassemble video
    const outputPath = path.join(tempDir, 'output.mp4');
    await new Promise((resolve, reject) => {
      ffmpeg(path.join(interpolatedFramesDir, 'frame_%04d.png'))
        .inputFPS(targetFps)
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Read output and return as base64 for now (or upload to storage)
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

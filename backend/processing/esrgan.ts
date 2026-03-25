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

export async function upscaleVideo(videoUrl: string, scale: string) {
  const tempDir = path.join(process.cwd(), 'temp', `upscale_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const inputPath = path.join(tempDir, 'input.mp4');
  const framesDir = path.join(tempDir, 'frames');
  const upscaledFramesDir = path.join(tempDir, 'upscaled_frames');
  fs.mkdirSync(framesDir);
  fs.mkdirSync(upscaledFramesDir);

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

    // Run ESRGAN on frames
    const model = scale === '4x' ? 'RealESRGAN_x4plus' : 'RealESRGAN_x2plus';
    try {
      await execPromise(`realesrgan-ncnn-vulkan -i ${framesDir} -o ${upscaledFramesDir} -n ${model}`);
    } catch (err) {
      console.warn('realesrgan-ncnn-vulkan not found, falling back to ffmpeg resize');
      const frames = fs.readdirSync(framesDir);
      for (const frame of frames) {
        const inputFrame = path.join(framesDir, frame);
        const outputFrame = path.join(upscaledFramesDir, frame);
        const scaleFactor = parseInt(scale);
        await new Promise((resolve, reject) => {
          ffmpeg(inputFrame)
            .size(`${scaleFactor * 100}%`)
            .output(outputFrame)
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
      }
    }

    // Reassemble video
    const outputPath = path.join(tempDir, 'output.mp4');
    await new Promise((resolve, reject) => {
      ffmpeg(path.join(upscaledFramesDir, 'frame_%04d.png'))
        .inputFPS(24) // Default or original FPS
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

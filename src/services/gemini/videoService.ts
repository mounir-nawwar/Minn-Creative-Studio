import { callBackend, urlToBase64 } from './client';

export const generateVideo = async (params: {
  prompt: string;
  model: string;
  aspectRatio: string;
  resolution?: string;
  duration?: number;
  sampleCount?: number;
  negativePrompt?: string;
  seed?: number;
  personGeneration?: string;
  audio?: boolean;
  resizeMode?: string;
  startFrameUrl?: string;
  endFrameUrl?: string;
  referenceImages?: { url: string; role: string; strength: number }[];
  motionIntensity?: number;
  videoUrl?: string;
  projectId?: string;
  projectContext?: string;
  onProgress?: (progress: number) => void;
}, signal?: AbortSignal): Promise<string[]> => {
  const {
    prompt, model, aspectRatio, resolution, duration, sampleCount = 1,
    negativePrompt, seed, personGeneration, audio, resizeMode,
    startFrameUrl, endFrameUrl, referenceImages, motionIntensity,
    videoUrl, projectId, projectContext, onProgress
  } = params;

  const fullPrompt = projectContext
    ? `Project Context: ${projectContext}\n\nTask: Generate a video based on this prompt: ${prompt}`
    : prompt;

  const videoConfig: any = {
    numberOfVideos: sampleCount,
    sampleCount: sampleCount,
    aspectRatio: aspectRatio as any,
    resolution: (resolution || '720p') as any,
    duration: duration,
    motionIntensity: motionIntensity,
    ...(negativePrompt && { negativePrompt }),
    ...(seed !== undefined && { seed }),
    ...(personGeneration && { personGeneration }),
    ...(audio !== undefined && { audio }),
    ...(resizeMode && { resizeMode }),
  };

  let startFrameData;
  if (startFrameUrl) {
    onProgress?.(5);
    const { data, mimeType } = await urlToBase64(startFrameUrl);
    startFrameData = { imageBytes: data, mimeType };
  }

  if (endFrameUrl) {
    onProgress?.(10);
    const { data, mimeType } = await urlToBase64(endFrameUrl);
    videoConfig.lastFrame = { imageBytes: data, mimeType };
  }

  if (referenceImages && referenceImages.length > 0) {
    onProgress?.(15);
    videoConfig.referenceImages = await Promise.all(referenceImages.map(async (ref: any) => {
      const { data, mimeType } = await urlToBase64(ref.url);
      return {
        image: { imageBytes: data, mimeType },
        referenceType: 'ASSET',
      };
    }));
  }

  try {
    onProgress?.(20);
    let operation = await callBackend('generateVideos', {
      model: model,
      prompt: fullPrompt || 'Animate this sequence',
      image: startFrameData,
      config: videoConfig
    }, signal);

    const MAX_POLL_COUNT = 120; // 10 minutes max (120 * 5 seconds)
    const POLL_INTERVAL_MS = 5000;
    let pollCount = 0;

    while (!operation.done) {
      pollCount++;

      if (pollCount > MAX_POLL_COUNT) {
        throw new Error("Video generation timed out after 10 minutes. Please try again with a shorter duration or simpler prompt.");
      }

      const simulatedProgress = Math.min(20 + (pollCount * 5), 90);
      onProgress?.(simulatedProgress);

      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      if (signal?.aborted) throw new Error("Video generation cancelled");
      operation = await callBackend('getOperation', { operation: operation }, signal);
    }

    onProgress?.(95);
    const generatedVideos: any[] = operation.response?.generatedVideos ?? [];
    if (!generatedVideos.length) throw new Error("No video generated");

    const results = await Promise.all(
      generatedVideos.map(async (v: any) => {
        const url = v.video?.uri;
        if (!url) return null;
        const videoData = await callBackend('fetchVideoFile', { url, projectId }, signal);
        if (videoData.storageUrl) return videoData.storageUrl;
        return `data:${videoData.contentType};base64,${videoData.base64}`;
      })
    );
    const videos = results.filter(Boolean) as string[];
    if (!videos.length) throw new Error("No video generated");
    onProgress?.(100);
    return videos;
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

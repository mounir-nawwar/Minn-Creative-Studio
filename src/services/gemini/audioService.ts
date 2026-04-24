import { callBackend, urlToBase64 } from './client';

export const generateAudio = async (params: {
  prompt: string;
  model?: string;
  voice?: string;
  projectId?: string;
  referenceImages?: { url: string }[];
  negativePrompt?: string;
  duration?: number;
  seed?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  guidance?: number;
  bpm?: number;
  density?: number;
  brightness?: number;
  scale?: string;
  onProgress?: (progress: number) => void;
}, signal?: AbortSignal) => {
  const {
    prompt,
    model = "gemini-2.5-flash-preview-tts",
    voice = 'Kore',
    projectId,
    referenceImages,
    negativePrompt,
    duration,
    seed,
    temperature,
    topP,
    topK,
    guidance,
    bpm,
    density,
    brightness,
    scale,
    onProgress
  } = params;

  const isLyria = model.includes('lyria');
  const parts: any[] = [];

  if (isLyria && referenceImages && referenceImages.length > 0) {
    for (const ref of referenceImages) {
      if (ref.url.startsWith('http')) {
        parts.push({ _imageUrl: ref.url });
      } else {
        const { data, mimeType } = await urlToBase64(ref.url);
        parts.push({ inlineData: { data, mimeType } });
      }
    }
  }

  parts.push({ text: prompt });

  try {
    onProgress?.(10);
    let response = await callBackend('generateContent', {
      model: model,
      contents: [{ parts }],
      config: {
        responseModalities: ['AUDIO'],
        ...(model.includes('tts') && {
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice as any },
            },
          },
        }),
        ...(isLyria && {
          ...(negativePrompt && { negative_prompt: negativePrompt }),
          ...(duration && { duration }),
          ...(seed !== undefined && { seed }),
          ...(temperature !== undefined && { temperature }),
          ...(topP !== undefined && { topP }),
          ...(topK !== undefined && { topK }),
          ...(guidance !== undefined && { guidance }),
          ...(bpm !== undefined && { bpm }),
          ...(density !== undefined && { density }),
          ...(brightness !== undefined && { brightness }),
          ...(scale && { scale }),
        }),
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      },
      projectId,
    }, signal);

    // Handle Long Running Operation (Lyria Pro)
    if (response.isLro) {
      const MAX_POLL_COUNT = 60; // 5 minutes max (60 * 5 seconds)
      let operation: { name: any; done: boolean; response?: any } = { name: response.operation, done: false };
      let pollCount = 0;

      while (!operation.done) {
        pollCount++;

        if (pollCount > MAX_POLL_COUNT) {
          throw new Error("Audio generation timed out after 5 minutes. Please try again.");
        }

        onProgress?.(Math.min(10 + (pollCount * 5), 90));
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (signal?.aborted) throw new Error("Audio generation cancelled");
        operation = await callBackend('getOperation', { 
          operation: operation.name,
          _audioModel: model,
          _projectId: projectId,
        }, signal);
      }
      response = operation.response;
    }

    const inlineData = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
    if (!inlineData) throw new Error("No audio generated");

    if (inlineData.storageUrl) {
      onProgress?.(100);
      return inlineData.storageUrl;
    }

    onProgress?.(100);
    return `data:audio/wav;base64,${inlineData.data}`;
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

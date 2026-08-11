import { callBackend, urlToBase64 } from './client';
import { DEFAULT_TTS_MODEL } from '../../lib/models';

const formatElapsed = (startTime: number): string => {
  const elapsed = Math.floor((Date.now() - startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export interface AudioResult {
  /** Storage URL when the project keeps assets, otherwise a data: URL. */
  url: string;
  /** Lyria only — the lyrics it wrote for the track. */
  lyrics?: string;
  /** Lyria only — its own description of the composition. */
  caption?: string;
}

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
  onProgress?: (elapsed: string) => void;
}, signal?: AbortSignal) => {
  const {
    prompt,
    model = DEFAULT_TTS_MODEL,
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

  const startTime = Date.now();

  try {
    onProgress?.('0:00');
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
        // NOTE: Lyria 3 is served by the global /interactions API, whose only
        // inputs are text and images — it accepts no sampling or musical
        // parameters. Anything the caller wants the model to honour has to be
        // expressed in the prompt itself (see describeMusicalDirection in
        // LyriaNode), so no knobs are forwarded here.
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
      const MAX_POLL_COUNT = 60;
      let operation: { name: any; done: boolean; response?: any } = { name: response.operation, done: false };
      let pollCount = 0;

      while (!operation.done) {
        pollCount++;

        if (pollCount > MAX_POLL_COUNT) {
          throw new Error("Audio generation timed out after 5 minutes. Please try again.");
        }

        onProgress?.(formatElapsed(startTime));
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

    onProgress?.(undefined);

    // Lyria 3 returns MP3 (audio/mpeg); TTS returns WAV. Trust the reported
    // type rather than assuming — a data: URL with the wrong mime can fail to
    // play depending on the browser.
    const url = inlineData.storageUrl
      ?? `data:${inlineData.mimeType || 'audio/wav'};base64,${inlineData.data}`;

    return {
      url,
      // Lyria composes lyrics and a description of what it wrote; both are
      // returned alongside the audio and are worth showing to the user.
      lyrics: typeof response.lyriaLyrics === 'string' ? response.lyriaLyrics : undefined,
      caption: typeof response.lyriaCaption === 'string' ? response.lyriaCaption : undefined,
    };
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

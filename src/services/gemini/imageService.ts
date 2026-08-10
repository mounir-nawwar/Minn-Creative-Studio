import { callBackend, urlToBase64 } from './client';

export const generateImage = async (params: {
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize?: string;
  resolution?: string;
  referenceImages?: { url: string; role: string; strength: number }[];
  seed?: number;
  guidanceStrength?: number;
  cfgScale?: number;
  projectContext?: string;
  projectId?: string;
  sampleCount?: number;
  personGeneration?: string;
  enhancePrompt?: boolean;
  addWatermark?: boolean;
  safetySetting?: string;
  candidateCount?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  mimeType?: string;
  grounding?: boolean;
  thinkingBudget?: number;
  /**
   * Prior turns, oldest first, excluding the current prompt — including any
   * images those turns carried, so a follow-up like "make it blue" edits the
   * image actually being discussed instead of generating something unrelated.
   * Only usable by the Gemini/Nano-Banana path below — Imagen 4 is a one-shot
   * text-to-image API with no conversational multi-turn support at all.
   */
  history?: { role: 'user' | 'assistant'; content: string; imageUrls?: string[] }[];
}, signal?: AbortSignal): Promise<string | string[]> => {
  const {
    prompt, model, aspectRatio, imageSize, resolution, referenceImages, seed,
    guidanceStrength, cfgScale, projectContext, projectId, sampleCount = 1,
    personGeneration, enhancePrompt, addWatermark, safetySetting,
    candidateCount, temperature, topP, topK, mimeType, grounding, thinkingBudget,
    history = [],
  } = params;

  const fullPrompt = projectContext
    ? `Project Context: ${projectContext}\n\nTask: Generate an image based on this prompt: ${prompt}`
    : prompt;

  // The Imagen branch was removed with the imagen-* models (404 on this Vertex
  // project); every image model now goes through generateContent.
  {
    const parts: any[] = [];

    if (referenceImages && referenceImages.length > 0) {
      for (const ref of referenceImages) {
        if (ref.url.startsWith('http')) {
          parts.push({ _imageUrl: ref.url });
        } else {
          const { data, mimeType } = await urlToBase64(ref.url);
          parts.push({ inlineData: { data, mimeType } });
        }
      }
    }

    parts.push({ text: fullPrompt });

    // Build conversation history once (including any images those turns
    // carried) so the model can see and edit its own prior output rather
    // than starting fresh every message.
    const historyTurns: any[] = [];
    for (const h of history) {
      const hParts: any[] = [{ text: h.content }];
      if (h.imageUrls?.length) {
        for (const url of h.imageUrls) {
          const { data, mimeType: histMimeType } = await urlToBase64(url);
          hParts.push({ inlineData: { data, mimeType: histMimeType } });
        }
      }
      historyTurns.push({ role: h.role === 'assistant' ? 'model' : 'user', parts: hParts });
    }

    try {
      const imageConfig: any = {
        aspectRatio: aspectRatio as any,
        imageSize: (resolution || imageSize) as any,
      };

      const config: any = {
        responseModalities: ['IMAGE'],
        imageConfig,
        ...(seed !== undefined && { seed }),
        ...(temperature !== undefined && { temperature }),
        ...(topP !== undefined && { topP }),
        ...(topK !== undefined && { topK }),
        ...(grounding && {
          tools: [{ googleSearchRetrieval: {} }]
        }),
        ...(thinkingBudget !== undefined && {
          thinkingConfig: { thinkingBudget }
        }),
        safetySettings: [
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      };

      // For multiple images, make multiple API calls (candidateCount not supported for images)
      const numImages = sampleCount || 1;
      const images: string[] = [];

      for (let i = 0; i < numImages; i++) {
        const response = await callBackend('generateContent', {
          model: model,
          contents: [...historyTurns, { role: 'user', parts }],
          config: {
            ...config,
            ...(seed !== undefined && numImages > 1 ? { seed: seed + i } : {}),
          },
          projectId,
        }, signal);

        const imageParts = response.candidates?.[0]?.content?.parts?.filter((p: any) => p.inlineData) || [];
        if (imageParts.length > 0) {
          const imgUrl = imageParts[0].inlineData.storageUrl
            ? imageParts[0].inlineData.storageUrl
            : `data:image/png;base64,${imageParts[0].inlineData.data}`;
          images.push(imgUrl);
        }
      }

      if (images.length === 0) {
        throw new Error("No image generated in response from API");
      }

      return images.length === 1 ? images[0] : images;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('Image generation error:', message);
      throw new Error(`Image generation failed: ${message}`);
    }
  }
};

export const generateMask = async (params: {
  prompt: string;
  imageUrl: string;
}, signal?: AbortSignal) => {
  const { prompt, imageUrl } = params;

  const { data, mimeType } = await urlToBase64(imageUrl);

  try {
    const response = await callBackend('generateContent', {
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { text: `Identify the bounding boxes for "${prompt}" in the image. Return the coordinates as [ymin, xmin, ymax, xmax] in normalized coordinates (0-1000).` },
          { inlineData: { data, mimeType } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: 'OBJECT',
          properties: {
            boxes: {
              type: 'ARRAY',
              items: {
                type: 'ARRAY',
                items: { type: 'NUMBER' }
              }
            }
          },
          required: ["boxes"]
        }
      }
    }, signal);

    const result = JSON.parse(response.text);
    return result.boxes;
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

export const upscaleImage = async (params: {
  imageUrl: string;
  scale: string;
  preserveStyle: boolean;
  projectId?: string;
  model?: string;
}, signal?: AbortSignal) => {
  const { imageUrl, scale, preserveStyle, projectId, model = 'gemini-3.1-flash-image' } = params;

  const { data, mimeType } = await urlToBase64(imageUrl);

  // The dedicated Imagen upscale path was dropped along with the imagen-* models
  // (404 on this Vertex project); everything now upscales via generateContent.
  try {
    const response = await callBackend('generateContent', {
      model: model,
      contents: {
        parts: [
          { text: `Upscale this image to ${scale}. Preserve style: ${preserveStyle}` },
          { inlineData: { data, mimeType } }
        ]
      },
      config: {
        responseModalities: ['IMAGE'],
        imageConfig: { imageSize: "4K" }
      },
      projectId,
    }, signal);

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        if (part.inlineData.storageUrl) return part.inlineData.storageUrl;
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No upscaled image returned from API");
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

export const relightImage = async (params: {
  imageUrl: string;
  lightDirection: string;
  lightColor: string;
  intensity: number;
  style: string;
  projectId?: string;
}, signal?: AbortSignal) => {
  const { imageUrl, lightDirection, lightColor, intensity, style, projectId } = params;

  const { data, mimeType } = await urlToBase64(imageUrl);

  try {
    const response = await callBackend('generateContent', {
      model: 'gemini-3.1-flash-image',
      contents: {
        parts: [
          { text: `Relight this image with light from ${lightDirection}. Light color: ${lightColor}. Intensity: ${intensity}. Style: ${style}.` },
          { inlineData: { data, mimeType } }
        ]
      },
      config: { responseModalities: ['IMAGE'] },
      projectId,
    }, signal);

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        if (part.inlineData.storageUrl) return part.inlineData.storageUrl;
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No relit image returned from API");
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

export const inpaintImage = async (params: {
  imageUrl: string;
  maskUrl: string;
  prompt: string;
  mode: 'mask' | 'unmask';
  projectId?: string;
}, signal?: AbortSignal) => {
  const { imageUrl, maskUrl, prompt, mode, projectId } = params;

  const { data: imageData, mimeType: imageMimeType } = await urlToBase64(imageUrl);
  const { data: maskData, mimeType: maskMimeType } = await urlToBase64(maskUrl);

  try {
    const response = await callBackend('generateContent', {
      model: 'gemini-3.1-flash-image',
      contents: {
        parts: [
          { text: `Inpaint this image based on the provided mask and prompt: "${prompt}". Mode: ${mode === 'mask' ? 'Fill the masked area' : 'Fill the unmasked area'}.` },
          { inlineData: { data: imageData, mimeType: imageMimeType } },
          { inlineData: { data: maskData, mimeType: maskMimeType } }
        ]
      },
      config: { responseModalities: ['IMAGE'] },
      projectId,
    }, signal);

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        if (part.inlineData.storageUrl) return part.inlineData.storageUrl;
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No inpainted image returned from API");
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

export const transferStyle = async (params: {
  contentUrl: string;
  styleUrl: string;
  strength: number;
  preserveStructure: boolean;
  projectId?: string;
}, signal?: AbortSignal) => {
  const { contentUrl, styleUrl, strength, preserveStructure, projectId } = params;

  const { data: contentData, mimeType: contentMimeType } = await urlToBase64(contentUrl);
  const { data: styleData, mimeType: styleMimeType } = await urlToBase64(styleUrl);

  try {
    const response = await callBackend('generateContent', {
      model: 'gemini-3.1-flash-image',
      contents: {
        parts: [
          { text: `Transfer the style from the style image to the content image. Strength: ${strength}. Preserve structure: ${preserveStructure}.` },
          { inlineData: { data: contentData, mimeType: contentMimeType } },
          { inlineData: { data: styleData, mimeType: styleMimeType } }
        ]
      },
      config: { responseModalities: ['IMAGE'] },
      projectId,
    }, signal);

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        if (part.inlineData.storageUrl) return part.inlineData.storageUrl;
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No styled image returned from API");
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

export const generateVariations = async (params: {
  imageUrl: string;
  prompt?: string;
  count?: number;
}, signal?: AbortSignal) => {
  const { imageUrl, prompt, count = 4 } = params;

  const { data, mimeType } = await urlToBase64(imageUrl);

  // Previously called Imagen (now 404 on this project) AND never actually sent
  // the source image, so "variations" ignored the input entirely. Each variation
  // is now a separate generateContent call seeded differently, matching how
  // generateImage() produces multiple images.
  try {
    const images: string[] = [];
    for (let i = 0; i < count; i++) {
      const response = await callBackend('generateContent', {
        model: 'gemini-3.1-flash-image',
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { data, mimeType } },
            { text: prompt || 'Generate a variation of this image, keeping the subject and style.' },
          ],
        }],
        config: { responseModalities: ['IMAGE'], seed: Math.floor(Math.random() * 1_000_000) },
      }, signal);

      const part = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
      if (part) {
        images.push(part.inlineData.storageUrl ?? `data:image/png;base64,${part.inlineData.data}`);
      }
    }

    if (images.length === 0) throw new Error('No variations returned from API');
    return images;
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

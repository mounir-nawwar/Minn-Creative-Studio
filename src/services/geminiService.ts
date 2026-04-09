import { API_BASE } from "../constants";

async function callBackend(method: string, params: any, signal?: AbortSignal) {
  const response = await fetch(`${API_BASE}/gemini/proxy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ method, params }),
    signal
  });

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok || !data.success) {
      throw new Error(data.error || 'Backend proxy call failed');
    }
    return data.data;
  } else {
    const text = await response.text();
    console.error('Non-JSON response from backend:', text.substring(0, 500));
    throw new Error(`Server returned non-JSON response (${response.status}). Check console for details.`);
  }
}

export async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
  // Firebase Storage URLs can't be fetched directly from the browser due to CORS — proxy through backend
  if (url.includes('firebasestorage.googleapis.com') || url.includes('storage.googleapis.com')) {
    const res = await fetch(`${API_BASE}/proxy-image`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) throw new Error(`Image proxy failed: ${res.status}`);
    return res.json();
  }
  const res = await fetch(url);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = (reader.result as string).split(',')[1];
      resolve({ data: base64, mimeType: blob.type });
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const generateImage = async (params: {
  prompt: string;
  model: string;
  aspectRatio: string;
  imageSize?: string;
  referenceImages?: { url: string; role: string; strength: number }[];
  seed?: number;
  guidanceStrength?: number;
  cfgScale?: number;
  projectContext?: string;
  projectId?: string;
}, signal?: AbortSignal) => {
  const { prompt, model, aspectRatio, imageSize, referenceImages, seed, guidanceStrength, cfgScale, projectContext, projectId } = params;

  const fullPrompt = projectContext 
    ? `Project Context: ${projectContext}\n\nTask: Generate an image based on this prompt: ${prompt}`
    : prompt;

  if (model.startsWith('imagen-4')) {
    try {
      const response = await callBackend('generateImages', {
        model: model,
        prompt: fullPrompt,
        config: { numberOfImages: 1, aspectRatio: aspectRatio as any },
        projectId,
      }, signal);
      const img = response.generatedImages[0].image;
      if (img.storageUrl) return img.storageUrl;
      return `data:image/png;base64,${img.imageBytes}`;
    } catch (err) {
      console.error('Gemini API Error:', err);
      throw err;
    }
  } else {
    const parts: any[] = [];
    
    if (referenceImages && referenceImages.length > 0) {
      for (const ref of referenceImages) {
        // Remote URLs (Firebase Storage etc.) → let server fetch to avoid Cloud Run 32MB body limit
        // Blob/data URLs → fetch in browser (server can't reach them)
        if (ref.url.startsWith('http')) {
          parts.push({ _imageUrl: ref.url });
        } else {
          const { data, mimeType } = await urlToBase64(ref.url);
          parts.push({ inlineData: { data, mimeType } });
        }
      }
    }
    
    parts.push({ text: fullPrompt });

    try {
      const response = await callBackend('generateContent', {
        model: model,
        contents: { parts },
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: {
            aspectRatio: aspectRatio as any,
            imageSize: imageSize as any
          },
          ...(seed !== undefined && { seed }),
          ...(guidanceStrength !== undefined && { topP: guidanceStrength / 20 }),
          ...(cfgScale !== undefined && { temperature: cfgScale / 15 }),
          safetySettings: [
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
          ],
        },
        projectId,
      }, signal);

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          if (part.inlineData.storageUrl) return part.inlineData.storageUrl;
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
      throw new Error("No image generated in response");
    } catch (err) {
      console.error('Gemini API Error:', err);
      throw err;
    }
  }
};

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
  const { prompt, model, aspectRatio, resolution, duration, sampleCount = 1, negativePrompt, seed, personGeneration, audio, resizeMode, startFrameUrl, endFrameUrl, referenceImages, motionIntensity, videoUrl, projectId, projectContext, onProgress } = params;

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

    let pollCount = 0;
    while (!operation.done) {
      pollCount++;
      // Simulate progress during polling
      const simulatedProgress = Math.min(20 + (pollCount * 5), 90);
      onProgress?.(simulatedProgress);
      
      await new Promise(resolve => setTimeout(resolve, 5000));
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
        // Server uploaded directly to Storage — return permanent URL
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

export const generateText = async (params: {
  prompt: string;
  model: string;
  systemInstruction?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  projectContext?: string;
  maxOutputTokens?: number;
}, signal?: AbortSignal) => {
  const { prompt, model, systemInstruction, imageUrls = [], videoUrls = [], projectContext, maxOutputTokens } = params;

  const fullPrompt = projectContext 
    ? `Project Context: ${projectContext}\n\nTask: ${prompt}`
    : prompt;

  const parts: any[] = [{ text: fullPrompt }];

  for (const url of imageUrls) {
    const { data, mimeType } = await urlToBase64(url);
    parts.push({ inlineData: { data, mimeType } });
  }

  for (const url of videoUrls) {
    const { data, mimeType } = await urlToBase64(url);
    parts.push({ inlineData: { data, mimeType } });
  }

  try {
    const response = await callBackend('generateContent', {
      model: model,
      contents: { parts },
      config: {
        systemInstruction,
        ...(maxOutputTokens && { maxOutputTokens }),
      }
    }, signal);

    return response.text;
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

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
    onProgress
  } = params;

  const isLyria = model.includes('lyria');
  const parts: any[] = [];

  // Add reference images for multimodal Lyria
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
      let operation = { name: response.operation, done: false };
      let pollCount = 0;
      while (!operation.done) {
        pollCount++;
        onProgress?.(Math.min(10 + (pollCount * 5), 90));
        await new Promise(resolve => setTimeout(resolve, 5000));
        if (signal?.aborted) throw new Error("Audio generation cancelled");
        operation = await callBackend('getOperation', { operation: operation.name }, signal);
      }
      response = operation.response;
    }

    const inlineData = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
    if (!inlineData) throw new Error("No audio generated");
    
    // Server-side uploaded result
    if (inlineData.storageUrl) {
      onProgress?.(100);
      return inlineData.storageUrl;
    }

    // Direct result (base64)
    onProgress?.(100);
    return `data:audio/wav;base64,${inlineData.data}`;
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
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
}, signal?: AbortSignal) => {
  const { imageUrl, scale, preserveStyle, projectId } = params;

  const { data, mimeType } = await urlToBase64(imageUrl);

  try {
    const response = await callBackend('generateContent', {
      model: 'gemini-3.1-flash-image-preview',
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

export const suggestNodeConfig = async (params: {
  nodeType: string;
  userGoal: string;
  currentConfig: any;
  projectContext?: string;
}, signal?: AbortSignal) => {
  const { nodeType, userGoal, currentConfig, projectContext } = params;

  try {
    const response = await callBackend('generateContent', {
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: `As an AI creative assistant, suggest the best configuration for a ${nodeType} node based on this goal: "${userGoal}".

      ${projectContext ? `Project Context: ${projectContext}` : ''}

      Current configuration: ${JSON.stringify(currentConfig)}

      Return ONLY a JSON object representing the updated configuration fields.` }] }],
      config: {
        responseMimeType: "application/json",
      }
    }, signal);

    return JSON.parse(response.text);
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
      model: 'gemini-3.1-flash-image-preview',
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

export const fillProjectData = async (description: string, signal?: AbortSignal) => {
  const prompt = `
    You are a creative project setup assistant for a professional AI media studio.
    The user will describe their project in natural language.
    Return a JSON object with these exact fields:
    {
      "projectType": "marketing|fashion|advertising|branding|content|product|architecture|film|events|personal",
      "projectSubtype": "string",
      "name": "string",
      "description": "string",
      "clientName": "string",
      "primaryColor": "#hexcode",
      "secondaryColor": "#hexcode",
      "accentColor": "#hexcode",
      "fontStyle": "geometric|serif|handwritten|monospace|display|mixed",
      "visualMood": ["string array from: minimal,bold,luxury,playful,dark,vibrant,soft,raw,corporate,cinematic,editorial,futuristic,natural,retro,abstract"],
      "styleKeywords": "comma separated string",
      "negativeKeywords": "comma separated string",
      "targetAudience": "string",
      "brandPersonality": ["string array from: professional,friendly,luxurious,bold,playful,minimalist,authoritative,warm,edgy,inspirational"],
      "platforms": ["string array from: instagram,tiktok,youtube,facebook,linkedin,pinterest,website,print,email,billboard"],
      "outputFormats": ["string array from: 1:1,9:16,16:9,4:5,1.91:1,A4"],
      "aiInstructions": "detailed paragraph string",
      "deliverables": "string"
    }
    Return only valid JSON, no markdown, no explanation.
    
    User Description: "${description}"
  `;

  try {
    const response = await callBackend('generateContent', {
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
      }
    }, signal);

    return JSON.parse(response.text);
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

export const generateAIInstructions = async (formData: any, signal?: AbortSignal) => {
  const prompt = `
    Generate a set of master AI instructions for a creative project with the following details:
    Project Type: ${formData.type} - ${formData.subtype}
    Project Name: ${formData.name}
    Description: ${formData.description}
    Client: ${formData.clientName}
    Visual Mood: ${formData.visualMood?.join(', ')}
    Tone: ${formData.brandPersonality}
    Target Audience: ${formData.targetAudience}
    Style Keywords: ${formData.styleKeywords}
    Negative Keywords: ${formData.negativeKeywords}
    Colors: Primary ${formData.primaryColor}, Secondary ${formData.secondaryColor}
    
    Provide a concise, professional paragraph that can be used as a system instruction for an AI creative assistant.
  `;

  try {
    const response = await callBackend('generateContent', {
      model: "gemini-3-flash-preview",
      contents: [{ role: 'user', parts: [{ text: prompt }] }]
    }, signal);

    return response.text;
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
      model: 'gemini-3.1-flash-image-preview',
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
      model: 'gemini-3.1-flash-image-preview',
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

  try {
    const response = await callBackend('generateImages', {
      model: 'imagen-4.0-generate-001',
      prompt: prompt || 'Generate variations of this image',
      config: {
        numberOfImages: count,
      },
    }, signal);

    return response.generatedImages.map((img: any) => `data:image/png;base64,${img.image.imageBytes}`);
  } catch (err) {
    console.error('Gemini API Error:', err);
    throw err;
  }
};

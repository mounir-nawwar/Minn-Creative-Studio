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
}, signal?: AbortSignal) => {
  const { prompt, model, aspectRatio, imageSize, referenceImages, seed, guidanceStrength, cfgScale, projectContext } = params;

  const fullPrompt = projectContext 
    ? `Project Context: ${projectContext}\n\nTask: Generate an image based on this prompt: ${prompt}`
    : prompt;

  if (model.startsWith('imagen-4')) {
    try {
      const response = await callBackend('generateImages', {
        model: model,
        prompt: fullPrompt,
        config: {
          numberOfImages: 1,
          aspectRatio: aspectRatio as any,
        },
      }, signal);
      const base64Image = response.generatedImages[0].image.imageBytes;
      return `data:image/png;base64,${base64Image}`;
    } catch (err) {
      console.error('Gemini API Error:', err);
      throw err;
    }
  } else {
    const parts: any[] = [];
    
    if (referenceImages && referenceImages.length > 0) {
      for (const ref of referenceImages) {
        const { data, mimeType } = await urlToBase64(ref.url);
        parts.push({
          inlineData: { data, mimeType }
        });
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
        }
      }, signal);

      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
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
  startFrameUrl?: string;
  endFrameUrl?: string;
  referenceImages?: { url: string; role: string; strength: number }[];
  motionIntensity?: number;
  videoUrl?: string;
  projectContext?: string;
  onProgress?: (progress: number) => void;
}, signal?: AbortSignal) => {
  const { prompt, model, aspectRatio, resolution, duration, startFrameUrl, endFrameUrl, referenceImages, motionIntensity, videoUrl, projectContext, onProgress } = params;

  const fullPrompt = projectContext 
    ? `Project Context: ${projectContext}\n\nTask: Generate a video based on this prompt: ${prompt}`
    : prompt;

  const videoConfig: any = {
    numberOfVideos: 1,
    aspectRatio: aspectRatio as any,
    resolution: (resolution || '720p') as any,
    duration: duration,
    motionIntensity: motionIntensity
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
    const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
    if (!downloadLink) throw new Error("No video generated");

    const videoData = await callBackend('fetchVideoFile', { url: downloadLink }, signal);
    onProgress?.(100);
    return `data:${videoData.contentType};base64,${videoData.base64}`;
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
  voice?: string;
}, signal?: AbortSignal) => {
  const { prompt, voice = 'Kore' } = params;

  try {
    const response = await callBackend('generateContent', {
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice as any },
          },
        },
      },
    }, signal);

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) throw new Error("No audio generated");
    
    return `data:audio/mpeg;base64,${base64Audio}`;
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
}, signal?: AbortSignal) => {
  const { imageUrl, scale, preserveStyle } = params;

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
        imageConfig: {
          imageSize: "4K"
        }
      }
    }, signal);

    let upscaledImageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        upscaledImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!upscaledImageUrl) {
      throw new Error("No upscaled image returned from API");
    }

    return upscaledImageUrl;
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
      contents: `As an AI creative assistant, suggest the best configuration for a ${nodeType} node based on this goal: "${userGoal}".
      
      ${projectContext ? `Project Context: ${projectContext}` : ''}
      
      Current configuration: ${JSON.stringify(currentConfig)}
      
      Return ONLY a JSON object representing the updated configuration fields.`,
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
}, signal?: AbortSignal) => {
  const { imageUrl, lightDirection, lightColor, intensity, style } = params;

  const { data, mimeType } = await urlToBase64(imageUrl);

  try {
    const response = await callBackend('generateContent', {
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          { text: `Relight this image with light from ${lightDirection}. Light color: ${lightColor}. Intensity: ${intensity}. Style: ${style}.` },
          { inlineData: { data, mimeType } }
        ]
      }
    }, signal);

    let relitImageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        relitImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!relitImageUrl) {
      throw new Error("No relit image returned from API");
    }

    return relitImageUrl;
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
}, signal?: AbortSignal) => {
  const { imageUrl, maskUrl, prompt, mode } = params;

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
      }
    }, signal);

    let inpaintedImageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        inpaintedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!inpaintedImageUrl) {
      throw new Error("No inpainted image returned from API");
    }

    return inpaintedImageUrl;
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
}, signal?: AbortSignal) => {
  const { contentUrl, styleUrl, strength, preserveStructure } = params;

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
      }
    }, signal);

    let styledImageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        styledImageUrl = `data:image/png;base64,${part.inlineData.data}`;
        break;
      }
    }

    if (!styledImageUrl) {
      throw new Error("No styled image returned from API");
    }

    return styledImageUrl;
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

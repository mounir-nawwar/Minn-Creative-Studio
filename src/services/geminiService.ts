import { GoogleGenAI, GenerateContentResponse, Modality, VideoGenerationReferenceType, Type } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in the environment.");
  }
  return new GoogleGenAI({ apiKey });
};

export async function urlToBase64(url: string): Promise<{ data: string; mimeType: string }> {
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
}) => {
  const ai = getAI();
  const { prompt, model, aspectRatio, imageSize, referenceImages, seed, guidanceStrength, cfgScale, projectContext } = params;

  const fullPrompt = projectContext 
    ? `Project Context: ${projectContext}\n\nTask: Generate an image based on this prompt: ${prompt}`
    : prompt;

  if (model.startsWith('imagen-4')) {
    const response = await ai.models.generateImages({
      model: model,
      prompt: fullPrompt,
      config: {
        numberOfImages: 1,
        aspectRatio: aspectRatio as any,
      },
    });
    const base64Image = response.generatedImages[0].image.imageBytes;
    return `data:image/png;base64,${base64Image}`;
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

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
      config: {
        imageConfig: { 
          aspectRatio: aspectRatio as any,
          imageSize: imageSize as any
        },
        seed: seed,
        topP: guidanceStrength ? guidanceStrength / 20 : undefined,
        temperature: cfgScale ? cfgScale / 15 : undefined,
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    throw new Error("No image generated in response");
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
}) => {
  const ai = getAI();
  const { prompt, model, aspectRatio, resolution, duration, startFrameUrl, endFrameUrl, referenceImages, motionIntensity, videoUrl, projectContext } = params;

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
    const { data, mimeType } = await urlToBase64(startFrameUrl);
    startFrameData = { imageBytes: data, mimeType };
  }

  if (endFrameUrl) {
    const { data, mimeType } = await urlToBase64(endFrameUrl);
    videoConfig.lastFrame = { imageBytes: data, mimeType };
  }

  if (referenceImages && referenceImages.length > 0) {
    videoConfig.referenceImages = await Promise.all(referenceImages.map(async (ref: any) => {
      const { data, mimeType } = await urlToBase64(ref.url);
      return {
        image: { imageBytes: data, mimeType },
        referenceType: VideoGenerationReferenceType.ASSET,
      };
    }));
  }

  // Handle video extension if videoUrl is provided
  let videoRef;
  if (videoUrl) {
    // Note: In a real production app, we would store the video object from the API.
    // For this demo, we can't easily pass a blob URL back as a 'video' object to the API.
    // However, Veo 3.1 supports extending a video by providing the video object.
    // If we don't have the object, we can use the last frame as a start frame.
    // For now, we'll assume the user might want to use the last frame of the input video.
  }

  let operation = await ai.models.generateVideos({
    model: model,
    prompt: fullPrompt || 'Animate this sequence',
    image: startFrameData,
    config: videoConfig
  });

  while (!operation.done) {
    await new Promise(resolve => setTimeout(resolve, 5000));
    operation = await ai.operations.getVideosOperation({ operation: operation });
  }

  const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
  if (!downloadLink) throw new Error("No video generated");

  const apiKey = process.env.GEMINI_API_KEY;
  const videoRes = await fetch(downloadLink, {
    method: 'GET',
    headers: {
      'x-goog-api-key': apiKey!,
    },
  });
  const videoBlob = await videoRes.blob();
  return URL.createObjectURL(videoBlob);
};

export const generateText = async (params: {
  prompt: string;
  model: string;
  systemInstruction?: string;
  imageUrls?: string[];
  videoUrls?: string[];
  projectContext?: string;
}) => {
  const ai = getAI();
  const { prompt, model, systemInstruction, imageUrls = [], videoUrls = [], projectContext } = params;

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

  const response = await ai.models.generateContent({
    model: model,
    contents: { parts },
    config: { systemInstruction }
  });

  return response.text;
};

export const generateAudio = async (params: {
  prompt: string;
  voice?: string;
}) => {
  const ai = getAI();
  const { prompt, voice = 'Kore' } = params;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: prompt }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: voice as any },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("No audio generated");
  
  return `data:audio/mpeg;base64,${base64Audio}`;
};

export const generateMask = async (params: {
  prompt: string;
  imageUrl: string;
}) => {
  const ai = getAI();
  const { prompt, imageUrl } = params;

  const { data, mimeType } = await urlToBase64(imageUrl);

  const response = await ai.models.generateContent({
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
        type: Type.OBJECT,
        properties: {
          boxes: {
            type: Type.ARRAY,
            items: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER }
            }
          }
        },
        required: ["boxes"]
      }
    }
  });

  const result = JSON.parse(response.text);
  return result.boxes;
};

export const upscaleImage = async (params: {
  imageUrl: string;
  scale: string;
  preserveStyle: boolean;
}) => {
  const ai = getAI();
  const { imageUrl, scale, preserveStyle } = params;

  const { data, mimeType } = await urlToBase64(imageUrl);

  const response = await ai.models.generateContent({
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
  });

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
};

export const suggestNodeConfig = async (params: {
  nodeType: string;
  userGoal: string;
  currentConfig: any;
  projectContext?: string;
}) => {
  const ai = getAI();
  const { nodeType, userGoal, currentConfig, projectContext } = params;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `As an AI creative assistant, suggest the best configuration for a ${nodeType} node based on this goal: "${userGoal}".
    
    ${projectContext ? `Project Context: ${projectContext}` : ''}
    
    Current configuration: ${JSON.stringify(currentConfig)}
    
    Return ONLY a JSON object representing the updated configuration fields.`,
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (err) {
    console.error("Failed to parse AI suggestion", err);
    return {};
  }
};

export const relightImage = async (params: {
  imageUrl: string;
  lightDirection: string;
  lightColor: string;
  intensity: number;
  style: string;
}) => {
  const ai = getAI();
  const { imageUrl, lightDirection, lightColor, intensity, style } = params;

  const { data, mimeType } = await urlToBase64(imageUrl);

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        { text: `Relight this image with light from ${lightDirection}. Light color: ${lightColor}. Intensity: ${intensity}. Style: ${style}.` },
        { inlineData: { data, mimeType } }
      ]
    }
  });

  let relitImageUrl = '';
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      relitImageUrl = `data:image/png;base64,${part.inlineData.data}`;
      break;
    }
  }

  if (!relitImageUrl) {
    throw new Error("No relit image returned from API");
  }

  return relitImageUrl;
};

export const fillProjectData = async (description: string) => {
  const ai = getAI();
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
    }
  });

  try {
    return JSON.parse(response.text);
  } catch (err) {
    console.error("Failed to parse AI project data", err);
    throw new Error("Failed to generate project data. Please try again.");
  }
};

export const generateAIInstructions = async (formData: any) => {
  const ai = getAI();
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

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });

  return response.text;
};

export const inpaintImage = async (params: {
  imageUrl: string;
  maskUrl: string;
  prompt: string;
  mode: 'mask' | 'unmask';
}) => {
  const ai = getAI();
  const { imageUrl, maskUrl, prompt, mode } = params;

  const { data: imageData, mimeType: imageMimeType } = await urlToBase64(imageUrl);
  const { data: maskData, mimeType: maskMimeType } = await urlToBase64(maskUrl);

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        { text: `Inpaint this image based on the provided mask and prompt: "${prompt}". Mode: ${mode === 'mask' ? 'Fill the masked area' : 'Fill the unmasked area'}.` },
        { inlineData: { data: imageData, mimeType: imageMimeType } },
        { inlineData: { data: maskData, mimeType: maskMimeType } }
      ]
    }
  });

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
};

export const transferStyle = async (params: {
  contentUrl: string;
  styleUrl: string;
  strength: number;
  preserveStructure: boolean;
}) => {
  const ai = getAI();
  const { contentUrl, styleUrl, strength, preserveStructure } = params;

  const { data: contentData, mimeType: contentMimeType } = await urlToBase64(contentUrl);
  const { data: styleData, mimeType: styleMimeType } = await urlToBase64(styleUrl);

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        { text: `Transfer the style from the style image to the content image. Strength: ${strength}. Preserve structure: ${preserveStructure}.` },
        { inlineData: { data: contentData, mimeType: contentMimeType } },
        { inlineData: { data: styleData, mimeType: styleMimeType } }
      ]
    }
  });

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
};

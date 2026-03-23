import express from 'express';
import { GoogleGenAI } from "@google/genai";
import { injectParameters } from '../middleware/parameterInjector.js';

const router = express.Router();

async function urlToBase64(url: string) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return {
    data: Buffer.from(buffer).toString('base64'),
    mimeType: res.headers.get('content-type') || 'image/png'
  };
}

// Image Generation (Imagen 4 / Nano Banana)
router.post('/image', async (req, res) => {
  const { prompt, referenceImages, model, config, parameters: parameterOverrides } = req.body;
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const parameters = injectParameters({}, parameterOverrides);

    if (model.startsWith('imagen-4')) {
      // Imagen 4 usually takes a single prompt and config
      // Multi-image referencing for Imagen 4 isn't explicitly in the prompt SDK examples,
      // but we'll pass the first one if available as a fallback or just the prompt.
      const response = await ai.models.generateImages({
        model: model,
        prompt: prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: config.aspectRatio,
        },
      });
      const base64Image = response.generatedImages[0].image.imageBytes;
      res.json({ image: `data:image/png;base64,${base64Image}` });
    } else {
      // Nano Banana
      const parts: any[] = [];
      
      // Add reference images as parts
      if (referenceImages && referenceImages.length > 0) {
        for (const ref of referenceImages) {
          const { data, mimeType } = await urlToBase64(ref.url);
          parts.push({
            inlineData: { data, mimeType }
          });
        }
      }
      
      // Add prompt
      parts.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: model,
        contents: { parts },
        config: {
          imageConfig: { 
            aspectRatio: config.aspectRatio,
          },
          seed: parameters.seed,
          topP: parameters.guidanceScale ? parameters.guidanceScale / 20 : undefined,
          temperature: parameters.cfgScale ? parameters.cfgScale / 15 : undefined,
        }
      });

      let imageUrl = '';
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
      res.json({ image: imageUrl });
    }
  } catch (err: any) {
    console.error('Image Gen Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Video Generation (Veo / ImageToVideo)
router.post('/video', async (req, res) => {
  const { prompt, startFrameUrl, endFrameUrl, referenceImages, model, config, parameters: parameterOverrides } = req.body;
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const parameters = injectParameters({}, parameterOverrides);

    // Duration clamping
    let duration = config.duration || 5;
    const maxDuration = model.includes('fast') ? 10 : 30;
    if (duration > maxDuration) {
      duration = maxDuration;
    }

    const videoConfig: any = {
      numberOfVideos: 1,
      aspectRatio: config.aspectRatio,
      resolution: config.resolution || '720p',
      duration: duration, // Passing duration to config
      motionIntensity: parameters.motionIntensity
    };

    // Handle Start/End Frames
    let startFrameData;
    if (startFrameUrl) {
      const { data, mimeType } = await urlToBase64(startFrameUrl);
      startFrameData = { imageBytes: data, mimeType };
    }

    let endFrameData;
    if (endFrameUrl) {
      const { data, mimeType } = await urlToBase64(endFrameUrl);
      endFrameData = { imageBytes: data, mimeType };
      videoConfig.lastFrame = endFrameData;
    }

    // Handle Reference Images
    if (referenceImages && referenceImages.length > 0) {
      videoConfig.referenceImages = await Promise.all(referenceImages.map(async (ref: any) => {
        const { data, mimeType } = await urlToBase64(ref.url);
        return {
          image: { imageBytes: data, mimeType },
          referenceType: 'ASSET', // Defaulting to ASSET as per SDK
          // Note: Roles like 'style', 'character' might be handled via prompt or specific SDK fields if available
        };
      }));
    }

    let operation = await ai.models.generateVideos({
      model: model,
      prompt: prompt || 'Animate this sequence',
      image: startFrameData,
      config: videoConfig
    });

    // Poll for completion
    while (!operation.done) {
      await new Promise(resolve => setTimeout(resolve, 5000));
      operation = await ai.operations.getVideosOperation({ operation: operation });
    }

    const videoUrl = operation.response?.generatedVideos?.[0]?.video?.uri;
    res.json({ video: videoUrl });
  } catch (err: any) {
    console.error('Video Gen Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

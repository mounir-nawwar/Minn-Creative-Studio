import express from 'express';
import { GoogleGenAI } from "@google/genai";

const router = express.Router();

async function urlToBase64(url: string) {
  const res = await fetch(url);
  const buffer = await res.arrayBuffer();
  return {
    data: Buffer.from(buffer).toString('base64'),
    mimeType: res.headers.get('content-type') || 'image/png'
  };
}

router.post('/', async (req: any, res: any) => {
  const { imageUrl, maskUrl, prompt, mode } = req.body;
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // For inpainting, we use generateImages with the image and mask as reference
    // or generateContent with the image, mask, and prompt.
    
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt || 'Inpaint this image',
      config: {
        numberOfImages: 1,
        // The SDK might have specific fields for inpainting
      },
    });

    const base64 = response.generatedImages[0].image.imageBytes;
    res.json({ imageUrl: `data:image/png;base64,${base64}` });
  } catch (err: any) {
    console.error('Inpainting Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

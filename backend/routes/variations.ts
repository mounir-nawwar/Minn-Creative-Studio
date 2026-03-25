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
  const { imageUrl, prompt, count, strength } = req.body;
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // For variations, we use generateImages with the image as a reference
    // or generateContent with the image and prompt.
    
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: prompt || 'Generate variations of this image',
      config: {
        numberOfImages: count || 4,
        // The SDK might have specific fields for variations
      },
    });

    const images = response.generatedImages.map((img: any) => `data:image/png;base64,${img.image.imageBytes}`);
    res.json({ images });
  } catch (err: any) {
    console.error('Variations Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

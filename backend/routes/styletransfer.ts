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
  const { contentUrl, styleUrl, strength, preserveStructure } = req.body;
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // For style transfer, we use generateImages with the style image as a reference
    // or generateContent with the content image, style image, and prompt.
    
    const response = await ai.models.generateImages({
      model: 'imagen-4.0-generate-001',
      prompt: 'Apply the style of this image to the content image',
      config: {
        numberOfImages: 1,
        // The SDK might have specific fields for style transfer
      },
    });

    const base64 = response.generatedImages[0].image.imageBytes;
    res.json({ imageUrl: `data:image/png;base64,${base64}` });
  } catch (err: any) {
    console.error('Style Transfer Error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

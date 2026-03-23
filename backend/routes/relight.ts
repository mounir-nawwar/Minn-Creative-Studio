import express from 'express';
import { GoogleGenAI } from "@google/genai";

const router = express.Router();

// Relight Node (Imagen Relighting)
router.post('/', async (req, res) => {
  const { imageUrl, lightDirection, lightColor, intensity, style } = req.body;
  
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // Fetch image
    const imgResponse = await fetch(imageUrl);
    const buffer = await imgResponse.arrayBuffer();
    const base64Data = Buffer.from(buffer).toString('base64');

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          { text: `Relight this image with light from ${lightDirection}. Light color: ${lightColor}. Intensity: ${intensity}. Style: ${style}.` },
          { inlineData: { data: base64Data, mimeType: 'image/png' } }
        ]
      }
    });

    // Find the image part
    let relitImageUrl = '';
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        relitImageUrl = `data:image/png;base64,${part.inlineData.data}`;
      }
    }

    res.json({ image: relitImageUrl });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

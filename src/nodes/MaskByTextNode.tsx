import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { GoogleGenAI, Type } from "@google/genai";

const MaskByTextNode = ({ id, data }: any) => {
  const [prompt, setPrompt] = useState(data.config?.prompt || 'the main subject');
  const updateNodeData = useStore((state) => state.updateNodeData);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    if (!incomingEdge) {
      updateNodeData(id, { error: "No image input connected" });
      return;
    }

    const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
    const imageUrl = sourceNode?.data?.output;

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('data:image')) {
      updateNodeData(id, { error: "Input node has no valid image output" });
      return;
    }

    updateNodeData(id, { isRunning: true, error: undefined });

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Fetch image and convert to base64
      const imgResponse = await fetch(imageUrl);
      const blob = await imgResponse.blob();
      const reader = new FileReader();
      
      const base64Data = await new Promise<string>((resolve) => {
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: `Identify the bounding boxes for "${prompt}" in the image. Return the coordinates as [ymin, xmin, ymax, xmax] in normalized coordinates (0-1000).` },
            { inlineData: { data: base64Data, mimeType: blob.type } }
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
      const boxes = result.boxes;

      if (!boxes || boxes.length === 0) {
        updateNodeData(id, { error: "No objects found matching the prompt", isRunning: false });
        return;
      }

      // Create mask from boxes
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill black background
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw white boxes
      ctx.fillStyle = 'white';
      boxes.forEach((box: number[]) => {
        const [ymin, xmin, ymax, xmax] = box;
        const x = (xmin / 1000) * canvas.width;
        const y = (ymin / 1000) * canvas.height;
        const width = ((xmax - xmin) / 1000) * canvas.width;
        const height = ((ymax - ymin) / 1000) * canvas.height;
        ctx.fillRect(x, y, width, height);
      });

      const maskUrl = canvas.toDataURL('image/png');
      updateNodeData(id, { output: maskUrl, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Mask Prompt</label>
          <input
            type="text"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-[#0097A7]"
            placeholder="e.g. 'the red car', 'the person's face'..."
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              updateNodeData(id, { config: { ...data.config, prompt: e.target.value } });
            }}
          />
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "GENERATING MASK..." : "GENERATE MASK"}
        </button>

        <canvas ref={canvasRef} className="hidden" />

        {data.output && (
          <div className="mt-2 rounded-lg overflow-hidden border border-[#2a2a2a] bg-black">
            <img src={data.output} alt="Mask" className="w-full h-auto" />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default MaskByTextNode;

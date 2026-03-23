import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { GoogleGenAI } from "@google/genai";
import { Upload, Image as ImageIcon } from 'lucide-react';

const ImageDescriberNode = ({ id, data }: any) => {
  const [imageUrl, setImageUrl] = useState(data.config?.imageUrl || '');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    let finalImageUrl = imageUrl;

    if (incomingEdge) {
      const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
      const input = sourceNode?.data?.output;
      if (typeof input === 'string' && input.startsWith('data:image')) {
        finalImageUrl = input;
      }
    }

    if (!finalImageUrl) {
      updateNodeData(id, { error: "No image input or URL provided" });
      return;
    }
    
    updateNodeData(id, { isRunning: true, error: undefined });
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // Fetch image and convert to base64
      const imgResponse = await fetch(finalImageUrl);
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
            { text: "Describe this image in detail for a creative generation prompt. Focus on lighting, composition, and mood." },
            { inlineData: { data: base64Data, mimeType: blob.type } }
          ]
        }
      });

      const description = response.text;
      updateNodeData(id, { output: description, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Image URL (Optional if input connected)</label>
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-[#0097A7]"
              placeholder="Paste image URL..."
              value={imageUrl}
              onChange={(e) => {
                setImageUrl(e.target.value);
                updateNodeData(id, { config: { ...data.config, imageUrl: e.target.value } });
              }}
            />
            <button className="p-2 bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors">
              <Upload className="w-4 h-4" />
            </button>
          </div>
        </div>

        {(imageUrl || data.output) && (
          <div className="aspect-video bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg overflow-hidden flex items-center justify-center">
            <img 
              src={imageUrl || data.output} 
              alt="Input" 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/300x200?text=Invalid+Image+URL')}
            />
          </div>
        )}

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "ANALYZING..." : "ANALYZE IMAGE"}
        </button>

        {data.output && typeof data.output === 'string' && !data.output.startsWith('data:image') && (
          <div className="mt-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Description:</p>
            <p className="text-[11px] text-gray-300 italic">"{data.output}"</p>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default ImageDescriberNode;

import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { Upload, Image as ImageIcon } from 'lucide-react';
import { generateText } from '../services/geminiService';

const ImageDescriberNode = ({ id, data }: any) => {
  const [imageUrl, setImageUrl] = useState(data.config?.imageUrl || '');
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject } = useProjectStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageUrl(result);
      updateNodeData(id, { config: { ...data.config, imageUrl: result } });
    };
    reader.readAsDataURL(file);
  };

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
      const description = await generateText({
        prompt: "Describe this image in detail for a creative generation prompt. Focus on lighting, composition, and mood.",
        model: "gemini-3-flash-preview",
        imageUrls: [finalImageUrl],
        projectId: currentProject?.id,
      });

      updateNodeData(id, { output: description, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
        />
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Image Source (URL or Upload)</label>
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
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-[#2a2a2a] rounded-lg text-gray-400 hover:text-white transition-colors"
              title="Upload Image"
            >
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

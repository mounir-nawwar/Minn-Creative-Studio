import React, { useState, useRef, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';

const LevelsNode = ({ id, data }: any) => {
  const [brightness, setBrightness] = useState(data.config?.brightness || 100);
  const [contrast, setContrast] = useState(data.config?.contrast || 100);
  const [saturation, setSaturation] = useState(data.config?.saturation || 100);
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
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageUrl;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
      ctx.drawImage(img, 0, 0);

      const processedUrl = canvas.toDataURL('image/png');
      updateNodeData(id, { output: processedUrl, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Brightness</label>
            <span className="text-[10px] text-[#0097A7]">{brightness}%</span>
          </div>
          <input 
            type="range" min="0" max="200" value={brightness}
            onChange={(e) => {
              setBrightness(Number(e.target.value));
              updateNodeData(id, { config: { ...data.config, brightness: Number(e.target.value) } });
            }}
            className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#0097A7]"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Contrast</label>
            <span className="text-[10px] text-[#0097A7]">{contrast}%</span>
          </div>
          <input 
            type="range" min="0" max="200" value={contrast}
            onChange={(e) => {
              setContrast(Number(e.target.value));
              updateNodeData(id, { config: { ...data.config, contrast: Number(e.target.value) } });
            }}
            className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#0097A7]"
          />
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Saturation</label>
            <span className="text-[10px] text-[#0097A7]">{saturation}%</span>
          </div>
          <input 
            type="range" min="0" max="200" value={saturation}
            onChange={(e) => {
              setSaturation(Number(e.target.value));
              updateNodeData(id, { config: { ...data.config, saturation: Number(e.target.value) } });
            }}
            className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#0097A7]"
          />
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "PROCESSING..." : "APPLY LEVELS"}
        </button>

        <canvas ref={canvasRef} className="hidden" />

        {data.output && (
          <div className="mt-2 rounded-lg overflow-hidden border border-[#2a2a2a]">
            <img src={data.output} alt="Processed" className="w-full h-auto" />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default LevelsNode;

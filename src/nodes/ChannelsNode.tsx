import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';

const ChannelsNode = ({ id, data }: any) => {
  const [red, setRed] = useState(data.config?.red ?? true);
  const [green, setGreen] = useState(data.config?.green ?? true);
  const [blue, setBlue] = useState(data.config?.blue ?? true);
  const [alpha, setAlpha] = useState(data.config?.alpha ?? true);
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

      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        if (!red) data[i] = 0;
        if (!green) data[i + 1] = 0;
        if (!blue) data[i + 2] = 0;
        if (!alpha) data[i + 3] = 0;
      }

      ctx.putImageData(imageData, 0, 0);

      const processedUrl = canvas.toDataURL('image/png');
      updateNodeData(id, { output: processedUrl, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" id={`red-${id}`} checked={red}
              onChange={(e) => {
                setRed(e.target.checked);
                updateNodeData(id, { config: { ...data.config, red: e.target.checked } });
              }}
              className="w-3 h-3 accent-red-500"
            />
            <label htmlFor={`red-${id}`} className="text-[10px] text-gray-400 font-bold uppercase">Red</label>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" id={`green-${id}`} checked={green}
              onChange={(e) => {
                setGreen(e.target.checked);
                updateNodeData(id, { config: { ...data.config, green: e.target.checked } });
              }}
              className="w-3 h-3 accent-green-500"
            />
            <label htmlFor={`green-${id}`} className="text-[10px] text-gray-400 font-bold uppercase">Green</label>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" id={`blue-${id}`} checked={blue}
              onChange={(e) => {
                setBlue(e.target.checked);
                updateNodeData(id, { config: { ...data.config, blue: e.target.checked } });
              }}
              className="w-3 h-3 accent-blue-500"
            />
            <label htmlFor={`blue-${id}`} className="text-[10px] text-gray-400 font-bold uppercase">Blue</label>
          </div>
          <div className="flex items-center gap-2">
            <input 
              type="checkbox" id={`alpha-${id}`} checked={alpha}
              onChange={(e) => {
                setAlpha(e.target.checked);
                updateNodeData(id, { config: { ...data.config, alpha: e.target.checked } });
              }}
              className="w-3 h-3 accent-gray-500"
            />
            <label htmlFor={`alpha-${id}`} className="text-[10px] text-gray-400 font-bold uppercase">Alpha</label>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "PROCESSING..." : "APPLY CHANNELS"}
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

export default ChannelsNode;

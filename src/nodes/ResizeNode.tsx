import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';

const ResizeNode = ({ id, data }: any) => {
  const [width, setWidth] = useState(data.config?.width || 1024);
  const [height, setHeight] = useState(data.config?.height || 1024);
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
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(img, 0, 0, width, height);

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
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Width</label>
            <input 
              type="number" value={width}
              onChange={(e) => {
                setWidth(Number(e.target.value));
                updateNodeData(id, { config: { ...data.config, width: Number(e.target.value) } });
              }}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-xs text-gray-300 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Height</label>
            <input 
              type="number" value={height}
              onChange={(e) => {
                setHeight(Number(e.target.value));
                updateNodeData(id, { config: { ...data.config, height: Number(e.target.value) } });
              }}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-xs text-gray-300 focus:outline-none"
            />
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "RESIZING..." : "APPLY RESIZE"}
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

export default ResizeNode;

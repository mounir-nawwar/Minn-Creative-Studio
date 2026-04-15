import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';

const BlurNode = ({ id, data }: any) => {
  const [blur, setBlur] = useState(data.config?.blur || 5);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setExpandedAsset } = useAssetExpand();

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

      ctx.filter = `blur(${blur}px)`;
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
            <label className="text-[10px] text-gray-500 uppercase font-bold">Blur Radius</label>
            <span className="text-[10px] text-[#0097A7]">{blur}px</span>
          </div>
          <input 
            type="range" min="0" max="50" value={blur}
            onChange={(e) => {
              setBlur(Number(e.target.value));
              updateNodeData(id, { config: { ...data.config, blur: Number(e.target.value) } });
            }}
            className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#0097A7]"
          />
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "BLURRING..." : "APPLY BLUR"}
        </button>

        <canvas ref={canvasRef} className="hidden" />

        {data.output && (
          <ExpandableAssetWrapper
            onClick={() => setExpandedAsset(data.output, 'image')}
            type="image"
          >
            <img src={data.output} alt="Processed" className="w-full h-auto" />
          </ExpandableAssetWrapper>
        )}
      </div>
    </BaseNode>
  );
};

export default BlurNode;

import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';

const CompositorNode = ({ id, data }: any) => {
  const [opacity, setOpacity] = useState(data.config?.opacity || 100);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setExpandedAsset } = useAssetExpand();

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdges = state.edges.filter(e => e.target === id);
    
    const backgroundEdge = incomingEdges.find(e => e.targetHandle === 'background');
    const foregroundEdge = incomingEdges.find(e => e.targetHandle === 'foreground');

    if (!backgroundEdge || !foregroundEdge) {
      updateNodeData(id, { error: "Both Background and Foreground inputs must be connected" });
      return;
    }

    const bgNode = state.nodes.find(n => n.id === backgroundEdge.source);
    const fgNode = state.nodes.find(n => n.id === foregroundEdge.source);

    const bgUrl = bgNode?.data?.output;
    const fgUrl = fgNode?.data?.output;

    if (!bgUrl || !fgUrl) {
      updateNodeData(id, { error: "Both inputs must have valid image output" });
      return;
    }

    updateNodeData(id, { isRunning: true, error: undefined });

    try {
      const bgImg = new Image();
      bgImg.crossOrigin = "anonymous";
      bgImg.src = bgUrl;
      await new Promise((resolve, reject) => {
        bgImg.onload = resolve;
        bgImg.onerror = reject;
      });

      const fgImg = new Image();
      fgImg.crossOrigin = "anonymous";
      fgImg.src = fgUrl;
      await new Promise((resolve, reject) => {
        fgImg.onload = resolve;
        fgImg.onerror = reject;
      });

      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.width = bgImg.width;
      canvas.height = bgImg.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw background
      ctx.drawImage(bgImg, 0, 0);

      // Draw foreground with opacity
      ctx.globalAlpha = opacity / 100;
      ctx.drawImage(fgImg, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1.0;

      const processedUrl = canvas.toDataURL('image/png');
      updateNodeData(id, { output: processedUrl, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun} className="border-indigo-500">
      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#444]" />
            <span className="text-[10px] text-gray-500 font-bold uppercase">Background</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#0097A7]" />
            <span className="text-[10px] text-gray-500 font-bold uppercase">Foreground</span>
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex justify-between">
            <label className="text-[10px] text-gray-500 uppercase font-bold">FG Opacity</label>
            <span className="text-[10px] text-[#0097A7]">{opacity}%</span>
          </div>
          <input 
            type="range" min="0" max="100" value={opacity}
            onChange={(e) => {
              setOpacity(Number(e.target.value));
              updateNodeData(id, { config: { ...data.config, opacity: Number(e.target.value) } });
            }}
            className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#0097A7]"
          />
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "COMPOSITING..." : "COMPOSITE"}
        </button>

        <canvas ref={canvasRef} className="hidden" />

        {data.output && (
          <div className="mt-2 rounded-lg overflow-hidden border border-[#2a2a2a] bg-black">
            <ExpandableAssetWrapper
              onClick={() => setExpandedAsset(data.output, 'image')}
              type="image"
            >
              <img src={data.output} alt="Processed" className="w-full h-auto" />
            </ExpandableAssetWrapper>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default CompositorNode;

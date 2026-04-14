import React, { useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';

const MergeAlphaNode = ({ id, data }: any) => {
  const updateNodeData = useStore((state) => state.updateNodeData);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdges = state.edges.filter(e => e.target === id);
    
    const rgbEdge = incomingEdges.find(e => e.targetHandle === 'image');
    const alphaEdge = incomingEdges.find(e => e.targetHandle === 'mask');

    if (!rgbEdge || !alphaEdge) {
      updateNodeData(id, { error: "Both Image and Mask inputs must be connected" });
      return;
    }

    const rgbNode = state.nodes.find(n => n.id === rgbEdge.source);
    const alphaNode = state.nodes.find(n => n.id === alphaEdge.source);

    const rgbUrl = rgbNode?.data?.output;
    const alphaUrl = alphaNode?.data?.output;

    if (!rgbUrl || !alphaUrl) {
      updateNodeData(id, { error: "Both inputs must have valid image output" });
      return;
    }

    updateNodeData(id, { isRunning: true, error: undefined });

    try {
      const rgbImg = new Image();
      rgbImg.crossOrigin = "anonymous";
      rgbImg.src = rgbUrl;
      await new Promise((resolve, reject) => {
        rgbImg.onload = resolve;
        rgbImg.onerror = reject;
      });

      const alphaImg = new Image();
      alphaImg.crossOrigin = "anonymous";
      alphaImg.src = alphaUrl;
      await new Promise((resolve, reject) => {
        alphaImg.onload = resolve;
        alphaImg.onerror = reject;
      });

      const canvas = canvasRef.current;
      if (!canvas) return;
      
      canvas.width = rgbImg.width;
      canvas.height = rgbImg.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw RGB image
      ctx.drawImage(rgbImg, 0, 0);
      const rgbData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Draw Alpha image to a temporary canvas to get its data
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const tempCtx = tempCanvas.getContext('2d');
      if (!tempCtx) return;
      tempCtx.drawImage(alphaImg, 0, 0, canvas.width, canvas.height);
      const alphaData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);

      // Merge alpha
      for (let i = 0; i < rgbData.data.length; i += 4) {
        // Use the average of RGB as alpha value
        const alphaVal = (alphaData.data[i] + alphaData.data[i + 1] + alphaData.data[i + 2]) / 3;
        rgbData.data[i + 3] = alphaVal;
      }

      ctx.putImageData(rgbData, 0, 0);

      const processedUrl = canvas.toDataURL('image/png');
      updateNodeData(id, { output: processedUrl, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun} className="border-pink-500">
      <div className="space-y-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#0097A7]" />
            <span className="text-[10px] text-gray-500 font-bold uppercase">Image (RGB)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-gray-500" />
            <span className="text-[10px] text-gray-500 font-bold uppercase">Mask (Alpha)</span>
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "MERGING..." : "MERGE ALPHA"}
        </button>

        <canvas ref={canvasRef} className="hidden" />

        {data.output && (
          <div className="mt-2 rounded-lg overflow-hidden border border-[#2a2a2a] bg-black">
            <img src={data.output} alt="Processed" className="w-full h-auto" />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default MergeAlphaNode;

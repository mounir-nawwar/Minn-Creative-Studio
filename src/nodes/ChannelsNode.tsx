import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { RunButton } from './ui';

const ChannelsNode = ({ id, data }: any) => {
  const [red, setRed] = useState(data.config?.red ?? true);
  const [green, setGreen] = useState(data.config?.green ?? true);
  const [blue, setBlue] = useState(data.config?.blue ?? true);
  const [alpha, setAlpha] = useState(data.config?.alpha ?? true);
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
          {([
            ['red', red, setRed, 'accent-red-500', 'Red'],
            ['green', green, setGreen, 'accent-green-500', 'Green'],
            ['blue', blue, setBlue, 'accent-blue-500', 'Blue'],
            ['alpha', alpha, setAlpha, 'accent-gray-400', 'Alpha'],
          ] as const).map(([key, val, setter, accent, label]) => (
            <label key={key} htmlFor={`${key}-${id}`} className="flex cursor-pointer items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2 ring-1 ring-white/10">
              <input
                type="checkbox"
                id={`${key}-${id}`}
                checked={val}
                onChange={(e) => { setter(e.target.checked); updateNodeData(id, { config: { ...data.config, [key]: e.target.checked } }); }}
                className={`h-3.5 w-3.5 ${accent}`}
              />
              <span className="text-[11px] text-gray-300">{label}</span>
            </label>
          ))}
        </div>

        <RunButton onClick={handleRun} running={data.isRunning}>{data.isRunning ? 'Processing…' : 'Apply channels'}</RunButton>

        <canvas ref={canvasRef} className="hidden" />

        {data.output && (
          <ExpandableAssetWrapper onClick={() => setExpandedAsset(data.output, 'image')} type="image">
            <img src={data.output} alt="Processed" className="h-auto w-full" />
          </ExpandableAssetWrapper>
        )}
      </div>
    </BaseNode>
  );
};

export default ChannelsNode;

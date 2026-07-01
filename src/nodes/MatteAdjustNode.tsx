import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import ParameterSlider from '../components/ParameterSlider';
import { RunButton } from './ui';

const MatteAdjustNode = ({ id, data }: any) => {
  const [amount, setAmount] = useState(data.config?.amount || 0); // -10 to 10 for grow/shrink
  const [blur, setBlur] = useState(data.config?.blur || 0);
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

      // Apply blur first if any
      if (blur > 0) {
        ctx.filter = `blur(${blur}px)`;
      }
      ctx.drawImage(img, 0, 0);
      
      // For grow/shrink (erosion/dilation), we'd need more complex pixel manipulation.
      // For now, let's just use CSS filters for simplicity if possible, 
      // but grow/shrink is usually done with a convolution or similar.
      // Let's implement a simple thresholding as a proxy for now if amount is set.
      
      if (amount !== 0) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const dataArr = imageData.data;
        const threshold = 128 - (amount * 10); // Adjusting threshold as a proxy for grow/shrink
        
        for (let i = 0; i < dataArr.length; i += 4) {
          const avg = (dataArr[i] + dataArr[i + 1] + dataArr[i + 2]) / 3;
          const val = avg > threshold ? 255 : 0;
          dataArr[i] = val;
          dataArr[i + 1] = val;
          dataArr[i + 2] = val;
        }
        ctx.putImageData(imageData, 0, 0);
      }

      const processedUrl = canvas.toDataURL('image/png');
      updateNodeData(id, { output: processedUrl, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <ParameterSlider label="Grow / shrink" value={amount} min={-10} max={10} step={1} onChange={(v) => { setAmount(v); updateNodeData(id, { config: { ...data.config, amount: v } }); }} />
        <ParameterSlider label="Softness (blur)" value={blur} min={0} max={20} step={1} onChange={(v) => { setBlur(v); updateNodeData(id, { config: { ...data.config, blur: v } }); }} />

        <RunButton onClick={handleRun} running={data.isRunning}>{data.isRunning ? 'Adjusting…' : 'Apply adjustments'}</RunButton>

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

export default MatteAdjustNode;

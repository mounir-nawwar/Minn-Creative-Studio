import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { generateMask } from '../services/geminiService';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { NodeField, NodeInput, RunButton } from './ui';

const MaskByTextNode = ({ id, data }: any) => {
  const [prompt, setPrompt] = useState(data.config?.prompt || 'the main subject');
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
      const boxes = await generateMask({
        prompt,
        imageUrl
      });

      if (!boxes || boxes.length === 0) {
        updateNodeData(id, { error: "No objects found matching the prompt", isRunning: false });
        return;
      }

      // Create mask from boxes
      const img = new Image();
      img.src = imageUrl;
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Fill black background
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw white boxes
      ctx.fillStyle = 'white';
      boxes.forEach((box: number[]) => {
        const [ymin, xmin, ymax, xmax] = box;
        const x = (xmin / 1000) * canvas.width;
        const y = (ymin / 1000) * canvas.height;
        const width = ((xmax - xmin) / 1000) * canvas.width;
        const height = ((ymax - ymin) / 1000) * canvas.height;
        ctx.fillRect(x, y, width, height);
      });

      const maskUrl = canvas.toDataURL('image/png');
      updateNodeData(id, { output: maskUrl, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Mask prompt">
          <NodeInput
            type="text"
            placeholder="e.g. 'the red car', 'the person's face'…"
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); updateNodeData(id, { config: { ...data.config, prompt: e.target.value } }); }}
          />
        </NodeField>

        <RunButton onClick={handleRun} running={data.isRunning}>{data.isRunning ? 'Generating mask…' : 'Generate mask'}</RunButton>

        <canvas ref={canvasRef} className="hidden" />

        {data.output && (
          <ExpandableAssetWrapper onClick={() => setExpandedAsset(data.output, 'image')} type="image">
            <img src={data.output} alt="Mask" className="h-auto w-full" />
          </ExpandableAssetWrapper>
        )}
      </div>
    </BaseNode>
  );
};

export default MaskByTextNode;

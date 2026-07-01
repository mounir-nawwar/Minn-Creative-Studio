import { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import ParameterSlider from '../components/ParameterSlider';
import { RunButton } from './ui';

const BlurNode = ({ id, data }: any) => {
  const [blur, setBlur] = useState(data.config?.blur || 5);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { setExpandedAsset } = useAssetExpand();

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find((e) => e.target === id);
    if (!incomingEdge) { updateNodeData(id, { error: 'No image input connected' }); return; }
    const sourceNode = state.nodes.find((n) => n.id === incomingEdge.source);
    const imageUrl = sourceNode?.data?.output;
    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('data:image')) {
      updateNodeData(id, { error: 'Input node has no valid image output' });
      return;
    }
    updateNodeData(id, { isRunning: true, error: undefined });
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.filter = `blur(${blur}px)`;
      ctx.drawImage(img, 0, 0);
      updateNodeData(id, { output: canvas.toDataURL('image/png'), isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <ParameterSlider
          label="Blur radius"
          value={blur}
          min={0}
          max={50}
          onChange={(v) => { setBlur(v); updateNodeData(id, { config: { ...data.config, blur: v } }); }}
        />

        <RunButton onClick={handleRun} running={data.isRunning}>{data.isRunning ? 'Blurring…' : 'Apply blur'}</RunButton>

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

export default BlurNode;

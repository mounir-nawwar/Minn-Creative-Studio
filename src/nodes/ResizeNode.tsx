import { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { NodeField, NodeInput, RunButton } from './ui';

const ResizeNode = ({ id, data }: any) => {
  const [width, setWidth] = useState(data.config?.width || 1024);
  const [height, setHeight] = useState(data.config?.height || 1024);
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
          <NodeField label="Width">
            <NodeInput type="number" value={width} onChange={(e) => { setWidth(Number(e.target.value)); updateNodeData(id, { config: { ...data.config, width: Number(e.target.value) } }); }} />
          </NodeField>
          <NodeField label="Height">
            <NodeInput type="number" value={height} onChange={(e) => { setHeight(Number(e.target.value)); updateNodeData(id, { config: { ...data.config, height: Number(e.target.value) } }); }} />
          </NodeField>
        </div>

        <RunButton onClick={handleRun} running={data.isRunning}>{data.isRunning ? 'Resizing…' : 'Apply resize'}</RunButton>

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

export default ResizeNode;

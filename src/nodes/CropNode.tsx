import { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { NodeField, NodeSelect, RunButton } from './ui';

const CropNode = ({ id, data }: any) => {
  const [aspectRatio, setAspectRatio] = useState(data.config?.aspectRatio || '1:1');
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
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      let targetWidth, targetHeight;
      const [ratioW, ratioH] = aspectRatio.split(':').map(Number);
      const ratio = ratioW / ratioH;

      if (img.width / img.height > ratio) {
        targetHeight = img.height;
        targetWidth = img.height * ratio;
      } else {
        targetWidth = img.width;
        targetHeight = img.width / ratio;
      }

      canvas.width = targetWidth;
      canvas.height = targetHeight;

      const offsetX = (img.width - targetWidth) / 2;
      const offsetY = (img.height - targetHeight) / 2;

      ctx.drawImage(img, offsetX, offsetY, targetWidth, targetHeight, 0, 0, targetWidth, targetHeight);

      const processedUrl = canvas.toDataURL('image/png');
      updateNodeData(id, { output: processedUrl, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Aspect ratio">
          <NodeSelect value={aspectRatio} onChange={(e) => { setAspectRatio(e.target.value); updateNodeData(id, { config: { ...data.config, aspectRatio: e.target.value } }); }}>
            <option value="1:1">1:1 Square</option>
            <option value="16:9">16:9 Landscape</option>
            <option value="9:16">9:16 Portrait</option>
            <option value="4:3">4:3 Classic</option>
            <option value="21:9">21:9 Ultrawide</option>
          </NodeSelect>
        </NodeField>

        <RunButton onClick={handleRun} running={data.isRunning}>{data.isRunning ? 'Cropping…' : 'Apply crop'}</RunButton>

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

export default CropNode;

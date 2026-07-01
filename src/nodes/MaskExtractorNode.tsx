import React, { useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { RunButton } from './ui';

const MaskExtractorNode = ({ id, data }: any) => {
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
      const dataArr = imageData.data;

      for (let i = 0; i < dataArr.length; i += 4) {
        const alpha = dataArr[i + 3];
        dataArr[i] = alpha;     // R
        dataArr[i + 1] = alpha; // G
        dataArr[i + 2] = alpha; // B
        dataArr[i + 3] = 255;   // A (fully opaque grayscale)
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
        <p className="text-[11px] leading-relaxed text-gray-500">Extracts the alpha channel of the input image as a grayscale mask.</p>
        <RunButton onClick={handleRun} running={data.isRunning}>{data.isRunning ? 'Extracting…' : 'Extract mask'}</RunButton>

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

export default MaskExtractorNode;

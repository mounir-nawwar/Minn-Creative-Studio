import React, { useState, useRef, useEffect } from 'react';
import { MousePointer2, Undo2, Square, Download } from 'lucide-react';
import { inpaintImage } from '../services/geminiService';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { useAssets } from '../hooks/useAssets';
import { downloadFile } from '../lib/utils';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';

const InpaintingNode = ({ data, id }: any) => {
  const [prompt, setPrompt] = useState(data.config?.prompt || '');
  const [mode, setMode] = useState<'mask' | 'unmask'>(data.config?.mode || 'mask');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject, uploadEnabled } = useProjectStore();
  const { addAsset } = useAssets();
  const { setExpandedAsset } = useAssetExpand();

  const findInputImage = (): string | undefined => {
    const edge = useStore.getState().edges.find(e => e.target === id);
    const sourceNode = useStore.getState().nodes.find(n => n.id === edge?.source);
    return sourceNode?.data?.output || sourceNode?.data?.outputs?.[0] || data.config?.imageUrl;
  };

  useEffect(() => {
    const imageUrl = findInputImage();

    if (canvasRef.current && imageUrl) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 320, 180);
        };
      }
    }
  }, [id, data.config?.imageUrl]);

  const startDrawing = (e: React.MouseEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) ctx.beginPath();
    }
  };

  const draw = (e: React.MouseEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineWidth = 20;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearMask = () => {
    const imageUrl = findInputImage();

    if (canvasRef.current && imageUrl) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        img.onload = () => {
          ctx.clearRect(0, 0, 320, 180);
          ctx.drawImage(img, 0, 0, 320, 180);
        };
      }
    }
  };

  const handleRun = async () => {
    const imageUrl = findInputImage();

    if (!imageUrl || !canvasRef.current) {
      updateNodeData(id, { error: "No image input connected" });
      return;
    }

    updateNodeData(id, { isRunning: true, error: undefined, progress: 10 });
    
    try {
      // Get mask from canvas
      const maskData = canvasRef.current.toDataURL('image/png');
      
      updateNodeData(id, { progress: 30 });
      const resultUrl = await inpaintImage({
        imageUrl: imageUrl,
        maskUrl: maskData,
        prompt,
        mode,
        projectId: uploadEnabled ? currentProject?.id : undefined
      });

      updateNodeData(id, { output: resultUrl, isRunning: false, progress: 100 });

      // Add to Assets grid
      if (resultUrl) {
        addAsset({
          name: `Inpainted Image - ${new Date().toLocaleTimeString()}`,
          type: 'image',
          url: resultUrl,
          thumbnailUrl: resultUrl,
          tags: ['generated', 'image', 'inpainting']
        });
      }
    } catch (err: any) {
      console.error('Inpainting Error:', err);
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun} className="border-pink-500">
      <div className="space-y-4">
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden cursor-crosshair group border border-white/10">
          <canvas
            ref={canvasRef}
            width={320}
            height={180}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            className="w-full h-full object-cover"
          />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={clearMask} className="p-1.5 bg-black/60 hover:bg-black/80 rounded text-white border border-white/10">
              <Undo2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-black/40 rounded-lg border border-white/5">
          <button
            onClick={() => {
              setMode('mask');
              updateNodeData(id, { config: { ...data.config, mode: 'mask' } });
            }}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
              mode === 'mask' ? 'bg-[#ec4899] text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Square className="w-3 h-3" /> Masked
          </button>
          <button
            onClick={() => {
              setMode('unmask');
              updateNodeData(id, { config: { ...data.config, mode: 'unmask' } });
            }}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
              mode === 'unmask' ? 'bg-[#ec4899] text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <MousePointer2 className="w-3 h-3" /> Unmasked
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500 uppercase font-bold">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              updateNodeData(id, { config: { ...data.config, prompt: e.target.value } });
            }}
            placeholder="Describe what to fill in..."
            className="w-full bg-black/60 border border-white/10 rounded-lg p-2 text-xs text-white h-16 focus:outline-none focus:border-[#ec4899]/50 resize-none"
          />
        </div>

        {data.output && (
          <div className="pt-2 border-t border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Result Image</span>
              <button 
                onClick={() => downloadFile(data.output, `inpainted-${Date.now()}.png`)}
                className="p-1.5 bg-[#1a1a1a] hover:bg-[#ec4899] text-gray-400 hover:text-white rounded-lg transition-all border border-white/10"
              >
                <Download className="w-3 h-3" />
              </button>
            </div>
            <div className="aspect-video bg-black rounded-lg overflow-hidden border border-white/10">
              <ExpandableAssetWrapper
                onClick={() => setExpandedAsset(data.output, 'image')}
                type="image"
              >
                <img src={data.output} alt="Inpainted Result" className="w-full h-full object-cover" />
              </ExpandableAssetWrapper>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default InpaintingNode;

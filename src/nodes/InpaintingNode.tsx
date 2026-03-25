import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { Eraser, Loader2, Sparkles, MousePointer2, Undo2, Square } from 'lucide-react';
import { inpaintImage } from '../services/geminiService';

const InpaintingNode = ({ data, id }: any) => {
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState<'mask' | 'unmask'>('mask');
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  useEffect(() => {
    if (canvasRef.current && data.imageUrl) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = data.imageUrl;
        img.onload = () => {
          ctx.drawImage(img, 0, 0, 320, 180);
        };
      }
    }
  }, [data.imageUrl]);

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
    if (canvasRef.current && data.imageUrl) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = data.imageUrl;
        img.onload = () => {
          ctx.clearRect(0, 0, 320, 180);
          ctx.drawImage(img, 0, 0, 320, 180);
        };
      }
    }
  };

  const handleGenerate = async () => {
    if (!data.imageUrl || !canvasRef.current) return;
    setIsGenerating(true);
    try {
      // Get mask from canvas
      const maskData = canvasRef.current.toDataURL('image/png');
      
      const resultUrl = await inpaintImage({
        imageUrl: data.imageUrl,
        maskUrl: maskData,
        prompt,
        mode
      });
      setOutputUrl(resultUrl);
    } catch (err) {
      console.error('Inpainting Error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden min-w-[320px] shadow-2xl">
      <div className="bg-zinc-900/50 p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eraser className="w-4 h-4 text-pink-500" />
          <span className="text-xs font-medium text-zinc-200 uppercase tracking-wider">Inpainting</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="relative aspect-video bg-black rounded-lg overflow-hidden cursor-crosshair group">
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
            <button onClick={clearMask} className="p-1.5 bg-black/60 hover:bg-black/80 rounded text-white">
              <Undo2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex gap-2 p-1 bg-zinc-900 rounded-lg border border-zinc-800">
          <button
            onClick={() => setMode('mask')}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
              mode === 'mask' ? 'bg-pink-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Square className="w-3 h-3" /> Inpaint Masked
          </button>
          <button
            onClick={() => setMode('unmask')}
            className={`flex-1 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1 ${
              mode === 'unmask' ? 'bg-pink-500 text-white' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <MousePointer2 className="w-3 h-3" /> Inpaint Unmasked
          </button>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-tighter">Prompt</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe what to fill in..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white h-16 focus:outline-none focus:border-pink-500/50 resize-none"
          />
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !data.imageUrl}
          className="w-full py-3 bg-pink-600 hover:bg-pink-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-white text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isGenerating ? 'Generating...' : 'Inpaint'}
        </button>

        {outputUrl && (
          <div className="pt-4 border-t border-zinc-800">
            <label className="text-[10px] text-zinc-500 uppercase tracking-tighter">Result</label>
            <div className="mt-2 aspect-video bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
              <img src={outputUrl} alt="Inpainted Result" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} id="imageUrl" style={{ background: '#ec4899' }} />
      <Handle type="source" position={Position.Right} id="output" style={{ background: '#ec4899' }} />
    </div>
  );
};

export default InpaintingNode;

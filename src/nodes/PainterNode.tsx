import React, { useState, useRef, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Eraser, Pencil, Trash2 } from 'lucide-react';

const PainterNode = ({ id, data }: any) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState(data.config?.color || '#0097A7');
  const [brushSize, setBrushSize] = useState(data.config?.brushSize || 5);
  const [mode, setMode] = useState<'draw' | 'erase'>('draw');
  const updateNodeData = useStore((state) => state.updateNodeData);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = 300;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctxRef.current = ctx;

    // Load existing output if any
    if (data.output) {
      const img = new Image();
      img.src = data.output;
      img.onload = () => ctx.drawImage(img, 0, 0);
    } else {
      ctx.fillStyle = 'transparent';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    ctxRef.current?.beginPath();
    save();
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !ctxRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    
    let x, y;
    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    // Scale coordinates to internal canvas resolution
    x = (x / rect.width) * canvas.width;
    y = (y / rect.height) * canvas.height;

    ctxRef.current.strokeStyle = mode === 'erase' ? 'rgba(0,0,0,1)' : color;
    ctxRef.current.globalCompositeOperation = mode === 'erase' ? 'destination-out' : 'source-over';
    ctxRef.current.lineWidth = brushSize;

    ctxRef.current.lineTo(x, y);
    ctxRef.current.stroke();
    ctxRef.current.beginPath();
    ctxRef.current.moveTo(x, y);
  };

  const save = () => {
    if (!canvasRef.current) return;
    const url = canvasRef.current.toDataURL('image/png');
    updateNodeData(id, { output: url });
  };

  const clear = () => {
    if (!ctxRef.current || !canvasRef.current) return;
    ctxRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    save();
  };

  return (
    <BaseNode id={id} data={data} inputs={false}>
      <div className="space-y-3">
        <div className="flex gap-2 p-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
          <button
            onClick={() => setMode('draw')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${mode === 'draw' ? 'bg-[#0097A7] text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Pencil className="w-3 h-3" />
            DRAW
          </button>
          <button
            onClick={() => setMode('erase')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${mode === 'erase' ? 'bg-[#0097A7] text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Eraser className="w-3 h-3" />
            ERASE
          </button>
          <button
            onClick={clear}
            className="p-1.5 text-gray-500 hover:text-red-500 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Color</label>
            <input 
              type="color" value={color}
              onChange={(e) => {
                setColor(e.target.value);
                updateNodeData(id, { config: { ...data.config, color: e.target.value } });
              }}
              className="w-full h-8 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg cursor-pointer p-1"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Size: {brushSize}px</label>
            <input 
              type="range" min="1" max="50" value={brushSize}
              onChange={(e) => {
                setBrushSize(Number(e.target.value));
                updateNodeData(id, { config: { ...data.config, brushSize: Number(e.target.value) } });
              }}
              className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#0097A7] mt-3"
            />
          </div>
        </div>

        <div className="aspect-square bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg overflow-hidden relative cursor-crosshair touch-none">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="w-full h-full"
          />
        </div>

        <p className="text-[9px] text-gray-600 text-center italic">Draw a mask or sketch to use as input.</p>
      </div>
    </BaseNode>
  );
};

export default PainterNode;

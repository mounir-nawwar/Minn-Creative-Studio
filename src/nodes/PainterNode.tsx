import React, { useState, useRef, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Eraser, Pencil, Trash2 } from 'lucide-react';
import { NodeField, NodeLabel } from './ui';

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
        <div className="flex gap-1 rounded-lg bg-black/30 p-1 ring-1 ring-white/10">
          <button
            onClick={() => setMode('draw')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-medium transition-[color,background-color] duration-150 ${mode === 'draw' ? 'bg-[#0097A7] text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Pencil className="h-3 w-3" /> Draw
          </button>
          <button
            onClick={() => setMode('erase')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[11px] font-medium transition-[color,background-color] duration-150 ${mode === 'erase' ? 'bg-[#0097A7] text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Eraser className="h-3 w-3" /> Erase
          </button>
          <button onClick={clear} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 transition-colors hover:text-red-400" title="Clear">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NodeField label="Color">
            <input
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); updateNodeData(id, { config: { ...data.config, color: e.target.value } }); }}
              className="h-9 w-full cursor-pointer rounded-lg bg-black/30 p-1 ring-1 ring-white/10"
            />
          </NodeField>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <NodeLabel>Brush size</NodeLabel>
              <span className="text-[11px] font-medium tabular-nums text-[#0097A7]">{brushSize}px</span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              value={brushSize}
              onChange={(e) => { setBrushSize(Number(e.target.value)); updateNodeData(id, { config: { ...data.config, brushSize: Number(e.target.value) } }); }}
              className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10"
              style={{ accentColor: '#0097A7' }}
            />
          </div>
        </div>

        <div className="relative aspect-square cursor-crosshair touch-none overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
          <canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
            className="h-full w-full"
          />
        </div>

        <p className="text-center text-[10px] text-gray-600">Draw a mask or sketch to use as input.</p>
      </div>
    </BaseNode>
  );
};

export default PainterNode;

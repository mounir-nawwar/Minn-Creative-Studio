import React, { useState, useRef, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { Maximize2, Minimize2, Split } from 'lucide-react';

const CompareNode = ({ data }: any) => {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const pos = ((x - rect.left) / rect.width) * 100;
    setSliderPos(Math.max(0, Math.min(100, pos)));
  };

  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchend', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, []);

  const renderMedia = (url: string, label: string) => {
    if (!url) return <div className="flex items-center justify-center h-full bg-zinc-900 text-zinc-500 text-xs italic">No {label}</div>;
    const isVideo = url.match(/\.(mp4|webm|ogg)$/) || url.includes('video');
    
    if (isVideo) {
      return (
        <video 
          src={url} 
          autoPlay 
          loop 
          muted 
          playsInline
          className="w-full h-full object-cover"
        />
      );
    }
    return <img src={url} alt={label} className="w-full h-full object-cover" referrerPolicy="no-referrer" />;
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden min-w-[320px] shadow-2xl">
      <div className="bg-zinc-900/50 p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Split className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-medium text-zinc-200 uppercase tracking-wider">Compare</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div 
          ref={containerRef}
          className="relative aspect-video bg-black rounded-lg overflow-hidden cursor-col-resize select-none"
          onMouseMove={handleMouseMove}
          onTouchMove={handleMouseMove}
          onMouseDown={handleMouseDown}
          onTouchStart={handleMouseDown}
        >
          {/* Image B (Background) */}
          <div className="absolute inset-0">
            {renderMedia(data.inputB, 'B')}
            <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/50 rounded text-[10px] text-white font-bold">B</div>
          </div>

          {/* Image A (Foreground with Clip) */}
          <div 
            className="absolute inset-0 overflow-hidden"
            style={{ width: `${sliderPos}%` }}
          >
            <div className="absolute inset-0 w-[320px] aspect-video">
               {/* We need to ensure the inner content doesn't shrink with the container */}
               <div style={{ width: containerRef.current?.clientWidth || 320, height: containerRef.current?.clientHeight || 180 }}>
                {renderMedia(data.inputA, 'A')}
               </div>
            </div>
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-orange-500/80 rounded text-[10px] text-white font-bold">A</div>
          </div>

          {/* Slider Line */}
          <div 
            className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_10px_rgba(0,0,0,0.5)] z-10"
            style={{ left: `${sliderPos}%` }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg border-4 border-zinc-900">
              <Split className="w-4 h-4 text-zinc-900" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
           <div className="text-[10px] text-zinc-500 uppercase tracking-tighter">Input A (Left)</div>
           <div className="text-[10px] text-zinc-500 uppercase tracking-tighter text-right">Input B (Right)</div>
        </div>
      </div>

      <Handle type="target" position={Position.Left} id="inputA" style={{ top: '40%', background: '#f97316' }} />
      <Handle type="target" position={Position.Left} id="inputB" style={{ top: '60%', background: '#71717a' }} />
    </div>
  );
};

export default CompareNode;

import React, { useState, useRef, useEffect } from 'react';
import { Split } from 'lucide-react';
import BaseNode from './BaseNode';

const CompareNode = ({ id, data }: any) => {
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
    if (!url) return <div className="flex h-full items-center justify-center bg-black/40 text-xs text-gray-500">No {label}</div>;
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
    <BaseNode id={id} data={{ ...data, label: 'Compare' }} inputs={true} outputs={false}>
      <div className="space-y-4">
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
               <div style={{ width: containerRef.current?.clientWidth || 320, height: containerRef.current?.clientHeight || 180 }}>
                {renderMedia(data.inputA, 'A')}
               </div>
            </div>
            <div className="absolute bottom-2 left-2 rounded bg-[#0097A7]/80 px-2 py-1 text-[10px] font-medium text-white">A</div>
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

        <div className="grid grid-cols-2 gap-2 text-[11px] text-gray-500">
          <div>Input A (left)</div>
          <div className="text-right">Input B (right)</div>
        </div>
      </div>
    </BaseNode>
  );
};

export default CompareNode;

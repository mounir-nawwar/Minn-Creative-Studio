import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { ChevronLeft, ChevronRight, Play, Square } from 'lucide-react';

const ImageIteratorNode = ({ id, data }: any) => {
  const [currentIndex, setCurrentIndex] = useState(data.config?.currentIndex || 0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    let images: string[] = [];

    if (incomingEdge) {
      const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
      const input = sourceNode?.data?.output;
      if (Array.isArray(input)) {
        images = input;
      } else if (typeof input === 'string') {
        images = [input];
      }
    }

    if (images.length === 0) {
      updateNodeData(id, { error: 'No images to iterate', isRunning: false });
      return;
    }

    const safeIndex = Math.min(currentIndex, images.length - 1);
    updateNodeData(id, { output: images[safeIndex], isRunning: false });
  };

  useEffect(() => {
    let interval: any;
    if (isAutoPlaying) {
      interval = setInterval(() => {
        const state = useStore.getState();
        const incomingEdge = state.edges.find(e => e.target === id);
        const sourceNode = state.nodes.find(n => n.id === incomingEdge?.source);
        const images = sourceNode?.data?.output;
        
        if (Array.isArray(images) && images.length > 0) {
          const nextIndex = (currentIndex + 1) % images.length;
          setCurrentIndex(nextIndex);
          updateNodeData(id, { config: { ...data.config, currentIndex: nextIndex } });
          handleRun();
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, currentIndex]);

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#FF9800">
      <div className="space-y-3">
        <div className="flex items-center justify-between bg-[#0a0a0a] p-2 rounded-lg border border-[#2a2a2a]">
          <button 
            onClick={() => {
              const nextIndex = Math.max(0, currentIndex - 1);
              setCurrentIndex(nextIndex);
              updateNodeData(id, { config: { ...data.config, currentIndex: nextIndex } });
              handleRun();
            }}
            className="p-1 hover:bg-[#1a1a1a] rounded text-gray-400 hover:text-white transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <div className="text-center">
            <p className="text-[10px] text-gray-500 uppercase font-bold">Index</p>
            <p className="text-xs font-black text-[#FF9800]">{currentIndex}</p>
          </div>

          <button 
            onClick={() => {
              setCurrentIndex(currentIndex + 1);
              updateNodeData(id, { config: { ...data.config, currentIndex: currentIndex + 1 } });
              handleRun();
            }}
            className="p-1 hover:bg-[#1a1a1a] rounded text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className={`w-full py-2 flex items-center justify-center gap-2 rounded-lg text-xs font-bold transition-all ${isAutoPlaying ? 'bg-red-500/20 border border-red-500/50 text-red-500' : 'bg-[#1a1a1a] border border-[#2a2a2a] text-gray-400 hover:bg-[#222222]'}`}
        >
          {isAutoPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3 h-3 fill-current" />}
          {isAutoPlaying ? 'STOP AUTO' : 'AUTO PLAY'}
        </button>

        {data.output && (
          <div className="mt-2 rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
            <img 
              src={data.output} 
              alt="Current" 
              className="w-full h-auto object-contain max-h-48"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default ImageIteratorNode;

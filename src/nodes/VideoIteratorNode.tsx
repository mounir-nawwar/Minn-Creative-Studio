import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { ChevronLeft, ChevronRight, Play, Square, Video } from 'lucide-react';

const VideoIteratorNode = ({ id, data }: any) => {
  const [currentIndex, setCurrentIndex] = useState(data.config?.currentIndex || 0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    let videos: string[] = [];

    if (incomingEdge) {
      const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
      const input = sourceNode?.data?.output;
      if (Array.isArray(input)) {
        videos = input;
      } else if (typeof input === 'string') {
        videos = [input];
      }
    }

    if (videos.length === 0) {
      updateNodeData(id, { error: 'No videos to iterate', isRunning: false });
      return;
    }

    const safeIndex = Math.min(currentIndex, videos.length - 1);
    updateNodeData(id, { output: videos[safeIndex], isRunning: false });
  };

  useEffect(() => {
    let interval: any;
    if (isAutoPlaying) {
      interval = setInterval(() => {
        const state = useStore.getState();
        const incomingEdge = state.edges.find(e => e.target === id);
        const sourceNode = state.nodes.find(n => n.id === incomingEdge?.source);
        const videos = sourceNode?.data?.output;
        
        if (Array.isArray(videos) && videos.length > 0) {
          const nextIndex = (currentIndex + 1) % videos.length;
          setCurrentIndex(nextIndex);
          updateNodeData(id, { config: { ...data.config, currentIndex: nextIndex } });
          handleRun();
        }
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying, currentIndex]);

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#0097A7" icon={Video}>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-black/30 p-2 ring-1 ring-white/10">
          <button
            onClick={() => { const n = Math.max(0, currentIndex - 1); setCurrentIndex(n); updateNodeData(id, { config: { ...data.config, currentIndex: n } }); handleRun(); }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Index</p>
            <p className="text-xs font-medium tabular-nums text-[#0097A7]">{currentIndex}</p>
          </div>
          <button
            onClick={() => { setCurrentIndex(currentIndex + 1); updateNodeData(id, { config: { ...data.config, currentIndex: currentIndex + 1 } }); handleRun(); }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/5 hover:text-white"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className={`inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg text-[12px] font-medium ring-1 transition-[transform,color,background-color] duration-150 active:scale-[0.98] ${isAutoPlaying ? 'bg-red-500/15 text-red-400 ring-red-500/30' : 'bg-white/[0.04] text-gray-300 ring-white/10 hover:text-white'}`}
        >
          {isAutoPlaying ? <Square className="h-3 w-3 fill-current" /> : <Play className="h-3 w-3 fill-current" />}
          {isAutoPlaying ? 'Stop auto' : 'Auto play'}
        </button>

        {data.output && (
          <div className="overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
            <video src={data.output} className="h-auto max-h-48 w-full object-contain" controls loop autoPlay muted />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default VideoIteratorNode;

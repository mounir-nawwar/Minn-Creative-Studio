import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Film, Play, Pause, SkipBack, SkipForward } from 'lucide-react';

const SequenceNode = ({ id, data }: any) => {
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const incomingVideos = edges
    .filter(e => e.target === id)
    .sort((a, b) => {
      // Sort by vertical position of source node to allow manual ordering
      const nodeA = nodes.find(n => n.id === a.source);
      const nodeB = nodes.find(n => n.id === b.source);
      return (nodeA?.position.y || 0) - (nodeB?.position.y || 0);
    })
    .map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      return sourceNode?.data?.output;
    })
    .filter(v => v);

  useEffect(() => {
    if (isPlaying && incomingVideos.length > 0) {
      const video = document.getElementById(`seq-video-${id}`) as HTMLVideoElement;
      if (video) {
        video.onended = () => {
          if (currentIndex < incomingVideos.length - 1) {
            setCurrentIndex(prev => prev + 1);
          } else {
            setIsPlaying(false);
            setCurrentIndex(0);
          }
        };
      }
    }
  }, [isPlaying, currentIndex, incomingVideos.length, id]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  return (
    <BaseNode id={id} data={data} color="#0097A7" icon={Film}>
      <div className="space-y-3">
        {incomingVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-8 text-gray-600">
            <Film className="h-7 w-7 opacity-30" />
            <p className="text-[11px] text-gray-500">Connect videos</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
              <video id={`seq-video-${id}`} src={incomingVideos[currentIndex]} className="h-full w-full object-contain" autoPlay={isPlaying} controls={false} />
              <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] font-medium text-white">
                Clip {currentIndex + 1} / {incomingVideos.length}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 py-1">
              <button onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/5 hover:text-white">
                <SkipBack className="h-4 w-4" />
              </button>
              <button onClick={togglePlay} className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#0097A7] text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96]">
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
              </button>
              <button onClick={() => setCurrentIndex(Math.min(incomingVideos.length - 1, currentIndex + 1))} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-white/5 hover:text-white">
                <SkipForward className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide text-gray-500">Sequence order (top to bottom)</p>
              <div className="scrollbar-hide flex gap-1.5 overflow-x-auto pb-1">
                {incomingVideos.map((v, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`aspect-video w-16 shrink-0 overflow-hidden rounded-md ring-1 transition-[opacity,box-shadow] duration-150 ${currentIndex === idx ? 'opacity-100 ring-[#0097A7]' : 'opacity-50 ring-white/10 hover:opacity-80'}`}
                  >
                    <video src={v} className="h-full w-full object-cover" muted />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-gray-600">Arrange nodes vertically to change clip order.</p>
      </div>
    </BaseNode>
  );
};

export default SequenceNode;

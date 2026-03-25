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
    <BaseNode id={id} data={data} color="#E91E63" icon={Film}>
      <div className="space-y-3">
        {incomingVideos.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-[#2a2a2a] rounded-xl">
            <Film className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-[10px] uppercase font-bold tracking-widest">Connect Videos</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="relative aspect-video rounded-lg overflow-hidden border border-[#2a2a2a] bg-black">
              <video
                id={`seq-video-${id}`}
                src={incomingVideos[currentIndex]}
                className="w-full h-full object-contain"
                autoPlay={isPlaying}
                controls={false}
              />
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[8px] text-white font-bold uppercase">
                Clip {currentIndex + 1} / {incomingVideos.length}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 py-2">
              <button 
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                className="p-2 hover:bg-[#1a1a1a] rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <SkipBack className="w-4 h-4" />
              </button>
              <button 
                onClick={togglePlay}
                className="p-3 bg-[#E91E63] hover:bg-[#D81B60] rounded-full text-white transition-all transform hover:scale-110"
              >
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
              </button>
              <button 
                onClick={() => setCurrentIndex(Math.min(incomingVideos.length - 1, currentIndex + 1))}
                className="p-2 hover:bg-[#1a1a1a] rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1">
              <p className="text-[9px] text-gray-500 uppercase font-bold">Sequence Order (Top to Bottom)</p>
              <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide">
                {incomingVideos.map((v, idx) => (
                  <div 
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`flex-shrink-0 w-16 aspect-video rounded border transition-all cursor-pointer ${currentIndex === idx ? 'border-[#E91E63] scale-105' : 'border-[#2a2a2a] opacity-50'}`}
                  >
                    <video src={v} className="w-full h-full object-cover" muted />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        <p className="text-[8px] text-gray-600 italic text-center">Arrange nodes vertically to change clip order.</p>
      </div>
    </BaseNode>
  );
};

export default SequenceNode;

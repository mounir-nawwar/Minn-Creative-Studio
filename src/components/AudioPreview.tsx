import React from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { useState, useRef } from 'react';

interface AudioPreviewProps {
  url: string;
}

const AudioPreview: React.FC<AudioPreviewProps> = ({ url }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  return (
    <div className="bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-3 flex items-center gap-3">
      <button
        onClick={togglePlay}
        className="w-8 h-8 flex items-center justify-center bg-[#0097A7] rounded-full text-white hover:bg-[#00838F] transition-colors"
      >
        {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
      </button>
      
      <div className="flex-1 h-8 flex items-center gap-0.5">
        {[...Array(20)].map((_, i) => (
          <div 
            key={i} 
            className={cn(
              "flex-1 bg-[#0097A7]/30 rounded-full",
              isPlaying ? "animate-pulse" : ""
            )}
            style={{ 
              height: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>
      
      <Volume2 className="w-4 h-4 text-gray-500" />
      <audio 
        ref={audioRef} 
        src={url} 
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
    </div>
  );
};

import { cn } from '../lib/utils';
export default AudioPreview;

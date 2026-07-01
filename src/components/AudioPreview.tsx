import { useState, useRef } from 'react';
import { Play, Pause, Volume2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface AudioPreviewProps {
  url: string;
}

// Fixed, deterministic waveform shape — no per-render randomness (which caused jitter).
const BARS = [30, 55, 40, 70, 90, 60, 45, 80, 65, 50, 75, 95, 55, 35, 60, 85, 45, 70, 50, 40];

const AudioPreview: React.FC<AudioPreviewProps> = ({ url }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex items-center gap-3 rounded-lg bg-[#0a0a0a] p-3 ring-1 ring-inset ring-white/10">
      <button
        onClick={togglePlay}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0097A7] text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96]"
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
      </button>

      <div className="flex h-8 flex-1 items-center gap-0.5">
        {BARS.map((h, i) => (
          <div
            key={i}
            className={cn('flex-1 rounded-full transition-colors duration-200', isPlaying ? 'bg-[#0097A7]/70' : 'bg-white/15')}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>

      <Volume2 className="h-4 w-4 shrink-0 text-gray-500" />
      <audio ref={audioRef} src={url} onEnded={() => setIsPlaying(false)} className="hidden" />
    </div>
  );
};

export default AudioPreview;

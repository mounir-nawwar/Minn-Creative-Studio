import React from 'react';

interface VideoPreviewProps {
  url: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ url }) => {
  return (
    <div className="relative aspect-video bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg overflow-hidden group">
      <video
        src={url}
        autoPlay
        loop
        muted
        playsInline
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
        <span className="text-[10px] text-white font-bold uppercase tracking-widest bg-black/60 px-2 py-1 rounded">Preview</span>
      </div>
    </div>
  );
};

export default VideoPreview;

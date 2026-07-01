import React from 'react';

interface VideoPreviewProps {
  url: string;
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ url }) => {
  return (
    <div className="group relative aspect-video overflow-hidden rounded-lg bg-[#0a0a0a] ring-1 ring-inset ring-white/10">
      <video src={url} autoPlay loop muted playsInline className="h-full w-full object-cover" />
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
        <span className="rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white">Preview</span>
      </div>
    </div>
  );
};

export default VideoPreview;

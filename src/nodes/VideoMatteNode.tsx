import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Video, Loader2 } from 'lucide-react';

const VideoMatteNode = ({ id, data }: any) => {
  const [blur, setBlur] = useState(data.config?.blur || 0);
  const [threshold, setThreshold] = useState(data.config?.threshold || 128);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    let videoUrl = data.config?.videoUrl;

    if (incomingEdge) {
      const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
      videoUrl = sourceNode?.data?.output;
    }

    if (!videoUrl) {
      updateNodeData(id, { error: 'No video input connected', isRunning: false });
      return;
    }

    updateNodeData(id, { isRunning: true, error: null, progress: 10 });

    try {
      // For now, we simulate video matte adjustment on the backend
      const response = await fetch('/api/upscale/video', { // Reusing upscale route as a proxy for dummy processing
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, scale: '1x' }) // No scaling, just processing
      });

      if (!response.ok) throw new Error('Matte adjustment failed');
      const result = await response.json();
      
      updateNodeData(id, { output: result.video, isRunning: false, progress: 100 });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#00BCD4" icon={Video}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Blur: {blur}px</label>
          <input 
            type="range" min="0" max="20" value={blur}
            onChange={(e) => {
              setBlur(Number(e.target.value));
              updateNodeData(id, { config: { ...data.config, blur: Number(e.target.value) } });
            }}
            className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#00BCD4]"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Threshold: {threshold}</label>
          <input 
            type="range" min="0" max="255" value={threshold}
            onChange={(e) => {
              setThreshold(Number(e.target.value));
              updateNodeData(id, { config: { ...data.config, threshold: Number(e.target.value) } });
            }}
            className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#00BCD4]"
          />
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#00BCD4] hover:bg-[#00ACC1] text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
        >
          {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
          {data.isRunning ? 'PROCESSING...' : 'RUN VIDEO MATTE'}
        </button>

        {data.output && (
          <div className="mt-2 rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
            <video 
              src={data.output} 
              className="w-full h-auto object-contain max-h-48"
              controls
              loop
              autoPlay
              muted
            />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default VideoMatteNode;

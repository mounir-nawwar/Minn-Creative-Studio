import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Maximize, Loader2, Video } from 'lucide-react';
import { API_BASE } from '../constants';

const VideoUpscalerNode = ({ id, data }: any) => {
  const [scale, setScale] = useState(data.config?.scale || '2x');
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
      const response = await fetch(`${API_BASE}/upscale/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, scale })
      });

      if (!response.ok) throw new Error('Upscaling failed');
      const result = await response.json();
      
      updateNodeData(id, { output: result.video, isRunning: false, progress: 100 });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#FF9800" icon={Video}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Scale</label>
          <div className="grid grid-cols-2 gap-2">
            {['2x', '4x'].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setScale(s);
                  updateNodeData(id, { config: { ...data.config, scale: s } });
                }}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${scale === s ? 'bg-[#FF9800] text-white' : 'bg-[#1a1a1a] text-gray-500 hover:bg-[#222222]'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
        >
          {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Maximize className="w-3 h-3" />}
          {data.isRunning ? 'UPSCALING...' : 'RUN UPSCALER'}
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

export default VideoUpscalerNode;

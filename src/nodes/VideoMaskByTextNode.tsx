import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Video, Loader2, Type } from 'lucide-react';

const VideoMaskByTextNode = ({ id, data }: any) => {
  const [prompt, setPrompt] = useState(data.config?.prompt || 'the subject');
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
      // For now, we simulate video masking on the backend using Gemini
      const response = await fetch('/api/upscale/video', { // Reusing upscale route as a proxy for dummy processing
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoUrl, scale: '1x', prompt }) // No scaling, just processing
      });

      if (!response.ok) throw new Error('Masking failed');
      const result = await response.json();
      
      updateNodeData(id, { output: result.video, isRunning: false, progress: 100 });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#00BCD4" icon={Type}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Mask Prompt</label>
          <input 
            type="text" value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              updateNodeData(id, { config: { ...data.config, prompt: e.target.value } });
            }}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-xs text-gray-300 focus:outline-none focus:border-[#00BCD4]"
            placeholder="e.g. the red car..."
          />
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#00BCD4] hover:bg-[#00ACC1] text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
        >
          {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
          {data.isRunning ? 'MASKING...' : 'RUN VIDEO MASK'}
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

export default VideoMaskByTextNode;

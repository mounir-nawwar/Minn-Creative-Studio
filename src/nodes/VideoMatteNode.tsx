import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Video } from 'lucide-react';
import { API_BASE } from '../constants';
import { authHeader } from '../lib/api';
import ParameterSlider from '../components/ParameterSlider';
import { RunButton } from './ui';

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
      const response = await fetch(`${API_BASE}/video/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ videoUrl, type: 'matte', config: { blur, threshold } })
      });

      if (!response.ok) throw new Error('Matte adjustment failed');
      const result = await response.json();
      
      updateNodeData(id, { output: result.video, isRunning: false, progress: 100 });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#0097A7" icon={Video}>
      <div className="space-y-3">
        <ParameterSlider label="Blur" value={blur} min={0} max={20} onChange={(v) => { setBlur(v); updateNodeData(id, { config: { ...data.config, blur: v } }); }} />
        <ParameterSlider label="Threshold" value={threshold} min={0} max={255} onChange={(v) => { setThreshold(v); updateNodeData(id, { config: { ...data.config, threshold: v } }); }} />

        <RunButton onClick={handleRun} running={data.isRunning} icon={Video}>{data.isRunning ? 'Processing…' : 'Run video matte'}</RunButton>

        {data.output && (
          <div className="overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
            <video src={data.output} className="h-auto max-h-48 w-full object-contain" controls loop autoPlay muted />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default VideoMatteNode;

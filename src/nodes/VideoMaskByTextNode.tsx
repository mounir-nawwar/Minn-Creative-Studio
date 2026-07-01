import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Video, Type } from 'lucide-react';
import { API_BASE } from '../constants';
import { authHeader } from '../lib/api';
import { NodeField, NodeInput, RunButton } from './ui';

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
      const response = await fetch(`${API_BASE}/video/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ videoUrl, type: 'mask', config: { prompt } })
      });

      if (!response.ok) throw new Error('Masking failed');
      const result = await response.json();
      
      updateNodeData(id, { output: result.video, isRunning: false, progress: 100 });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#0097A7" icon={Type}>
      <div className="space-y-3">
        <NodeField label="Mask prompt">
          <NodeInput
            type="text"
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); updateNodeData(id, { config: { ...data.config, prompt: e.target.value } }); }}
            placeholder="e.g. the red car…"
          />
        </NodeField>

        <RunButton onClick={handleRun} running={data.isRunning} icon={Video}>{data.isRunning ? 'Masking…' : 'Run video mask'}</RunButton>

        {data.output && (
          <div className="overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
            <video src={data.output} className="h-auto max-h-48 w-full object-contain" controls loop autoPlay muted />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default VideoMaskByTextNode;

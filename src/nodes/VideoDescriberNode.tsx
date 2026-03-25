import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Handle, Position } from 'reactflow';
import { generateText } from '../services/geminiService';

const VideoDescriberNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'gemini-3-flash-preview');
  const [prompt, setPrompt] = useState(data.config?.prompt || 'Describe this video in detail, focusing on style, camera movement, and lighting.');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    if (!incomingEdge) {
      updateNodeData(id, { error: "No video input connected" });
      return;
    }

    const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
    const videoUrl = sourceNode?.data?.output;

    if (!videoUrl) {
      updateNodeData(id, { error: "Input node has no output video" });
      return;
    }

    updateNodeData(id, { isRunning: true, error: undefined });

    try {
      const text = await generateText({
        prompt,
        model,
        videoUrls: [videoUrl]
      });

      updateNodeData(id, { output: text, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <Handle type="target" position={Position.Left} id="video" style={{ top: '50%', background: 'orange' }} />

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Model</label>
          <select 
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              updateNodeData(id, { config: { ...data.config, model: e.target.value } });
            }}
          >
            <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Prompt</label>
          <textarea
            className="w-full h-16 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none resize-none"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              updateNodeData(id, { config: { ...data.config, prompt: e.target.value } });
            }}
          />
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "ANALYZING VIDEO..." : "DESCRIBE VIDEO"}
        </button>

        {data.output && (
          <div className="mt-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Description:</p>
            <p className="text-[11px] text-gray-300 line-clamp-4 overflow-y-auto max-h-32">"{data.output}"</p>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default VideoDescriberNode;

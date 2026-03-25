import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { generateAudio } from '../services/geminiService';
import AudioPreview from '../components/AudioPreview';

const LyriaNode = ({ id, data }: any) => {
  const [duration, setDuration] = useState(data.config?.duration || 10);
  const [style, setStyle] = useState(data.config?.style || 'Cinematic');
  const [voice, setVoice] = useState(data.config?.voice || 'Kore');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    if (!incomingEdge) {
      updateNodeData(id, { error: "No prompt input connected" });
      return;
    }

    const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
    const prompt = sourceNode?.data?.output;

    if (!prompt) {
      updateNodeData(id, { error: "Input node has no output prompt" });
      return;
    }

    updateNodeData(id, { isRunning: true, error: undefined });

    try {
      const audioUrl = await generateAudio({
        prompt: `Generate ${style} music/speech for ${duration} seconds: ${prompt}`,
        voice
      });

      updateNodeData(id, { output: audioUrl, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Duration</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={duration}
              onChange={(e) => {
                setDuration(Number(e.target.value));
                updateNodeData(id, { config: { ...data.config, duration: Number(e.target.value) } });
              }}
            >
              <option value={10}>10s</option>
              <option value={30}>30s</option>
              <option value={60}>60s</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Style</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={style}
              onChange={(e) => {
                setStyle(e.target.value);
                updateNodeData(id, { config: { ...data.config, style: e.target.value } });
              }}
            >
              <option value="Cinematic">Cinematic</option>
              <option value="Ambient">Ambient</option>
              <option value="Upbeat">Upbeat</option>
              <option value="Dark">Dark</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Voice</label>
          <select 
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
            value={voice}
            onChange={(e) => {
              setVoice(e.target.value);
              updateNodeData(id, { config: { ...data.config, voice: e.target.value } });
            }}
          >
            <option value="Kore">Kore</option>
            <option value="Puck">Puck</option>
            <option value="Charon">Charon</option>
            <option value="Fenrir">Fenrir</option>
            <option value="Zephyr">Zephyr</option>
          </select>
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "GENERATING AUDIO..." : "GENERATE AUDIO"}
        </button>

        {data.output && (
          <div className="mt-2">
            <AudioPreview src={data.output} />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default LyriaNode;

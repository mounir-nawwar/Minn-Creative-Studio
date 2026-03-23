import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { GoogleGenAI } from "@google/genai";
import { Handle, Position } from 'reactflow';

const LLMNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'gemini-3-flash-preview');
  const [systemInstruction, setSystemInstruction] = useState(data.config?.systemInstruction || 'You are a helpful creative assistant.');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = async () => {
    const state = useStore.getState();
    const edges = state.edges.filter(e => e.target === id);
    
    // Find text and image inputs
    const textEdge = edges.find(e => {
      const source = state.nodes.find(n => n.id === e.source);
      return source?.data?.type === 'prompt' || source?.data?.type === 'text' || source?.data?.type === 'promptConcatenator' || source?.data?.type === 'promptEnhancer';
    });
    
    const imageEdge = edges.find(e => {
      const source = state.nodes.find(n => n.id === e.source);
      return source?.data?.type === 'imagen' || source?.data?.type === 'nanoBanana' || source?.data?.type === 'vision';
    });

    const textNode = state.nodes.find(n => n.id === textEdge?.source);
    const imageNode = state.nodes.find(n => n.id === imageEdge?.source);

    const promptText = textNode?.data?.output || 'Describe this content';
    const imageUrl = imageNode?.data?.output;

    updateNodeData(id, { isRunning: true, error: undefined });

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      let contents: any = promptText;

      if (imageUrl) {
        const imgResponse = await fetch(imageUrl);
        const blob = await imgResponse.blob();
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });

        contents = {
          parts: [
            { text: promptText },
            { inlineData: { data: base64Data, mimeType: blob.type } }
          ]
        };
      }

      const response = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: { systemInstruction }
      });

      updateNodeData(id, { output: response.text, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <Handle type="target" position={Position.Left} id="text" style={{ top: '30%', background: '#0097A7' }} />
      <Handle type="target" position={Position.Left} id="image" style={{ top: '70%', background: 'purple' }} />

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
          <label className="text-[10px] text-gray-500 uppercase font-bold">System Instruction</label>
          <textarea
            className="w-full h-16 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none resize-none"
            value={systemInstruction}
            onChange={(e) => {
              setSystemInstruction(e.target.value);
              updateNodeData(id, { config: { ...data.config, systemInstruction: e.target.value } });
            }}
          />
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "RUNNING..." : "RUN LLM"}
        </button>

        {data.output && (
          <div className="mt-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Response:</p>
            <p className="text-[11px] text-gray-300 line-clamp-4 overflow-y-auto max-h-32">"{data.output}"</p>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default LLMNode;

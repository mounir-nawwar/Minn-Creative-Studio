import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { generateText } from '../services/geminiService';

const LLMNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'gemini-3-flash-preview');
  const [systemInstruction, setSystemInstruction] = useState(data.config?.systemInstruction || 'You are a helpful creative assistant.');
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject } = useProjectStore();

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

    // Construct project context string
    const projectContext = currentProject ? `
      Project: ${currentProject.name}
      Type: ${currentProject.type}
      Description: ${currentProject.description}
      Brand: ${currentProject.clientName} (${currentProject.clientIndustry})
      AI Instructions: ${currentProject.aiInstructions}
      Style Keywords: ${currentProject.styleKeywords}
    `.trim() : undefined;

    try {
      const text = await generateText({
        prompt: promptText,
        model,
        systemInstruction,
        imageUrls: imageUrl ? [imageUrl] : [],
        projectContext
      });

      updateNodeData(id, { output: text, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun} className="border-blue-500">
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
          className="w-full py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
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

export default React.memo(LLMNode);

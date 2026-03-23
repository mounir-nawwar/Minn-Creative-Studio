import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';

const PromptNode = ({ id, data }: any) => {
  const [prompt, setPrompt] = useState(data.config?.prompt || '');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    updateNodeData(id, { output: prompt, isRunning: false });
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Prompt Text</label>
          <textarea
            className="w-full h-32 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-[#0097A7] transition-colors resize-none"
            placeholder="Enter your prompt here..."
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              updateNodeData(id, { config: { ...data.config, prompt: e.target.value } });
            }}
          />
        </div>

        <button
          onClick={handleRun}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors"
        >
          SET PROMPT
        </button>

        {data.output && (
          <div className="mt-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Current Output:</p>
            <p className="text-[11px] text-gray-300 italic line-clamp-3">"{data.output}"</p>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default PromptNode;

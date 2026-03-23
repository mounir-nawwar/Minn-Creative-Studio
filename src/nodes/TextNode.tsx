import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';

const TextNode = ({ id, data }: any) => {
  const [text, setText] = useState(data.config?.text || '');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    updateNodeData(id, { output: text, isRunning: false });
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Text Value</label>
          <input
            type="text"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-[#0097A7] transition-colors"
            placeholder="Enter text..."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              updateNodeData(id, { config: { ...data.config, text: e.target.value } });
            }}
          />
        </div>

        <button
          onClick={handleRun}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors"
        >
          SET TEXT
        </button>

        {data.output && (
          <div className="mt-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Current Output:</p>
            <p className="text-[11px] text-gray-300 truncate">"{data.output}"</p>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default TextNode;

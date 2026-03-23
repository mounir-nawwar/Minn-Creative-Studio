import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';

const ToggleNode = ({ id, data }: any) => {
  const [label, setLabel] = useState(data.config?.label || 'Toggle');
  const [isEnabled, setIsEnabled] = useState(data.config?.isEnabled || false);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    updateNodeData(id, { output: isEnabled, isRunning: false });
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun} color="#2196F3">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Label</label>
          <input 
            type="text" value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              updateNodeData(id, { config: { ...data.config, label: e.target.value } });
            }}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none"
            placeholder="Name your toggle..."
          />
        </div>

        <div className="flex items-center justify-between p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
          <span className="text-xs text-gray-400 font-bold">{label}</span>
          <button 
            onClick={() => {
              setIsEnabled(!isEnabled);
              updateNodeData(id, { config: { ...data.config, isEnabled: !isEnabled } });
            }}
            className={`w-10 h-5 rounded-full transition-all relative ${isEnabled ? 'bg-[#2196F3]' : 'bg-[#1a1a1a]'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${isEnabled ? 'left-5.5' : 'left-0.5'}`} />
          </button>
        </div>

        <button
          onClick={handleRun}
          className="w-full py-2 bg-[#2196F3] hover:bg-[#1976D2] text-white rounded-lg text-xs font-bold transition-colors"
        >
          SET VALUE
        </button>

        <div className="mt-2 text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold">Output: <span className="text-[#2196F3]">{isEnabled ? "TRUE" : "FALSE"}</span></p>
        </div>
      </div>
    </BaseNode>
  );
};

export default ToggleNode;

import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';

const NumberNode = ({ id, data }: any) => {
  const [value, setValue] = useState(data.config?.value || 0);
  const [min, setMin] = useState(data.config?.min || 0);
  const [max, setMax] = useState(data.config?.max || 100);
  const [decimals, setDecimals] = useState(data.config?.decimals || 0);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    updateNodeData(id, { output: Number(value.toFixed(decimals)), isRunning: false });
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun} color="#2196F3">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Value</label>
          <input 
            type="number" value={value}
            step={1 / Math.pow(10, decimals)}
            onChange={(e) => {
              setValue(Number(e.target.value));
              updateNodeData(id, { config: { ...data.config, value: Number(e.target.value) } });
            }}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-xs text-gray-300 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Min</label>
            <input 
              type="number" value={min}
              onChange={(e) => {
                setMin(Number(e.target.value));
                updateNodeData(id, { config: { ...data.config, min: Number(e.target.value) } });
              }}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Max</label>
            <input 
              type="number" value={max}
              onChange={(e) => {
                setMax(Number(e.target.value));
                updateNodeData(id, { config: { ...data.config, max: Number(e.target.value) } });
              }}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Decimals</label>
          <input 
            type="number" value={decimals} min="0" max="5"
            onChange={(e) => {
              setDecimals(Number(e.target.value));
              updateNodeData(id, { config: { ...data.config, decimals: Number(e.target.value) } });
            }}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
          />
        </div>

        <button
          onClick={handleRun}
          className="w-full py-2 bg-[#2196F3] hover:bg-[#1976D2] text-white rounded-lg text-xs font-bold transition-colors"
        >
          SET VALUE
        </button>
      </div>
    </BaseNode>
  );
};

export default NumberNode;

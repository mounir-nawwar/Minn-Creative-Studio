import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import ParameterSlider from '../components/ParameterSlider';

const GuidanceStrengthNode = ({ id, data }: any) => {
  const [value, setValue] = useState(data.config?.value || 7.5);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    updateNodeData(id, { output: value, isRunning: false });
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun} color="#2196F3">
      <div className="space-y-3">
        <ParameterSlider 
          label="Guidance Strength" 
          value={value} 
          min={1} 
          max={20} 
          step={0.1}
          onChange={(v) => {
            setValue(v);
            updateNodeData(id, { config: { ...data.config, value: v } });
          }}
          color="#2196F3"
        />
        <button
          onClick={handleRun}
          className="w-full py-2 bg-[#2196F3] hover:bg-[#1976D2] text-white rounded-lg text-xs font-bold transition-colors"
        >
          SET VALUE
        </button>
        <p className="text-[9px] text-gray-600 italic">Higher = more literal prompt following, lower = more creative</p>
      </div>
    </BaseNode>
  );
};

export default GuidanceStrengthNode;

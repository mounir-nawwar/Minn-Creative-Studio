import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import ParameterSlider from '../components/ParameterSlider';

const CFGScaleNode = ({ id, data }: any) => {
  const [value, setValue] = useState(data.config?.value || 7);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    updateNodeData(id, { output: value, isRunning: false });
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun} color="#2196F3">
      <div className="space-y-3">
        <ParameterSlider 
          label="CFG Scale" 
          value={value} 
          min={1} 
          max={30} 
          step={0.5}
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
        <p className="text-[9px] text-gray-600 italic">Controls prompt following vs exploration</p>
      </div>
    </BaseNode>
  );
};

export default CFGScaleNode;

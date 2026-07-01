import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import ParameterSlider from '../components/ParameterSlider';
import { RunButton } from './ui';

const MotionIntensityNode = ({ id, data }: any) => {
  const [value, setValue] = useState(data.config?.value || 50);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => updateNodeData(id, { output: value, isRunning: false });

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <div className="space-y-3">
        <ParameterSlider
          label="Motion intensity"
          value={value}
          min={0}
          max={100}
          step={1}
          onChange={(v) => { setValue(v); updateNodeData(id, { config: { ...data.config, value: v } }); }}
        />
        <RunButton onClick={handleRun}>Set value</RunButton>
        <p className="text-[11px] text-gray-600">Low = subtle movement; high = dramatic motion.</p>
      </div>
    </BaseNode>
  );
};

export default MotionIntensityNode;

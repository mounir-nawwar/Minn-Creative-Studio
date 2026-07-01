import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import ParameterSlider from '../components/ParameterSlider';
import { RunButton } from './ui';

const GuidanceStrengthNode = ({ id, data }: any) => {
  const [value, setValue] = useState(data.config?.value || 7.5);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => updateNodeData(id, { output: value, isRunning: false });

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <div className="space-y-3">
        <ParameterSlider
          label="Guidance strength"
          value={value}
          min={1}
          max={20}
          step={0.1}
          onChange={(v) => { setValue(v); updateNodeData(id, { config: { ...data.config, value: v } }); }}
        />
        <RunButton onClick={handleRun}>Set value</RunButton>
        <p className="text-[11px] text-gray-600">Higher = more literal prompt following; lower = more creative.</p>
      </div>
    </BaseNode>
  );
};

export default GuidanceStrengthNode;

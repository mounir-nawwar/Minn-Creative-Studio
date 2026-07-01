import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { NodeField, NodeInput, RunButton } from './ui';

const NumberNode = ({ id, data }: any) => {
  const [value, setValue] = useState(data.config?.value || 0);
  const [min, setMin] = useState(data.config?.min || 0);
  const [max, setMax] = useState(data.config?.max || 100);
  const [decimals, setDecimals] = useState(data.config?.decimals || 0);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => updateNodeData(id, { output: Number(value.toFixed(decimals)), isRunning: false });

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Value">
          <NodeInput
            type="number"
            value={value}
            step={1 / Math.pow(10, decimals)}
            onChange={(e) => { setValue(Number(e.target.value)); updateNodeData(id, { config: { ...data.config, value: Number(e.target.value) } }); }}
          />
        </NodeField>

        <div className="grid grid-cols-2 gap-2">
          <NodeField label="Min">
            <NodeInput type="number" value={min} onChange={(e) => { setMin(Number(e.target.value)); updateNodeData(id, { config: { ...data.config, min: Number(e.target.value) } }); }} />
          </NodeField>
          <NodeField label="Max">
            <NodeInput type="number" value={max} onChange={(e) => { setMax(Number(e.target.value)); updateNodeData(id, { config: { ...data.config, max: Number(e.target.value) } }); }} />
          </NodeField>
        </div>

        <NodeField label="Decimals">
          <NodeInput type="number" value={decimals} min="0" max="5" onChange={(e) => { setDecimals(Number(e.target.value)); updateNodeData(id, { config: { ...data.config, decimals: Number(e.target.value) } }); }} />
        </NodeField>

        <RunButton onClick={handleRun}>Set value</RunButton>
      </div>
    </BaseNode>
  );
};

export default NumberNode;

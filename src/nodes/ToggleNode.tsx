import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { NodeField, NodeInput, NodeToggle, RunButton } from './ui';

const ToggleNode = ({ id, data }: any) => {
  const [label, setLabel] = useState(data.config?.label || 'Toggle');
  const [isEnabled, setIsEnabled] = useState(data.config?.isEnabled || false);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => updateNodeData(id, { output: isEnabled, isRunning: false });

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Label">
          <NodeInput
            type="text"
            value={label}
            onChange={(e) => { setLabel(e.target.value); updateNodeData(id, { config: { ...data.config, label: e.target.value } }); }}
            placeholder="Name your toggle…"
          />
        </NodeField>

        <div className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 ring-1 ring-white/10">
          <span className="text-xs font-medium text-gray-300">{label}</span>
          <NodeToggle
            on={isEnabled}
            onClick={() => { setIsEnabled(!isEnabled); updateNodeData(id, { config: { ...data.config, isEnabled: !isEnabled } }); }}
          />
        </div>

        <RunButton onClick={handleRun}>Set value</RunButton>

        <p className="text-center text-[11px] text-gray-500">
          Output: <span className="font-medium text-[#0097A7]">{isEnabled ? 'true' : 'false'}</span>
        </p>
      </div>
    </BaseNode>
  );
};

export default ToggleNode;

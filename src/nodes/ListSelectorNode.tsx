import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { NodeField, NodeInput, NodeSelect, RunButton } from './ui';

const ListSelectorNode = ({ id, data }: any) => {
  const [options, setOptions] = useState(data.config?.options || 'Option 1, Option 2, Option 3');
  const [selected, setSelected] = useState(data.config?.selected || 'Option 1');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find((e) => e.target === id);
    if (incomingEdge) {
      const sourceNode = state.nodes.find((n) => n.id === incomingEdge.source);
      const input = sourceNode?.data?.output;
      if (Array.isArray(input)) {
        setOptions(input.join(', '));
      }
    }
    updateNodeData(id, { output: selected, isRunning: false });
  };

  const optionList = options.split(',').map((o: string) => o.trim()).filter(Boolean);

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Options (comma-separated or array input)">
          <NodeInput
            type="text"
            value={options}
            onChange={(e) => { setOptions(e.target.value); updateNodeData(id, { config: { ...data.config, options: e.target.value } }); }}
          />
        </NodeField>

        <NodeField label="Select option">
          <NodeSelect value={selected} onChange={(e) => { setSelected(e.target.value); updateNodeData(id, { config: { ...data.config, selected: e.target.value } }); }}>
            {optionList.map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
          </NodeSelect>
        </NodeField>

        <RunButton onClick={handleRun}>Set selection</RunButton>

        <p className="text-center text-[11px] text-gray-500">
          Output: <span className="font-medium text-[#0097A7]">{selected}</span>
        </p>
      </div>
    </BaseNode>
  );
};

export default ListSelectorNode;

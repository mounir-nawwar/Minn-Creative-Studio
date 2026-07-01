import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { NodeField, NodeInput, RunButton, NodeOutput } from './ui';

const PromptConcatenatorNode = ({ id, data }: any) => {
  const [separator, setSeparator] = useState(data.config?.separator || ', ');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    const state = useStore.getState();
    const edges = state.edges.filter((e) => e.target === id);
    const sortedEdges = [...edges].sort((a, b) => (a.targetHandle || '').localeCompare(b.targetHandle || ''));
    const inputs = sortedEdges
      .map((edge) => state.nodes.find((n) => n.id === edge.source)?.data?.output || '')
      .filter(Boolean);
    updateNodeData(id, { output: inputs.join(separator), isRunning: false });
  };

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Separator">
          <NodeInput
            type="text"
            value={separator}
            onChange={(e) => { setSeparator(e.target.value); updateNodeData(id, { config: { ...data.config, separator: e.target.value } }); }}
          />
        </NodeField>

        <RunButton onClick={handleRun}>Concatenate</RunButton>

        {data.output && (
          <NodeOutput label="Result">
            <p className="line-clamp-3 italic">"{data.output}"</p>
          </NodeOutput>
        )}
      </div>
    </BaseNode>
  );
};

export default PromptConcatenatorNode;

import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Handle, Position } from 'reactflow';

const PromptConcatenatorNode = ({ id, data }: any) => {
  const [separator, setSeparator] = useState(data.config?.separator || ', ');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    const state = useStore.getState();
    const edges = state.edges.filter(e => e.target === id);
    
    // Sort edges by target handle ID or source node position to maintain order
    const sortedEdges = [...edges].sort((a, b) => {
      const aId = a.targetHandle || '';
      const bId = b.targetHandle || '';
      return aId.localeCompare(bId);
    });

    const inputs = sortedEdges.map(edge => {
      const sourceNode = state.nodes.find(n => n.id === edge.source);
      return sourceNode?.data?.output || '';
    }).filter(Boolean);

    const concatenated = inputs.join(separator);
    updateNodeData(id, { output: concatenated, isRunning: false });
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <Handle type="target" position={Position.Left} id="in1" style={{ top: '20%', background: '#0097A7' }} />
      <Handle type="target" position={Position.Left} id="in2" style={{ top: '40%', background: '#0097A7' }} />
      <Handle type="target" position={Position.Left} id="in3" style={{ top: '60%', background: '#0097A7' }} />
      <Handle type="target" position={Position.Left} id="in4" style={{ top: '80%', background: '#0097A7' }} />

      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Separator</label>
          <input
            type="text"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-xs text-gray-300 focus:outline-none"
            value={separator}
            onChange={(e) => {
              setSeparator(e.target.value);
              updateNodeData(id, { config: { ...data.config, separator: e.target.value } });
            }}
          />
        </div>

        <button
          onClick={handleRun}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors"
        >
          CONCATENATE
        </button>

        {data.output && (
          <div className="mt-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Result:</p>
            <p className="text-[11px] text-gray-300 italic line-clamp-3">"{data.output}"</p>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default PromptConcatenatorNode;

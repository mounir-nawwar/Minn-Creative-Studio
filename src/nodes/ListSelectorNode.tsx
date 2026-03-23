import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';

const ListSelectorNode = ({ id, data }: any) => {
  const [options, setOptions] = useState(data.config?.options || 'Option 1, Option 2, Option 3');
  const [selected, setSelected] = useState(data.config?.selected || 'Option 1');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    let finalOptions = options;

    if (incomingEdge) {
      const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
      const input = sourceNode?.data?.output;
      if (Array.isArray(input)) {
        finalOptions = input.join(', ');
      }
    }

    const optionList = finalOptions.split(',').map((o: string) => o.trim()).filter(Boolean);
    updateNodeData(id, { output: selected, isRunning: false });
  };

  const optionList = options.split(',').map((o: string) => o.trim()).filter(Boolean);

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#2196F3">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Options (comma separated or Array input)</label>
          <input
            type="text"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none"
            value={options}
            onChange={(e) => {
              setOptions(e.target.value);
              updateNodeData(id, { config: { ...data.config, options: e.target.value } });
            }}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Select Option</label>
          <select 
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value);
              updateNodeData(id, { config: { ...data.config, selected: e.target.value } });
            }}
          >
            {optionList.map((opt: string) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleRun}
          className="w-full py-2 bg-[#2196F3] hover:bg-[#1976D2] text-white rounded-lg text-xs font-bold transition-colors"
        >
          SET SELECTION
        </button>

        <div className="mt-2 text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold">Output: <span className="text-[#2196F3]">{selected}</span></p>
        </div>
      </div>
    </BaseNode>
  );
};

export default ListSelectorNode;

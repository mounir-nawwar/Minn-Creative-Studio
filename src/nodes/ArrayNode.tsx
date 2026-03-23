import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';

const ArrayNode = ({ id, data }: any) => {
  const [items, setItems] = useState(data.config?.items || '');
  const [separator, setSeparator] = useState(data.config?.separator || 'newline');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    let array: string[] = [];
    if (separator === 'newline') {
      array = items.split('\n').map((i: string) => i.trim()).filter(Boolean);
    } else {
      array = items.split(separator).map((i: string) => i.trim()).filter(Boolean);
    }
    updateNodeData(id, { output: array, isRunning: false });
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun} color="#2196F3">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Separator</label>
          <select 
            value={separator}
            onChange={(e) => {
              setSeparator(e.target.value);
              updateNodeData(id, { config: { ...data.config, separator: e.target.value } });
            }}
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
          >
            <option value="newline">New Line</option>
            <option value=",">Comma (,)</option>
            <option value=";">Semicolon (;)</option>
            <option value="|">Pipe (|)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Items</label>
          <textarea
            className="w-full h-32 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-[#2196F3] transition-colors resize-none"
            placeholder={separator === 'newline' ? "Item 1\nItem 2..." : `Item 1${separator}Item 2...`}
            value={items}
            onChange={(e) => {
              setItems(e.target.value);
              updateNodeData(id, { config: { ...data.config, items: e.target.value } });
            }}
          />
        </div>

        <button
          onClick={handleRun}
          className="w-full py-2 bg-[#2196F3] hover:bg-[#1976D2] text-white rounded-lg text-xs font-bold transition-colors"
        >
          SET ARRAY
        </button>

        {data.output && Array.isArray(data.output) && (
          <div className="mt-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Items Count: {data.output.length}</p>
            <div className="max-h-24 overflow-y-auto space-y-1">
              {data.output.map((item: string, i: number) => (
                <p key={i} className="text-[9px] text-gray-400 truncate">[{i}] {item}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default ArrayNode;

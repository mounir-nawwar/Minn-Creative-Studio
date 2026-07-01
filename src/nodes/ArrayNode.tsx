import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { NodeField, NodeSelect, NodeTextArea, RunButton, NodeLabel } from './ui';

const ArrayNode = ({ id, data }: any) => {
  const [items, setItems] = useState(data.config?.items || '');
  const [separator, setSeparator] = useState(data.config?.separator || 'newline');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    const array =
      separator === 'newline'
        ? items.split('\n').map((i: string) => i.trim()).filter(Boolean)
        : items.split(separator).map((i: string) => i.trim()).filter(Boolean);
    updateNodeData(id, { output: array, isRunning: false });
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Separator">
          <NodeSelect value={separator} onChange={(e) => { setSeparator(e.target.value); updateNodeData(id, { config: { ...data.config, separator: e.target.value } }); }}>
            <option value="newline">New line</option>
            <option value=",">Comma (,)</option>
            <option value=";">Semicolon (;)</option>
            <option value="|">Pipe (|)</option>
          </NodeSelect>
        </NodeField>

        <NodeField label="Items">
          <NodeTextArea
            className="h-32"
            placeholder={separator === 'newline' ? 'Item 1\nItem 2…' : `Item 1${separator}Item 2…`}
            value={items}
            onChange={(e) => { setItems(e.target.value); updateNodeData(id, { config: { ...data.config, items: e.target.value } }); }}
          />
        </NodeField>

        <RunButton onClick={handleRun}>Set array</RunButton>

        {data.output && Array.isArray(data.output) && (
          <div className="space-y-1 rounded-lg bg-black/30 p-2.5 ring-1 ring-white/10">
            <NodeLabel>Items count: {data.output.length}</NodeLabel>
            <div className="max-h-24 space-y-1 overflow-y-auto">
              {data.output.map((item: string, i: number) => (
                <p key={i} className="truncate text-[11px] text-gray-400">[{i}] {item}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default ArrayNode;

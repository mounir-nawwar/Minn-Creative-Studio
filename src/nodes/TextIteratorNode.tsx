import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import { RunButton, NodeOutput } from './ui';

const TextIteratorNode = ({ id, data }: any) => {
  const [currentIndex, setCurrentIndex] = useState(data.config?.currentIndex || 0);
  const [items, setItems] = useState<string[]>(data.config?.items || []);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    
    if (incomingEdge) {
      const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
      const input = sourceNode?.data?.output;
      if (Array.isArray(input)) {
        setItems(input);
        updateNodeData(id, { config: { ...data.config, items: input } });
      } else if (typeof input === 'string') {
        const split = input.split('\n').map(s => s.trim()).filter(Boolean);
        setItems(split);
        updateNodeData(id, { config: { ...data.config, items: split } });
      }
    }

    if (items.length > 0) {
      const currentItem = items[currentIndex % items.length];
      updateNodeData(id, { output: currentItem, isRunning: false });
    } else {
      updateNodeData(id, { error: "No items to iterate", isRunning: false });
    }
  };

  const next = () => {
    const nextIndex = (currentIndex + 1) % items.length;
    setCurrentIndex(nextIndex);
    updateNodeData(id, { config: { ...data.config, currentIndex: nextIndex } });
    handleRun();
  };

  const prev = () => {
    const prevIndex = (currentIndex - 1 + items.length) % items.length;
    setCurrentIndex(prevIndex);
    updateNodeData(id, { config: { ...data.config, currentIndex: prevIndex } });
    handleRun();
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg bg-black/30 p-2 ring-1 ring-white/10">
          <button onClick={prev} disabled={items.length <= 1} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/5 disabled:opacity-30">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-wide text-gray-500">Item</p>
            <p className="text-xs font-medium tabular-nums text-[#0097A7]">{items.length > 0 ? currentIndex + 1 : 0} / {items.length}</p>
          </div>
          <button onClick={next} disabled={items.length <= 1} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-white/5 disabled:opacity-30">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <RunButton onClick={handleRun} icon={Play}>Run current</RunButton>

        {items.length > 0 && (
          <NodeOutput label="Current output">
            <p className="truncate italic">"{items[currentIndex % items.length]}"</p>
          </NodeOutput>
        )}
      </div>
    </BaseNode>
  );
};

export default TextIteratorNode;

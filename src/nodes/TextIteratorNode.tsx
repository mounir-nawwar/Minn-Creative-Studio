import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';

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
        <div className="flex items-center justify-between p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
          <button 
            onClick={prev}
            disabled={items.length <= 1}
            className="p-1 hover:bg-[#1a1a1a] rounded text-gray-400 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-center">
            <p className="text-[10px] text-gray-500 font-bold uppercase">Item</p>
            <p className="text-xs text-[#0097A7] font-black">{items.length > 0 ? currentIndex + 1 : 0} / {items.length}</p>
          </div>
          <button 
            onClick={next}
            disabled={items.length <= 1}
            className="p-1 hover:bg-[#1a1a1a] rounded text-gray-400 disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={handleRun}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-colors"
        >
          <Play className="w-3 h-3" />
          RUN CURRENT
        </button>

        {items.length > 0 && (
          <div className="mt-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Current Output:</p>
            <p className="text-[11px] text-gray-300 italic truncate">"{items[currentIndex % items.length]}"</p>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default TextIteratorNode;

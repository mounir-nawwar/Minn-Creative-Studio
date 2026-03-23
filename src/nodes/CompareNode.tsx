import React, { useState, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Columns, Split } from 'lucide-react';

const CompareNode = ({ id, data }: any) => {
  const [viewMode, setViewMode] = useState(data.config?.viewMode || 'side-by-side');
  const [imageA, setImageA] = useState<string | null>(null);
  const [imageB, setImageB] = useState<string | null>(null);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = () => {
    const state = useStore.getState();
    const incomingEdges = state.edges.filter(e => e.target === id);
    
    // We expect two inputs, let's sort them by target handle if possible
    // For now, let's just take the first two
    const edgeA = incomingEdges[0];
    const edgeB = incomingEdges[1];

    if (edgeA) {
      const nodeA = state.nodes.find(n => n.id === edgeA.source);
      setImageA(nodeA?.data?.output || null);
    }
    if (edgeB) {
      const nodeB = state.nodes.find(n => n.id === edgeB.source);
      setImageB(nodeB?.data?.output || null);
    }

    updateNodeData(id, { isRunning: false });
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <div className="flex gap-2 p-1 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
          <button
            onClick={() => {
              setViewMode('side-by-side');
              updateNodeData(id, { config: { ...data.config, viewMode: 'side-by-side' } });
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewMode === 'side-by-side' ? 'bg-[#0097A7] text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Columns className="w-3 h-3" />
            SIDE-BY-SIDE
          </button>
          <button
            onClick={() => {
              setViewMode('overlay');
              updateNodeData(id, { config: { ...data.config, viewMode: 'overlay' } });
            }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewMode === 'overlay' ? 'bg-[#0097A7] text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Split className="w-3 h-3" />
            OVERLAY
          </button>
        </div>

        <button
          onClick={handleRun}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors"
        >
          COMPARE IMAGES
        </button>

        <div className="mt-2 space-y-2">
          {viewMode === 'side-by-side' ? (
            <div className="grid grid-cols-2 gap-2">
              <div className="aspect-square bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg overflow-hidden flex items-center justify-center">
                {imageA ? <img src={imageA} alt="A" className="w-full h-full object-contain" /> : <span className="text-[10px] text-gray-600">INPUT A</span>}
              </div>
              <div className="aspect-square bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg overflow-hidden flex items-center justify-center">
                {imageB ? <img src={imageB} alt="B" className="w-full h-full object-contain" /> : <span className="text-[10px] text-gray-600">INPUT B</span>}
              </div>
            </div>
          ) : (
            <div className="aspect-square bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg overflow-hidden relative">
              {imageA && <img src={imageA} alt="A" className="absolute inset-0 w-full h-full object-contain" />}
              {imageB && <img src={imageB} alt="B" className="absolute inset-0 w-full h-full object-contain opacity-50 hover:opacity-100 transition-opacity cursor-pointer" title="Hover to see B" />}
              {!imageA && !imageB && <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-600">INPUT A & B</div>}
            </div>
          )}
        </div>
      </div>
    </BaseNode>
  );
};

export default CompareNode;

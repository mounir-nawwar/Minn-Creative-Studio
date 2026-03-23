import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Maximize, Loader2 } from 'lucide-react';

const ImageUpscalerNode = ({ id, data }: any) => {
  const [scale, setScale] = useState(data.config?.scale || '2x');
  const [preserveStyle, setPreserveStyle] = useState(data.config?.preserveStyle || true);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    let imageUrl = data.config?.imageUrl;

    if (incomingEdge) {
      const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
      imageUrl = sourceNode?.data?.output;
    }

    if (!imageUrl) {
      updateNodeData(id, { error: 'No image input connected', isRunning: false });
      return;
    }

    updateNodeData(id, { isRunning: true, error: null, progress: 10 });

    try {
      const response = await fetch('/api/upscale/image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, scale, preserveStyle })
      });

      if (!response.ok) throw new Error('Upscaling failed');
      const result = await response.json();
      
      updateNodeData(id, { output: result.image, isRunning: false, progress: 100 });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#FF9800" icon={Maximize}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Scale</label>
          <div className="grid grid-cols-2 gap-2">
            {['2x', '4x'].map((s) => (
              <button
                key={s}
                onClick={() => {
                  setScale(s);
                  updateNodeData(id, { config: { ...data.config, scale: s } });
                }}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${scale === s ? 'bg-[#FF9800] text-white' : 'bg-[#1a1a1a] text-gray-500 hover:bg-[#222222]'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
          <span className="text-[10px] text-gray-400 font-bold uppercase">Preserve Style</span>
          <button 
            onClick={() => {
              setPreserveStyle(!preserveStyle);
              updateNodeData(id, { config: { ...data.config, preserveStyle: !preserveStyle } });
            }}
            className={`w-8 h-4 rounded-full transition-all relative ${preserveStyle ? 'bg-[#FF9800]' : 'bg-[#1a1a1a]'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${preserveStyle ? 'left-4.5' : 'left-0.5'}`} />
          </button>
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
        >
          {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Maximize className="w-3 h-3" />}
          {data.isRunning ? 'UPSCALING...' : 'RUN UPSCALER'}
        </button>

        {data.output && (
          <div className="mt-2 rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
            <img 
              src={data.output} 
              alt="Upscaled" 
              className="w-full h-auto object-contain max-h-48"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default ImageUpscalerNode;

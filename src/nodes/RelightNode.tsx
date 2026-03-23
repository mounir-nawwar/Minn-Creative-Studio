import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Sun, Loader2 } from 'lucide-react';
import ParameterSlider from '../components/ParameterSlider';

const RelightNode = ({ id, data }: any) => {
  const [lightDirection, setLightDirection] = useState(data.config?.lightDirection || 'top');
  const [lightColor, setLightColor] = useState(data.config?.lightColor || '#ffffff');
  const [intensity, setIntensity] = useState(data.config?.intensity || 50);
  const [style, setStyle] = useState(data.config?.style || 'Natural');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const directions = [
    { id: 'top-left', label: '↖' }, { id: 'top', label: '↑' }, { id: 'top-right', label: '↗' },
    { id: 'left', label: '←' }, { id: 'center', label: '•' }, { id: 'right', label: '→' },
    { id: 'bottom-left', label: '↙' }, { id: 'bottom', label: '↓' }, { id: 'bottom-right', label: '↘' }
  ];

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
      const response = await fetch('/api/relight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, lightDirection, lightColor, intensity, style })
      });

      if (!response.ok) throw new Error('Relighting failed');
      const result = await response.json();
      
      updateNodeData(id, { output: result.image, isRunning: false, progress: 100 });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#FF9800" icon={Sun}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Light Direction</label>
          <div className="grid grid-cols-3 gap-1 bg-[#0a0a0a] p-1 rounded-lg border border-[#2a2a2a]">
            {directions.map((dir) => (
              <button
                key={dir.id}
                onClick={() => {
                  setLightDirection(dir.id);
                  updateNodeData(id, { config: { ...data.config, lightDirection: dir.id } });
                }}
                className={`w-full aspect-square flex items-center justify-center rounded text-sm transition-all ${lightDirection === dir.id ? 'bg-[#FF9800] text-white' : 'text-gray-600 hover:bg-[#1a1a1a]'}`}
              >
                {dir.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Color</label>
            <input 
              type="color" value={lightColor}
              onChange={(e) => {
                setLightColor(e.target.value);
                updateNodeData(id, { config: { ...data.config, lightColor: e.target.value } });
              }}
              className="w-full h-8 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg cursor-pointer"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Style</label>
            <select 
              value={style}
              onChange={(e) => {
                setStyle(e.target.value);
                updateNodeData(id, { config: { ...data.config, style: e.target.value } });
              }}
              className="w-full h-8 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg text-[10px] text-gray-400 focus:outline-none"
            >
              {['Natural', 'Studio', 'Dramatic', 'Soft'].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>

        <ParameterSlider 
          label="Intensity" 
          value={intensity} 
          min={0} 
          max={100} 
          onChange={(v) => {
            setIntensity(v);
            updateNodeData(id, { config: { ...data.config, intensity: v } });
          }}
          color="#FF9800"
        />

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
        >
          {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sun className="w-3 h-3" />}
          {data.isRunning ? 'RELIGHTING...' : 'RUN RELIGHTER'}
        </button>

        {data.output && (
          <div className="mt-2 rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
            <img 
              src={data.output} 
              alt="Relit" 
              className="w-full h-auto object-contain max-h-48"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default RelightNode;

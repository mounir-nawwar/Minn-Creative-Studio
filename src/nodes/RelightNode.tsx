import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { useAssets } from '../hooks/useAssets';
import { Sun, Loader2, Download } from 'lucide-react';
import ParameterSlider from '../components/ParameterSlider';
import { relightImage } from '../services/geminiService';
import { NodeField, NodeLabel, NodeSelect, RunButton } from './ui';
import { downloadFile } from '../lib/utils';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';

const RelightNode = ({ id, data }: any) => {
  const [lightDirection, setLightDirection] = useState(data.config?.lightDirection || 'top');
  const [lightColor, setLightColor] = useState(data.config?.lightColor || '#ffffff');
  const [intensity, setIntensity] = useState(data.config?.intensity || 50);
  const [style, setStyle] = useState(data.config?.style || 'Natural');
  
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { setExpandedAsset } = useAssetExpand();
  const { currentProject, uploadEnabled } = useProjectStore();
  const { addAsset } = useAssets({ autoFetch: false });

  const directions = [
    { id: 'top-left', label: '↖' }, { id: 'top', label: '↑' }, { id: 'top-right', label: '↗' },
    { id: 'left', label: '←' }, { id: 'center', label: '•' }, { id: 'right', label: '→' },
    { id: 'bottom-left', label: '↙' }, { id: 'bottom', label: '↓' }, { id: 'bottom-right', label: '↘' }
  ];

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    if (!incomingEdge) {
      updateNodeData(id, { error: "No image input connected" });
      return;
    }

    const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
    const imageUrl = sourceNode?.data?.output;

    if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('data:image')) {
      updateNodeData(id, { error: "Input node has no valid image output" });
      return;
    }

    updateNodeData(id, { isRunning: true, error: undefined, progress: 10 });

    try {
      const relitUrl = await relightImage({
        imageUrl,
        lightDirection,
        lightColor,
        intensity: intensity / 100,
        style,
        projectId: uploadEnabled ? currentProject?.id : undefined
      });
      
      updateNodeData(id, { output: relitUrl, isRunning: false, progress: 100 });

      if (relitUrl) {
        addAsset({
          name: 'Relit Image - ' + new Date().toLocaleTimeString(),
          type: 'image',
          url: relitUrl,
          thumbnailUrl: relitUrl,
          tags: ['generated', 'image', 'relighting']
        });
      }
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  const handleDownload = () => {
    if (!data.output) return;
    downloadFile(data.output, `relit-image-${Date.now()}.png`);
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#0097A7" icon={Sun}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <NodeLabel>Light direction</NodeLabel>
          <div className="grid grid-cols-3 gap-1">
            {directions.map((dir) => (
              <button
                key={dir.id}
                onClick={() => { setLightDirection(dir.id); updateNodeData(id, { config: { ...data.config, lightDirection: dir.id } }); }}
                className={`flex aspect-square w-full items-center justify-center rounded-md text-sm transition-[color,background-color] duration-150 ${lightDirection === dir.id ? 'bg-[#0097A7] text-white' : 'text-gray-500 hover:bg-white/[0.06]'}`}
              >
                {dir.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NodeField label="Color">
            <input
              type="color"
              value={lightColor}
              onChange={(e) => { setLightColor(e.target.value); updateNodeData(id, { config: { ...data.config, lightColor: e.target.value } }); }}
              className="h-9 w-full cursor-pointer rounded-lg bg-black/30 ring-1 ring-white/10"
            />
          </NodeField>
          <NodeField label="Style">
            <NodeSelect value={style} onChange={(e) => { setStyle(e.target.value); updateNodeData(id, { config: { ...data.config, style: e.target.value } }); }}>
              {['Natural', 'Dramatic', 'Soft', 'Harsh', 'Studio', 'Outdoor'].map((s) => <option key={s} value={s}>{s}</option>)}
            </NodeSelect>
          </NodeField>
        </div>

        <ParameterSlider
          label="Intensity"
          value={intensity}
          min={0}
          max={100}
          onChange={(v) => { setIntensity(v); updateNodeData(id, { config: { ...data.config, intensity: v } }); }}
        />

        <RunButton onClick={handleRun} running={data.isRunning} icon={Sun}>{data.isRunning ? 'Relighting…' : 'Run relighter'}</RunButton>

        {data.output && (
          <div className="space-y-2">
            <ExpandableAssetWrapper onClick={() => setExpandedAsset(data.output, 'image')} type="image">
              <img src={data.output} alt="Relit" className="h-auto max-h-48 w-full object-contain" referrerPolicy="no-referrer" />
            </ExpandableAssetWrapper>
            <button
              onClick={handleDownload}
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/[0.04] text-[12px] font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:bg-white/[0.07] hover:text-white active:scale-[0.98]"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </button>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default RelightNode;

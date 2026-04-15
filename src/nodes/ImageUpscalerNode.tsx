import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { useAssets } from '../hooks/useAssets';
import { Maximize, Loader2 } from 'lucide-react';
import { upscaleImage } from '../services/geminiService';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { toast } from '../store/useToastStore';

const UPSCALE_MODELS = [
  { id: 'gemini-3.1-flash-image-preview', label: 'Nano Banana (Free)', price: 0 },
  { id: 'imagen-4-upscale', label: 'Imagen 4 Upscale', price: 0.06 },
  { id: 'imagen-1-upscale', label: 'Imagen 1 Upscale', price: 0.003 },
];

const ImageUpscalerNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'gemini-3.1-flash-image-preview');
  const [scale, setScale] = useState(data.config?.scale || '2x');
  const [preserveStyle, setPreserveStyle] = useState(data.config?.preserveStyle ?? true);
  
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject, uploadEnabled } = useProjectStore();
  const { addAsset } = useAssets();
  const { setExpandedAsset } = useAssetExpand();

  const updateConfig = (key: string, value: any) => {
    updateNodeData(id, { config: { ...data.config, [key]: value } });
  };

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
      const upscaledUrl = await upscaleImage({
        imageUrl,
        scale,
        preserveStyle,
        model,
        projectId: uploadEnabled ? currentProject?.id : undefined
      });
      
      updateNodeData(id, { output: upscaledUrl, isRunning: false, progress: 100 });

      if (upscaledUrl) {
        const modelConfig = UPSCALE_MODELS.find(m => m.id === model);
        addAsset({
          name: `Upscaled Image - ${new Date().toLocaleTimeString()} (${scale})`,
          type: 'image',
          url: upscaledUrl,
          thumbnailUrl: upscaledUrl,
          tags: ['generated', 'image', 'upscale', modelConfig?.label || 'unknown']
        });
        toast.success('Image upscaled', 'Your image has been enhanced');
      }
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
      toast.error('Upscale failed', err.message);
    }
  };

  const selectedModel = UPSCALE_MODELS.find(m => m.id === model);

  return (
    <BaseNode id={id} data={data} onRun={handleRun} className="border-[#FF9800]">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Model</label>
          <select 
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none focus:border-[#FF9800]"
            value={model}
            onChange={(e) => { setModel(e.target.value); updateConfig('model', e.target.value); }}
          >
            {UPSCALE_MODELS.map(m => (
              <option key={m.id} value={m.id}>
                {m.label}{m.price > 0 ? ` ($${m.price}/img)` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Scale</label>
          <div className="grid grid-cols-2 gap-2">
            {['2x', '4x'].map((s) => (
              <button
                key={s}
                onClick={() => { setScale(s); updateConfig('scale', s); }}
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
            onClick={() => { setPreserveStyle(!preserveStyle); updateConfig('preserveStyle', !preserveStyle); }}
            className={`w-8 h-4 rounded-full transition-all relative ${preserveStyle ? 'bg-[#FF9800]' : 'bg-[#1a1a1a]'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${preserveStyle ? 'left-4.5' : 'left-0.5'}`} />
          </button>
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Maximize className="w-3 h-3" />}
          {data.isRunning ? 'UPSCALING...' : 'RUN UPSCALER'}
        </button>

        {data.output && (
          <div className="mt-2 rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
            <ExpandableAssetWrapper
              onClick={() => setExpandedAsset(data.output, 'image')}
              type="image"
            >
              <img 
                src={data.output} 
                alt="Upscaled" 
                className="w-full h-auto object-contain max-h-48"
                referrerPolicy="no-referrer"
              />
            </ExpandableAssetWrapper>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default ImageUpscalerNode;

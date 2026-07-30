import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { useAssets } from '../hooks/useAssets';
import { Maximize } from 'lucide-react';
import { upscaleImage } from '../services/geminiService';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { toast } from '../store/useToastStore';
import { NodeField, NodeLabel, NodeSelect, NodeToggle, RunButton } from './ui';

const UPSCALE_MODELS = [
  { id: 'gemini-3.1-flash-image', label: 'Nano Banana (Free)', price: 0 },
  { id: 'imagen-4-upscale', label: 'Imagen 4 Upscale', price: 0.06 },
  { id: 'imagen-1-upscale', label: 'Imagen 1 Upscale', price: 0.003 },
];

const ImageUpscalerNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'gemini-3.1-flash-image');
  const [scale, setScale] = useState(data.config?.scale || '2x');
  const [preserveStyle, setPreserveStyle] = useState(data.config?.preserveStyle ?? true);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject, uploadEnabled } = useProjectStore();
  const { addAsset } = useAssets({ autoFetch: false });
  const { setExpandedAsset } = useAssetExpand();

  const updateConfig = (key: string, value: any) => updateNodeData(id, { config: { ...data.config, [key]: value } });

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find((e) => e.target === id);
    let imageUrl = data.config?.imageUrl;
    if (incomingEdge) imageUrl = state.nodes.find((n) => n.id === incomingEdge.source)?.data?.output;
    if (!imageUrl) { updateNodeData(id, { error: 'No image input connected', isRunning: false }); return; }
    updateNodeData(id, { isRunning: true, error: null, progress: 10 });
    try {
      const upscaledUrl = await upscaleImage({ imageUrl, scale, preserveStyle, model, projectId: uploadEnabled ? currentProject?.id : undefined });
      updateNodeData(id, { output: upscaledUrl, isRunning: false, progress: 100 });
      if (upscaledUrl) {
        const modelConfig = UPSCALE_MODELS.find((m) => m.id === model);
        addAsset({ name: `Upscaled Image - ${new Date().toLocaleTimeString()} (${scale})`, type: 'image', url: upscaledUrl, thumbnailUrl: upscaledUrl, tags: ['generated', 'image', 'upscale', modelConfig?.label || 'unknown'] });
        toast.success('Image upscaled', 'Your image has been enhanced');
      }
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
      toast.error('Upscale failed', err.message);
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Model">
          <NodeSelect value={model} onChange={(e) => { setModel(e.target.value); updateConfig('model', e.target.value); }}>
            {UPSCALE_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}{m.price > 0 ? ` ($${m.price}/img)` : ''}</option>)}
          </NodeSelect>
        </NodeField>

        <div className="space-y-1.5">
          <NodeLabel>Scale</NodeLabel>
          <div className="grid grid-cols-2 gap-2">
            {['2x', '4x'].map((s) => (
              <button
                key={s}
                onClick={() => { setScale(s); updateConfig('scale', s); }}
                className={`rounded-lg py-1.5 text-xs font-medium transition-[transform,color,background-color] duration-150 active:scale-[0.98] ${scale === s ? 'bg-[#0097A7] text-white' : 'bg-white/[0.04] text-gray-400 ring-1 ring-white/10 hover:text-white'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-black/30 px-3 py-2 ring-1 ring-white/10">
          <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Preserve style</span>
          <NodeToggle on={preserveStyle} onClick={() => { setPreserveStyle(!preserveStyle); updateConfig('preserveStyle', !preserveStyle); }} />
        </div>

        <RunButton onClick={handleRun} running={data.isRunning} icon={Maximize}>{data.isRunning ? 'Upscaling…' : 'Run upscaler'}</RunButton>

        {data.output && (
          <ExpandableAssetWrapper onClick={() => setExpandedAsset(data.output, 'image')} type="image">
            <img src={data.output} alt="Upscaled" className="h-auto max-h-48 w-full object-contain" referrerPolicy="no-referrer" />
          </ExpandableAssetWrapper>
        )}
      </div>
    </BaseNode>
  );
};

export default ImageUpscalerNode;

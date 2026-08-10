import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { buildProjectContext } from '../lib/projectContext';
import ParameterSlider from '../components/ParameterSlider';
import ReferenceStrip from '../components/ReferenceStrip';
import { ImageIcon, Loader2, Download, XCircle, ChevronDown, ChevronRight } from 'lucide-react';
import { generateImage } from '../services/geminiService';
import { downloadFile } from '../lib/utils';
import { useAssets } from '../hooks/useAssets';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { toast } from '../store/useToastStore';
import { AnimatePresence } from 'motion/react';
import { NodeProps } from '../types/nodeProps';
import { IMAGE_MODELS, getAspectRatioLabel } from './imagenModels';
import ImagenAdvancedPanel from './ImagenAdvancedPanel';
import { NodeField, NodeSelect, NodeLabel } from './ui';

interface ImagenNodeData {
  type: 'imagen';
  config?: {
    model?: string;
    aspectRatio?: string;
    resolution?: string;
    sampleCount?: number;
    seed?: number;
    personGeneration?: string;
    enhancePrompt?: boolean;
    addWatermark?: boolean;
    safetySetting?: string;
    temperature?: number;
    topP?: number;
    topK?: number;
    mimeType?: string;
    grounding?: boolean;
    thinkingBudget?: number;
    referenceStrength?: number;
    referenceRoles?: string[];
  };
  outputs?: string[];
  label?: string;
  isGenerating?: boolean;
  isRunning?: boolean;
  [key: string]: unknown;
}

const ImagenNode = ({ id, data }: NodeProps<ImagenNodeData>) => {
  const [model, setModel] = useState(data.config?.model || 'gemini-3.1-flash-image');
  const [aspectRatio, setAspectRatio] = useState(data.config?.aspectRatio || '1:1');
  const [resolution, setResolution] = useState(data.config?.resolution || '1K');
  const [sampleCount, setSampleCount] = useState(data.config?.sampleCount || 1);
  const [seed, setSeed] = useState<number | undefined>(data.config?.seed);
  const [personGeneration, setPersonGeneration] = useState(data.config?.personGeneration || 'allow_adult');
  const [enhancePrompt, setEnhancePrompt] = useState(data.config?.enhancePrompt ?? true);
  const [addWatermark, setAddWatermark] = useState(data.config?.addWatermark ?? true);
  const [safetySetting, setSafetySetting] = useState(data.config?.safetySetting || 'block_only_high');
  const [temperature, setTemperature] = useState(data.config?.temperature ?? 1.0);
  const [topP, setTopP] = useState(data.config?.topP ?? 0.95);
  const [topK, setTopK] = useState(data.config?.topK ?? 64);
  const [mimeType, setMimeType] = useState(data.config?.mimeType || 'image/png');
  const [grounding, setGrounding] = useState(data.config?.grounding ?? false);
  const [thinkingBudget, setThinkingBudget] = useState(data.config?.thinkingBudget || 4096);
  const [referenceStrength, setReferenceStrength] = useState(data.config?.referenceStrength || 50);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [outputs, setOutputs] = useState<string[]>(data.outputs || []);

  const updateNodeData = useStore((state) => state.updateNodeData);
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const { currentProject, uploadEnabled } = useProjectStore();
  const { addAsset } = useAssets({ autoFetch: false });
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const { setExpandedAsset } = useAssetExpand();

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const currentModelConfig = useMemo(() => {
    return IMAGE_MODELS.find(m => m.id === model) || IMAGE_MODELS[0];
  }, [model]);

  // Imagen was removed (404s on this Vertex project) — every remaining model is
  // a Gemini/Nano Banana multimodal image model.
  const isImagen4 = false;
  const isNanoBanana = currentModelConfig.family.startsWith('nanoBanana');

  const referenceImages = useMemo(() => {
    if (!currentModelConfig.supports.referenceImages) return [];
    const refEdges = edges.filter(e => e.target === id && e.targetHandle === 'reference');
    return refEdges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      return {
        edgeId: edge.id,
        url: sourceNode?.data?.output,
        role: data.config?.referenceRoles?.[edge.id] || 'style',
        strength: referenceStrength
      };
    }).filter(ref => ref.url);
  }, [edges, nodes, id, data.config?.referenceRoles, referenceStrength, currentModelConfig.supports.referenceImages]);

  const handleUpdateRole = (edgeId: string, role: string) => {
    updateNodeData(id, {
      config: { ...data.config, referenceRoles: { ...(data.config?.referenceRoles || {}), [edgeId]: role } }
    });
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
    updateNodeData(id, { isRunning: false, progress: undefined, error: 'Generation cancelled' });
  };

  const handleDownload = (url: string) => {
    downloadFile(url, `generated-image-${Date.now()}.png`);
  };

  const updateConfig = useCallback((key: string, value: any) => {
    updateNodeData(id, { config: { ...data.config, [key]: value } });
  }, [id, data.config, updateNodeData]);

  const handleRun = async () => {
    const state = useStore.getState();
    const nodeEdges = state.edges.filter(e => e.target === id);

    const promptEdge = nodeEdges.find(e => e.targetHandle === 'prompt');
    const promptNode = state.nodes.find(n => n.id === promptEdge?.source);
    const prompt = promptNode?.data?.output;

    if (!prompt) {
      updateNodeData(id, { error: "No prompt input connected" });
      return;
    }

    abortControllerRef.current = new AbortController();
    startTimeRef.current = Date.now();
    updateNodeData(id, { isRunning: true, error: undefined, progress: '0:00' });

    const projectContext = buildProjectContext(currentProject) || undefined;

    const updateTimer = () => {
      if (!startTimeRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      updateNodeData(id, { progress: `${mins}:${secs.toString().padStart(2, '0')}` });
    };
    timerRef.current = setInterval(updateTimer, 1000);

    try {
      const params: any = {
        prompt,
        model,
        aspectRatio,
        projectContext,
        projectId: uploadEnabled ? currentProject?.id : undefined,
      };

      if (isImagen4) {
        params.sampleCount = sampleCount;
        if (seed !== undefined) params.seed = seed;
        if (personGeneration) params.personGeneration = personGeneration;
        if (enhancePrompt !== undefined) params.enhancePrompt = enhancePrompt;
        if (addWatermark !== undefined) params.addWatermark = addWatermark;
        if (safetySetting) params.safetySetting = safetySetting;
      }

      if (isNanoBanana) {
        params.resolution = resolution;
        params.imageSize = resolution;
        params.candidateCount = sampleCount;
        if (seed !== undefined) params.seed = seed;
        if (temperature !== undefined) params.temperature = temperature;
        if (topP !== undefined) params.topP = topP;
        if (topK !== undefined) params.topK = topK;
        if (mimeType) params.mimeType = mimeType;
        if (grounding) params.grounding = grounding;
        if (currentModelConfig.supports.thinkingLevel) params.thinkingBudget = thinkingBudget;
        if (referenceImages.length > 0) {
          params.referenceImages = referenceImages.map(ref => ({
            url: ref.url,
            role: ref.role,
            strength: ref.strength
          }));
        }
      }

      const result = await generateImage(params, abortControllerRef.current.signal);

      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

      const imageUrls = Array.isArray(result) ? result : [result];
      setOutputs(imageUrls);
      updateNodeData(id, { output: imageUrls[0], outputs: imageUrls, isRunning: false, progress: undefined });

      imageUrls.forEach((url: string, i: number) => {
        if (url) {
          addAsset({
            name: `Generated Image ${i + 1} - ${new Date().toLocaleTimeString()}`,
            type: 'image',
            url,
            thumbnailUrl: url,
            tags: ['generated', 'image', isImagen4 ? 'imagen4' : 'nanoBanana']
          });
        }
      });

      toast.success('Image generated', `${imageUrls.length} image${imageUrls.length > 1 ? 's' : ''} ready`);

    } catch (err: unknown) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (!(err instanceof Error && err.name === 'AbortError')) {
        const displayMessage = message.includes('timed out')
          ? 'Generation timed out. Try a simpler prompt.'
          : message;
        updateNodeData(id, { error: displayMessage, isRunning: false, progress: undefined });
        toast.error('Image generation failed', displayMessage);
      }
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      startTimeRef.current = null;
      abortControllerRef.current = null;
    }
  };

  const aspectRatioOptions = Array.isArray(currentModelConfig.supports.aspectRatio)
    ? currentModelConfig.supports.aspectRatio
    : [];
  const resolutionOptions = Array.isArray(currentModelConfig.supports.resolution)
    ? currentModelConfig.supports.resolution
    : [];

  return (
    <BaseNode id={id} data={{ ...data, label: 'Image Generator' }} inputs={true} onRun={handleRun}>
      <div className="space-y-3">
        {/* Model */}
        <NodeField label="Model">
          <NodeSelect value={model} onChange={(e) => { setModel(e.target.value); updateConfig('model', e.target.value); }}>
            {IMAGE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </NodeSelect>
        </NodeField>

        {/* Aspect ratio / resolution / output count */}
        <div className="grid grid-cols-2 gap-2">
          <NodeField label="Aspect ratio">
            <NodeSelect value={aspectRatio} onChange={(e) => { setAspectRatio(e.target.value); updateConfig('aspectRatio', e.target.value); }}>
              {aspectRatioOptions.map((ar) => <option key={ar} value={ar}>{getAspectRatioLabel(ar)}</option>)}
            </NodeSelect>
          </NodeField>

          {isNanoBanana && resolutionOptions.length > 0 && (
            <NodeField label="Resolution">
              <NodeSelect value={resolution} onChange={(e) => { setResolution(e.target.value); updateConfig('resolution', e.target.value); }}>
                {resolutionOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </NodeSelect>
            </NodeField>
          )}

          {isImagen4 && (
            <NodeField label="Output count">
              <NodeSelect value={sampleCount} onChange={(e) => { setSampleCount(Number(e.target.value)); updateConfig('sampleCount', Number(e.target.value)); }}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} image{n > 1 ? 's' : ''}</option>)}
              </NodeSelect>
            </NodeField>
          )}

          {isNanoBanana && (
            <NodeField label="Output count">
              <NodeSelect value={sampleCount} onChange={(e) => { setSampleCount(Number(e.target.value)); updateConfig('sampleCount', Number(e.target.value)); }}>
                <option value={1}>1 image</option>
                <option value={2}>2 images</option>
              </NodeSelect>
            </NodeField>
          )}
        </div>

        {/* Advanced toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex w-full items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2 text-[11px] font-medium text-gray-400 ring-1 ring-white/10 transition-[color,box-shadow] duration-150 hover:text-white hover:ring-white/20"
        >
          <span>Advanced</span>
          {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <ImagenAdvancedPanel
              currentModelConfig={currentModelConfig}
              isImagen4={isImagen4}
              isNanoBanana={isNanoBanana}
              seed={seed}
              personGeneration={personGeneration}
              enhancePrompt={enhancePrompt}
              addWatermark={addWatermark}
              safetySetting={safetySetting}
              temperature={temperature}
              topP={topP}
              topK={topK}
              mimeType={mimeType}
              grounding={grounding}
              thinkingBudget={thinkingBudget}
              onSeedChange={(v) => { setSeed(v); updateConfig('seed', v); }}
              onPersonGenerationChange={(v) => { setPersonGeneration(v); updateConfig('personGeneration', v); }}
              onEnhancePromptChange={(v) => { setEnhancePrompt(v); updateConfig('enhancePrompt', v); }}
              onAddWatermarkChange={(v) => { setAddWatermark(v); updateConfig('addWatermark', v); }}
              onSafetySettingChange={(v) => { setSafetySetting(v); updateConfig('safetySetting', v); }}
              onTemperatureChange={(v) => { setTemperature(v); updateConfig('temperature', v); }}
              onTopPChange={(v) => { setTopP(v); updateConfig('topP', v); }}
              onTopKChange={(v) => { setTopK(v); updateConfig('topK', v); }}
              onMimeTypeChange={(v) => { setMimeType(v); updateConfig('mimeType', v); }}
              onGroundingChange={(v) => { setGrounding(v); updateConfig('grounding', v); }}
              onThinkingBudgetChange={(v) => { setThinkingBudget(v); updateConfig('thinkingBudget', v); }}
            />
          )}
        </AnimatePresence>

        {/* Reference Images */}
        {currentModelConfig.supports.referenceImages === true && (
          <>
            <ReferenceStrip
              nodeId={id}
              references={referenceImages}
              onUpdateRole={handleUpdateRole}
            />
            {referenceImages.length > 0 && (
              <ParameterSlider
                label="Reference Strength"
                value={referenceStrength}
                min={0}
                max={100}
                onChange={(v) => { setReferenceStrength(v); updateConfig('referenceStrength', v); }}
                color="#0097A7"
              />
            )}
          </>
        )}

        {/* Generate */}
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={data.isRunning}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0097A7] text-[12px] font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.98] disabled:opacity-50"
          >
            {data.isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />}
            {data.isRunning ? 'Generating…' : 'Generate image'}
          </button>

          {data.isRunning && (
            <button
              onClick={handleCancel}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-400 ring-1 ring-red-500/25 transition-[transform,background-color] duration-150 hover:bg-red-500/15 active:scale-[0.96]"
              title="Cancel"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Outputs */}
        {outputs.length > 0 && (
          <div className="mt-2 space-y-2">
            <NodeLabel>{outputs.length > 1 ? `${outputs.length} results` : 'Result'}</NodeLabel>

            {outputs.length === 1 ? (
              <ExpandableAssetWrapper onClick={() => setExpandedAsset(outputs[0], 'image')} type="image" className="h-[200px]">
                <img src={outputs[0]} alt="Generated" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              </ExpandableAssetWrapper>
            ) : (
              <div className="grid grid-cols-2 gap-1.5">
                {outputs.map((url, i) => (
                  <div key={url + i} className="group relative">
                    <ExpandableAssetWrapper onClick={() => setExpandedAsset(url, 'image')} type="image" className="aspect-square">
                      <img src={url} alt={`Generated ${i + 1}`} className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    </ExpandableAssetWrapper>
                    <button
                      onClick={() => handleDownload(url)}
                      className="absolute right-1 top-1 z-10 inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default React.memo(ImagenNode);

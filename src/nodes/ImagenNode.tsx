import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import ParameterSlider from '../components/ParameterSlider';
import ReferenceStrip from '../components/ReferenceStrip';
import { ImageIcon, Loader2, Download, XCircle, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { generateImage } from '../services/geminiService';
import { downloadFile } from '../lib/utils';
import { useAssets } from '../hooks/useAssets';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { toast } from '../store/useToastStore';
import { motion, AnimatePresence } from 'motion/react';

const IMAGE_MODELS = [
  {
    id: 'imagen-4.0-ultra-generate-001',
    label: 'Imagen 4 Ultra',
    price: 0.06,
    family: 'imagen4',
    supports: {
      aspectRatio: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      sampleCount: true,
      seed: true,
      personGeneration: true,
      enhancePrompt: true,
      addWatermark: true,
      safetySetting: true,
      referenceImages: false,
      style: false,
      negativePrompt: false,
      resolution: false,
      temperature: false,
      topP: false,
      topK: false,
      candidateCount: false,
      mimeType: false,
      grounding: false,
    }
  },
  {
    id: 'imagen-4.0-generate-001',
    label: 'Imagen 4',
    price: 0.04,
    family: 'imagen4',
    supports: {
      aspectRatio: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      sampleCount: true,
      seed: true,
      personGeneration: true,
      enhancePrompt: true,
      addWatermark: true,
      safetySetting: true,
      referenceImages: false,
      style: false,
      negativePrompt: false,
      resolution: false,
      temperature: false,
      topP: false,
      topK: false,
      candidateCount: false,
      mimeType: false,
      grounding: false,
    }
  },
  {
    id: 'imagen-4.0-fast-generate-001',
    label: 'Imagen 4 Fast',
    price: 0.02,
    family: 'imagen4',
    supports: {
      aspectRatio: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      sampleCount: true,
      seed: true,
      personGeneration: true,
      enhancePrompt: true,
      addWatermark: true,
      safetySetting: true,
      referenceImages: false,
      style: false,
      negativePrompt: false,
      resolution: false,
      temperature: false,
      topP: false,
      topK: false,
      candidateCount: false,
      mimeType: false,
      grounding: false,
    }
  },
  {
    id: 'gemini-3.1-flash-image-preview',
    label: 'Nano Banana 2',
    price: null,
    family: 'nanoBanana2',
    supports: {
      aspectRatio: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:8', '8:1'],
      resolution: ['512', '768', '1K', '2K', '4K'],
      candidateCount: true,
      temperature: true,
      topP: true,
      topK: true,
      seed: true,
      mimeType: true,
      safetyFilters: true,
      grounding: true,
      referenceImages: true,
      style: true,
      negativePrompt: false,
      sampleCount: false,
      personGeneration: false,
      enhancePrompt: false,
      addWatermark: false,
      safetySetting: false,
    }
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana 1',
    price: null,
    family: 'nanoBanana',
    supports: {
      aspectRatio: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
      resolution: ['512', '768', '1K', '2K'],
      candidateCount: true,
      temperature: true,
      topP: true,
      topK: true,
      seed: true,
      mimeType: true,
      safetyFilters: true,
      grounding: false,
      referenceImages: true,
      style: true,
      negativePrompt: false,
      sampleCount: false,
      personGeneration: false,
      enhancePrompt: false,
      addWatermark: false,
      safetySetting: false,
    }
  },
  {
    id: 'gemini-3-pro-image-preview',
    label: 'Nano Banana Pro',
    price: null,
    family: 'nanoBananaPro',
    supports: {
      aspectRatio: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
      resolution: ['512', '768', '1K', '2K', '4K'],
      candidateCount: true,
      temperature: true,
      topP: true,
      topK: true,
      seed: true,
      mimeType: true,
      safetyFilters: true,
      grounding: true,
      thinkingLevel: true,
      referenceImages: true,
      style: true,
      negativePrompt: false,
      sampleCount: false,
      personGeneration: false,
      enhancePrompt: false,
      addWatermark: false,
      safetySetting: false,
    }
  },
];

const ImagenNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'imagen-4.0-generate-001');
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
  const { addAsset } = useAssets();
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressTickerRef = useRef<NodeJS.Timeout | null>(null);
  const { setExpandedAsset } = useAssetExpand();

  useEffect(() => {
    return () => {
      if (progressTickerRef.current) clearInterval(progressTickerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const currentModelConfig = useMemo(() => {
    return IMAGE_MODELS.find(m => m.id === model) || IMAGE_MODELS[0];
  }, [model]);

  const isImagen4 = currentModelConfig.family === 'imagen4';
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
      updateNodeData(id, { isRunning: false, progress: 0, error: 'Generation cancelled' });
    }
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
    updateNodeData(id, { isRunning: true, error: undefined, progress: 5 });

    const projectContext = currentProject ? `
      Project: ${currentProject.name}
      Type: ${currentProject.type}
      Description: ${currentProject.description}
      Brand: ${currentProject.clientName}
      AI Instructions: ${currentProject.aiInstructions}
      Style Keywords: ${currentProject.styleKeywords}
    `.trim() : undefined;

    let tickerProgress = 20;
    progressTickerRef.current = setInterval(() => {
      tickerProgress = Math.min(tickerProgress + 3, 78);
      updateNodeData(id, { progress: tickerProgress });
    }, 800);

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

      if (progressTickerRef.current) {
        clearInterval(progressTickerRef.current);
        progressTickerRef.current = null;
      }

      const imageUrls = Array.isArray(result) ? result : [result];
      setOutputs(imageUrls);
      updateNodeData(id, { output: imageUrls[0], outputs: imageUrls, isRunning: false, progress: 100 });

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
      if (progressTickerRef.current) {
        clearInterval(progressTickerRef.current);
        progressTickerRef.current = null;
      }
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (!(err instanceof Error && err.name === 'AbortError')) {
        const displayMessage = message.includes('timed out') 
          ? 'Generation timed out. Try a simpler prompt.'
          : message;
        updateNodeData(id, { error: displayMessage, isRunning: false });
        toast.error('Image generation failed', displayMessage);
      }
    } finally {
      if (progressTickerRef.current) {
        clearInterval(progressTickerRef.current);
        progressTickerRef.current = null;
      }
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
    <BaseNode 
      id={id} 
      data={{ ...data, label: 'Image Generator' }} 
      inputs={true} 
      onRun={handleRun} 
      className="border-[#0097A7]"
    >
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Model</label>
          <select 
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none focus:border-[#0097A7]"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              updateConfig('model', e.target.value);
            }}
          >
            <optgroup label="Imagen 4 (Text-to-Image)">
              {IMAGE_MODELS.filter(m => m.family === 'imagen4').map(m => (
                <option key={m.id} value={m.id}>{m.label} (${m.price}/img)</option>
              ))}
            </optgroup>
            <optgroup label="Nano Banana (Multimodal)">
              {IMAGE_MODELS.filter(m => m.family.startsWith('nanoBanana')).map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Aspect Ratio</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={aspectRatio}
              onChange={(e) => { setAspectRatio(e.target.value); updateConfig('aspectRatio', e.target.value); }}
            >
              {aspectRatioOptions.map(ar => <option key={ar} value={ar}>{ar}</option>)}
            </select>
          </div>

          {isNanoBanana && resolutionOptions.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Resolution</label>
              <select 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                value={resolution}
                onChange={(e) => { setResolution(e.target.value); updateConfig('resolution', e.target.value); }}
              >
                {resolutionOptions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}

          {isImagen4 && (
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Output Count</label>
              <select 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                value={sampleCount}
                onChange={(e) => { setSampleCount(Number(e.target.value)); updateConfig('sampleCount', Number(e.target.value)); }}
              >
                {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n} image{n > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          )}

          {isNanoBanana && (
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Output Count</label>
              <select 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                value={sampleCount}
                onChange={(e) => { setSampleCount(Number(e.target.value)); updateConfig('sampleCount', Number(e.target.value)); }}
              >
                <option value={1}>1 image</option>
                <option value={2}>2 images</option>
              </select>
            </div>
          )}
        </div>

        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between py-1.5 px-2 bg-[#111] rounded-lg border border-[#2a2a2a] text-[10px] text-gray-400 hover:text-white hover:border-[#0097A7]/50 transition-colors"
        >
          <span className="font-bold uppercase">Advanced</span>
          {showAdvanced ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden space-y-3"
            >
              {currentModelConfig.supports.seed && (
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Seed</label>
                  <input
                    type="number"
                    className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-[#0097A7]"
                    placeholder="Random"
                    value={seed ?? ''}
                    onChange={(e) => { 
                      const v = e.target.value ? parseInt(e.target.value) : undefined;
                      setSeed(v); 
                      updateConfig('seed', v); 
                    }}
                  />
                </div>
              )}

              {isImagen4 && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Person Generation</label>
                    <select 
                      className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                      value={personGeneration}
                      onChange={(e) => { setPersonGeneration(e.target.value); updateConfig('personGeneration', e.target.value); }}
                    >
                      <option value="allow_all">Allow All</option>
                      <option value="allow_adult">Allow Adults</option>
                      <option value="dont_allow">Disallow All</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Safety Setting</label>
                    <select 
                      className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                      value={safetySetting}
                      onChange={(e) => { setSafetySetting(e.target.value); updateConfig('safetySetting', e.target.value); }}
                    >
                      <option value="block_low_and_above">Block Low & Above</option>
                      <option value="block_medium_and_above">Block Medium & Above</option>
                      <option value="block_only_high">Block Only High</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <label className="flex items-center gap-2 py-1.5 px-2 bg-[#111] rounded-lg border border-[#2a2a2a] cursor-pointer hover:border-[#0097A7]/50">
                      <input
                        type="checkbox"
                        checked={enhancePrompt}
                        onChange={(e) => { setEnhancePrompt(e.target.checked); updateConfig('enhancePrompt', e.target.checked); }}
                        className="accent-[#0097A7]"
                      />
                      <span className="text-[10px] text-gray-400">Enhance Prompt</span>
                    </label>
                    <label className="flex items-center gap-2 py-1.5 px-2 bg-[#111] rounded-lg border border-[#2a2a2a] cursor-pointer hover:border-[#0097A7]/50">
                      <input
                        type="checkbox"
                        checked={addWatermark}
                        onChange={(e) => { setAddWatermark(e.target.checked); updateConfig('addWatermark', e.target.checked); }}
                        className="accent-[#0097A7]"
                      />
                      <span className="text-[10px] text-gray-400">Watermark</span>
                    </label>
                  </div>
                </>
              )}

              {isNanoBanana && (
                <>
                  <ParameterSlider
                    label="Temperature"
                    value={temperature}
                    min={0}
                    max={2}
                    step={0.1}
                    onChange={(v) => { setTemperature(v); updateConfig('temperature', v); }}
                    color="#0097A7"
                  />
                  <ParameterSlider
                    label="Top P"
                    value={topP}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(v) => { setTopP(v); updateConfig('topP', v); }}
                    color="#0097A7"
                  />
                  <ParameterSlider
                    label="Top K"
                    value={topK}
                    min={1}
                    max={64}
                    step={1}
                    onChange={(v) => { setTopK(v); updateConfig('topK', v); }}
                    color="#0097A7"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase font-bold">Format</label>
                      <select 
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                        value={mimeType}
                        onChange={(e) => { setMimeType(e.target.value); updateConfig('mimeType', e.target.value); }}
                      >
                        <option value="image/png">PNG</option>
                        <option value="image/jpeg">JPEG</option>
                        <option value="image/webp">WebP</option>
                      </select>
                    </div>

                    {currentModelConfig.supports.grounding && (
                      <label className="flex items-center gap-2 py-1.5 px-2 bg-[#111] rounded-lg border border-[#2a2a2a] cursor-pointer hover:border-[#0097A7]/50">
                        <input
                          type="checkbox"
                          checked={grounding}
                          onChange={(e) => { setGrounding(e.target.checked); updateConfig('grounding', e.target.checked); }}
                          className="accent-[#0097A7]"
                        />
                        <span className="text-[10px] text-gray-400">Grounding</span>
                      </label>
                    )}
                  </div>

                  {currentModelConfig.supports.thinkingLevel && (
                    <div className="space-y-1">
                      <label className="text-[10px] text-gray-500 uppercase font-bold">Thinking Budget</label>
                      <select 
                        className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                        value={thinkingBudget}
                        onChange={(e) => { 
                          const v = parseInt(e.target.value);
                          setThinkingBudget(v); 
                          updateConfig('thinkingBudget', v); 
                        }}
                      >
                        <option value={1024}>Low (1K tokens)</option>
                        <option value={4096}>Medium (4K tokens)</option>
                        <option value={8192}>High (8K tokens)</option>
                      </select>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

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

        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={data.isRunning}
            className="flex-1 py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImageIcon className="w-3 h-3" />}
            {data.isRunning ? "GENERATING..." : "GENERATE IMAGE"}
          </button>
          
          {data.isRunning && (
            <button
              onClick={handleCancel}
              className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg transition-all flex items-center justify-center"
              title="Cancel"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {outputs.length > 0 && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                {outputs.length > 1 ? `${outputs.length} Results` : 'Result'}
              </span>
            </div>
            
            {outputs.length === 1 ? (
              <ExpandableAssetWrapper
                onClick={() => setExpandedAsset(outputs[0], 'image')}
                type="image"
                className="h-[200px]"
              >
                <img 
                  src={outputs[0]} 
                  alt="Generated" 
                  className="w-full h-full object-cover transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
              </ExpandableAssetWrapper>
            ) : (
              <div className="grid grid-cols-2 gap-1">
                {outputs.map((url, i) => (
                  <div key={url + i} className="relative group">
                    <ExpandableAssetWrapper
                      onClick={() => setExpandedAsset(url, 'image')}
                      type="image"
                      className="aspect-square"
                    >
                      <img 
                        src={url} 
                        alt={`Generated ${i + 1}`} 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </ExpandableAssetWrapper>
                    <button
                      onClick={() => handleDownload(url)}
                      className="absolute top-1 right-1 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Download className="w-3 h-3 text-white" />
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

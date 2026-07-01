import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { generateAudio } from '../services/geminiService';
import AudioPreview from '../components/AudioPreview';
import { useAssets } from '../hooks/useAssets';
import { Music, Mic2, Loader2, Download, ChevronDown, ChevronRight, XCircle } from 'lucide-react';
import ReferenceStrip from '../components/ReferenceStrip';
import ParameterSlider from '../components/ParameterSlider';
import { downloadFile } from '../lib/utils';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { toast } from '../store/useToastStore';
import { motion, AnimatePresence } from 'motion/react';
import { NodeProps } from '../types/nodeProps';
import { MUSICAL_KEYS } from './lyriaConstants';
import { NodeField, NodeLabel, NodeInput, NodeSelect } from './ui';

interface LyriaNodeData {
  type: 'lyria';
  config?: {
    model?: string;
    genre?: string;
    mood?: string;
    instrumentation?: string;
    vocalStyle?: string;
    language?: string;
    duration?: number;
    negativePrompt?: string;
    seed?: number;
    temperature?: number;
    guidance?: number;
    bpm?: number;
    density?: number;
    brightness?: number;
    scale?: string;
    topP?: number;
    topK?: number;
    voice?: string;
  };
  output?: string;
  isRunning?: boolean;
  error?: string;
  progress?: number;
  [key: string]: unknown;
}

const LyriaNode = ({ id, data }: NodeProps<LyriaNodeData>) => {
  const [model, setModel] = useState(data.config?.model || 'lyria-3-pro-preview');
  const [genre, setGenre] = useState(data.config?.genre || 'Cinematic');
  const [mood, setMood] = useState(data.config?.mood || 'Epic');
  const [instrumentation, setInstrumentation] = useState(data.config?.instrumentation || 'Orchestra, Piano');
  const [vocalStyle, setVocalStyle] = useState(data.config?.vocalStyle || 'None');
  const [language, setLanguage] = useState(data.config?.language || 'English');
  const [duration, setDuration] = useState(data.config?.duration || 60);
  const [negativePrompt, setNegativePrompt] = useState(data.config?.negativePrompt || '');
  const [seed, setSeed] = useState<number | undefined>(data.config?.seed);
  const [temperature, setTemperature] = useState(data.config?.temperature ?? 1.0);
  const [guidance, setGuidance] = useState(data.config?.guidance ?? 4.0);
  const [bpm, setBpm] = useState(data.config?.bpm || 120);
  const [density, setDensity] = useState(data.config?.density ?? 0.5);
  const [brightness, setBrightness] = useState(data.config?.brightness ?? 0.5);
  const [scale, setScale] = useState(data.config?.scale || 'C Major');
  const [topP, setTopP] = useState(data.config?.topP ?? 0.95);
  const [topK, setTopK] = useState(data.config?.topK ?? 64);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSoundDesign, setShowSoundDesign] = useState(false);
  
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject, uploadEnabled } = useProjectStore();
  const { addAsset } = useAssets();
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const { setExpandedAsset } = useAssetExpand();
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  const isLyria = model.includes('lyria');
  const isPro = model.includes('pro');
  const isTTS = model.includes('tts');

  const referenceImages = useMemo(() => {
    if (!isLyria) return [];
    const refEdges = edges.filter(e => e.target === id && e.targetHandle === 'reference');
    return refEdges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      return { edgeId: edge.id, url: sourceNode?.data?.output };
    }).filter(ref => ref.url);
  }, [edges, nodes, id, isLyria]);

  const updateConfig = useCallback((key: string, value: any) => {
    updateNodeData(id, { config: { ...data.config, [key]: value } });
  }, [id, data.config, updateNodeData]);

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

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id && e.targetHandle === 'prompt');
    const promptNode = state.nodes.find(n => n.id === incomingEdge?.source);
    const userPrompt = promptNode?.data?.output || '';

    abortControllerRef.current = new AbortController();
    startTimeRef.current = Date.now();
    updateNodeData(id, { isRunning: true, error: undefined, progress: '0:00' });

    const updateTimer = () => {
      if (!startTimeRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      updateNodeData(id, { progress: `${mins}:${secs.toString().padStart(2, '0')}` });
    };
    timerRef.current = setInterval(updateTimer, 1000);

    try {
      let finalPrompt = userPrompt;
      if (isLyria) {
        finalPrompt = `Genre: ${genre}. Mood: ${mood}. Instrumentation: ${instrumentation}. Tempo: ${bpm} BPM. Key: ${scale}. Vocal Style: ${vocalStyle}. Language: ${language}. ${userPrompt}`.trim();
      }

      const audioUrl = await generateAudio({
        prompt: finalPrompt,
        model,
        projectId: uploadEnabled ? currentProject?.id : undefined,
        referenceImages: isLyria ? referenceImages.map(r => ({ url: r.url })) : undefined,
        negativePrompt: isLyria ? negativePrompt : undefined,
        duration: isPro ? duration : undefined,
        seed: isLyria ? seed : undefined,
        temperature: isLyria ? temperature : undefined,
        guidance: isLyria ? guidance : undefined,
        bpm: isLyria ? bpm : undefined,
        density: isLyria ? density : undefined,
        brightness: isLyria ? brightness : undefined,
        topP: isLyria ? topP : undefined,
        topK: isLyria ? topK : undefined,
        voice: isTTS ? data.config?.voice || 'Kore' : undefined,
      }, abortControllerRef.current?.signal);

      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      updateNodeData(id, { output: audioUrl, isRunning: false, progress: undefined });

      if (audioUrl) {
        addAsset({
          name: `Generated ${isLyria ? 'Music' : 'Audio'} - ${new Date().toLocaleTimeString()}`,
          type: 'audio',
          url: audioUrl,
          thumbnailUrl: audioUrl,
          tags: ['generated', 'audio', isLyria ? 'lyria' : 'tts']
        });
        toast.success(isLyria ? 'Music generated' : 'Audio generated', 'Your audio is ready');
      }

    } catch (err: unknown) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (!(err instanceof Error && err.name === 'AbortError')) {
        const displayMessage = message.includes('timed out') 
          ? 'Audio generation timed out. Try a shorter duration.'
          : message;
        updateNodeData(id, { error: displayMessage, isRunning: false, progress: undefined });
        toast.error('Audio generation failed', displayMessage);
      }
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      startTimeRef.current = null;
      abortControllerRef.current = null;
    }
  };

  return (
    <BaseNode id={id} data={{ ...data, label: (data.label as string) ?? 'Audio Generator' }} inputs={true} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Model">
          <NodeSelect value={model} onChange={(e) => { setModel(e.target.value); updateConfig('model', e.target.value); }}>
            <option value="lyria-3-pro-preview">Lyria 3 Pro ($0.08/song)</option>
            <option value="lyria-3-clip-preview">Lyria 3 Clip ($0.04/30s)</option>
            <option value="gemini-2.5-flash-preview-tts">Text to speech</option>
          </NodeSelect>
        </NodeField>

        {isLyria ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <NodeField label="Genre">
                <NodeInput value={genre} onChange={(e) => { setGenre(e.target.value); updateConfig('genre', e.target.value); }} placeholder="e.g. Synthwave" />
              </NodeField>
              <NodeField label="Mood">
                <NodeInput value={mood} onChange={(e) => { setMood(e.target.value); updateConfig('mood', e.target.value); }} placeholder="e.g. Nostalgic" />
              </NodeField>
            </div>

            <NodeField label="Instrumentation">
              <NodeInput value={instrumentation} onChange={(e) => { setInstrumentation(e.target.value); updateConfig('instrumentation', e.target.value); }} placeholder="e.g. Electric Guitar, Drums" />
            </NodeField>

            <div className="grid grid-cols-2 gap-2">
              <NodeField label="Language">
                <NodeSelect value={language} onChange={(e) => { setLanguage(e.target.value); updateConfig('language', e.target.value); }}>
                  {['English', 'Spanish', 'French', 'German', 'Hindi', 'Japanese', 'Korean', 'Portuguese', 'Arabic', 'Italian'].map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </NodeSelect>
              </NodeField>
              <NodeField label="Vocal style">
                <NodeInput value={vocalStyle} onChange={(e) => { setVocalStyle(e.target.value); updateConfig('vocalStyle', e.target.value); }} placeholder="e.g. Rasping Male" />
              </NodeField>
            </div>

            {isPro && (
              <ParameterSlider label="Duration (seconds)" value={duration} min={10} max={184} onChange={(v) => { setDuration(v); updateConfig('duration', v); }} />
            )}

            <button
              onClick={() => setShowSoundDesign(!showSoundDesign)}
              className="flex w-full items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2 text-[11px] font-medium text-gray-400 ring-1 ring-white/10 transition-[color,box-shadow] duration-150 hover:text-white hover:ring-white/20"
            >
              <span>Sound design</span>
              {showSoundDesign ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <AnimatePresence>
              {showSoundDesign && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                  className="space-y-3 overflow-hidden"
                >
                  <ParameterSlider label="BPM" value={bpm} min={60} max={200} onChange={(v) => { setBpm(v); updateConfig('bpm', v); }} />
                  <ParameterSlider label="Guidance" value={guidance} min={0} max={6} step={0.1} onChange={(v) => { setGuidance(v); updateConfig('guidance', v); }} />
                  <ParameterSlider label="Density" value={density} min={0} max={1} step={0.05} onChange={(v) => { setDensity(v); updateConfig('density', v); }} />
                  <ParameterSlider label="Brightness" value={brightness} min={0} max={1} step={0.05} onChange={(v) => { setBrightness(v); updateConfig('brightness', v); }} />
                  <NodeField label="Musical key">
                    <NodeSelect value={scale} onChange={(e) => { setScale(e.target.value); updateConfig('scale', e.target.value); }}>
                      {MUSICAL_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </NodeSelect>
                  </NodeField>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-2 text-[11px] font-medium text-gray-400 ring-1 ring-white/10 transition-[color,box-shadow] duration-150 hover:text-white hover:ring-white/20"
            >
              <span>Advanced</span>
              {showAdvanced ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                  className="space-y-3 overflow-hidden"
                >
                  <NodeField label="Negative prompt">
                    <NodeInput value={negativePrompt} onChange={(e) => { setNegativePrompt(e.target.value); updateConfig('negativePrompt', e.target.value); }} placeholder="Instruments/styles to avoid…" />
                  </NodeField>
                  <ParameterSlider label="Temperature" value={temperature} min={0} max={3} step={0.1} onChange={(v) => { setTemperature(v); updateConfig('temperature', v); }} />
                  <ParameterSlider label="Top P" value={topP} min={0} max={1} step={0.05} onChange={(v) => { setTopP(v); updateConfig('topP', v); }} />
                  <ParameterSlider label="Top K" value={topK} min={1} max={64} step={1} onChange={(v) => { setTopK(v); updateConfig('topK', v); }} />
                  <NodeField label="Seed">
                    <NodeInput
                      type="number"
                      value={seed ?? ''}
                      onChange={(e) => { const v = e.target.value ? parseInt(e.target.value) : undefined; setSeed(v); updateConfig('seed', v); }}
                      placeholder="Random"
                    />
                  </NodeField>
                  <ReferenceStrip
                    nodeId={id}
                    references={referenceImages.map((r) => ({ edgeId: r.edgeId, url: r.url, role: 'style' as const, strength: 0.5 }))}
                    onUpdateRole={() => {}}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <NodeField label="Voice">
            <NodeSelect value={data.config?.voice || 'Kore'} onChange={(e) => updateConfig('voice', e.target.value)}>
              {['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr', 'Aoede', 'Leda', 'Orus'].map((v) => <option key={v} value={v}>{v}</option>)}
            </NodeSelect>
          </NodeField>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={data.isRunning}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0097A7] text-[12px] font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.98] disabled:opacity-50"
          >
            {data.isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Music className="h-3.5 w-3.5" />}
            {data.isRunning ? 'Generating…' : `Generate ${isLyria ? 'music' : 'audio'}`}
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

        {data.output && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <NodeLabel>Result audio</NodeLabel>
              <button
                onClick={() => downloadFile(data.output, `generated-audio-${Date.now()}.wav`)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-gray-400 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:bg-[#0097A7] hover:text-white active:scale-[0.96]"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
            </div>
            <ExpandableAssetWrapper onClick={() => setExpandedAsset(data.output, 'audio')} type="audio">
              <AudioPreview url={data.output} />
            </ExpandableAssetWrapper>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default React.memo(LyriaNode);

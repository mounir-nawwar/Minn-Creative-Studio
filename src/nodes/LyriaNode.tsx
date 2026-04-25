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
    <BaseNode id={id} data={{ ...data, label: data.label as string ?? 'Audio Generator' }} inputs={true} onRun={handleRun} className="border-[#0097A7]">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Model</label>
          <select 
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none focus:border-[#0097A7]"
            value={model}
            onChange={(e) => { setModel(e.target.value); updateConfig('model', e.target.value); }}
          >
            <option value="lyria-3-pro-preview">Lyria 3 Pro ($0.08/song)</option>
            <option value="lyria-3-clip-preview">Lyria 3 Clip ($0.04/30s)</option>
            <option value="gemini-2.5-flash-preview-tts">Text to Speech</option>
          </select>
        </div>

        {isLyria ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase font-bold">Genre</label>
                <input 
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-[#0097A7]"
                  value={genre}
                  onChange={(e) => { setGenre(e.target.value); updateConfig('genre', e.target.value); }}
                  placeholder="e.g. Synthwave"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase font-bold">Mood</label>
                <input 
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-[#0097A7]"
                  value={mood}
                  onChange={(e) => { setMood(e.target.value); updateConfig('mood', e.target.value); }}
                  placeholder="e.g. Nostalgic"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Instrumentation</label>
              <input 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-[#0097A7]"
                value={instrumentation}
                onChange={(e) => { setInstrumentation(e.target.value); updateConfig('instrumentation', e.target.value); }}
                placeholder="e.g. Electric Guitar, Drums"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase font-bold">Language</label>
                <select 
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                  value={language}
                  onChange={(e) => { setLanguage(e.target.value); updateConfig('language', e.target.value); }}
                >
                  {['English', 'Spanish', 'French', 'German', 'Hindi', 'Japanese', 'Korean', 'Portuguese', 'Arabic', 'Italian'].map(l => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase font-bold">Vocal Style</label>
                <input 
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-[#0097A7]"
                  value={vocalStyle}
                  onChange={(e) => { setVocalStyle(e.target.value); updateConfig('vocalStyle', e.target.value); }}
                  placeholder="e.g. Rasping Male"
                />
              </div>
            </div>

            {isPro && (
              <ParameterSlider 
                label="Duration (Seconds)" 
                value={duration} 
                min={10} 
                max={184} 
                onChange={(v) => { setDuration(v); updateConfig('duration', v); }}
                color="#0097A7"
              />
            )}

            <button
              onClick={() => setShowSoundDesign(!showSoundDesign)}
              className="w-full flex items-center justify-between py-1.5 px-2 bg-[#111] rounded-lg border border-[#2a2a2a] text-[10px] text-gray-400 hover:text-white hover:border-[#0097A7]/50 transition-colors"
            >
              <span className="font-bold uppercase">Sound Design</span>
              {showSoundDesign ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>

            <AnimatePresence>
              {showSoundDesign && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden space-y-3"
                >
                  <ParameterSlider 
                    label="BPM" 
                    value={bpm} 
                    min={60} 
                    max={200} 
                    onChange={(v) => { setBpm(v); updateConfig('bpm', v); }}
                    color="#0097A7"
                  />
                  <ParameterSlider 
                    label="Guidance" 
                    value={guidance} 
                    min={0} 
                    max={6} 
                    step={0.1}
                    onChange={(v) => { setGuidance(v); updateConfig('guidance', v); }}
                    color="#0097A7"
                  />
                  <ParameterSlider 
                    label="Density" 
                    value={density} 
                    min={0} 
                    max={1} 
                    step={0.05}
                    onChange={(v) => { setDensity(v); updateConfig('density', v); }}
                    color="#0097A7"
                  />
                  <ParameterSlider 
                    label="Brightness" 
                    value={brightness} 
                    min={0} 
                    max={1} 
                    step={0.05}
                    onChange={(v) => { setBrightness(v); updateConfig('brightness', v); }}
                    color="#0097A7"
                  />

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Musical Key</label>
                    <select 
                      className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                      value={scale}
                      onChange={(e) => { setScale(e.target.value); updateConfig('scale', e.target.value); }}
                    >
                      {MUSICAL_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

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
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Negative Prompt</label>
                    <input 
                      className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-[#0097A7]"
                      value={negativePrompt}
                      onChange={(e) => { setNegativePrompt(e.target.value); updateConfig('negativePrompt', e.target.value); }}
                      placeholder="Instruments/styles to avoid..."
                    />
                  </div>

                  <ParameterSlider 
                    label="Temperature" 
                    value={temperature} 
                    min={0} 
                    max={3} 
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

                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Seed</label>
                    <input 
                      type="number"
                      className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-[#0097A7]"
                      value={seed ?? ''}
                      onChange={(e) => { 
                        const v = e.target.value ? parseInt(e.target.value) : undefined;
                        setSeed(v); 
                        updateConfig('seed', v); 
                      }}
                      placeholder="Random"
                    />
                  </div>

                  <ReferenceStrip 
                    nodeId={id} 
                    references={referenceImages.map(r => ({ edgeId: r.edgeId, url: r.url, role: 'style' as const, strength: 0.5 }))} 
                    onUpdateRole={() => {}} 
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Voice</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={data.config?.voice || 'Kore'}
              onChange={(e) => updateConfig('voice', e.target.value)}
            >
              <option value="Kore">Kore</option>
              <option value="Puck">Puck</option>
              <option value="Charon">Charon</option>
              <option value="Fenrir">Fenrir</option>
              <option value="Zephyr">Zephyr</option>
              <option value="Aoede">Aoede</option>
              <option value="Leda">Leda</option>
              <option value="Orus">Orus</option>
            </select>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={data.isRunning}
            className="flex-1 py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Music className="w-3 h-3" />}
            {data.isRunning ? "GENERATING..." : `GENERATE ${isLyria ? 'MUSIC' : 'AUDIO'}`}
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

        {data.output && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Result Audio</span>
              <button 
                onClick={() => downloadFile(data.output, `generated-audio-${Date.now()}.wav`)}
                className="p-1.5 bg-[#1a1a1a] hover:bg-[#0097A7] text-gray-400 hover:text-white rounded-lg transition-all border border-[#2a2a2a]"
              >
                <Download className="w-3 h-3" />
              </button>
            </div>
            <ExpandableAssetWrapper
              onClick={() => setExpandedAsset(data.output, 'audio')}
              type="audio"
            >
              <AudioPreview url={data.output} />
            </ExpandableAssetWrapper>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default React.memo(LyriaNode);

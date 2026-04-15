import React, { useState, useMemo } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { generateAudio } from '../services/geminiService';
import AudioPreview from '../components/AudioPreview';
import { useAssets } from '../hooks/useAssets';
import { Music, Mic2, Sparkles, Loader2, Download } from 'lucide-react';
import ReferenceStrip from '../components/ReferenceStrip';
import ParameterSlider from '../components/ParameterSlider';
import { downloadFile } from '../lib/utils';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { toast } from '../store/useToastStore';

const LyriaNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'lyria-3-pro-preview');
  const [genre, setGenre] = useState(data.config?.genre || 'Cinematic');
  const [mood, setMood] = useState(data.config?.mood || 'Epic');
  const [instrumentation, setInstrumentation] = useState(data.config?.instrumentation || 'Orchestra, Piano');
  const [tempo, setTempo] = useState(data.config?.tempo || 'Moderate');
  const [vocalStyle, setVocalStyle] = useState(data.config?.vocalStyle || 'None');
  const [language, setLanguage] = useState(data.config?.language || 'English');
  const [duration, setDuration] = useState(data.config?.duration || 30);
  const [negativePrompt, setNegativePrompt] = useState(data.config?.negativePrompt || '');
  const [seed, setSeed] = useState(data.config?.seed);
  const [temperature, setTemperature] = useState(data.config?.temperature || 1.0);
  
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject, uploadEnabled } = useProjectStore();
  const { addAsset } = useAssets();
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const { setExpandedAsset } = useAssetExpand();

  const isLyria = model.includes('lyria');
  const isPro = model.includes('pro');

  const referenceImages = useMemo(() => {
    const refEdges = edges.filter(e => e.target === id && e.targetHandle === 'reference');
    return refEdges.map(edge => {
      const sourceNode = nodes.find(n => n.id === edge.source);
      return {
        edgeId: edge.id,
        url: sourceNode?.data?.output,
      };
    }).filter(ref => ref.url);
  }, [edges, nodes, id]);

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id && e.targetHandle === 'prompt');
    const promptNode = state.nodes.find(n => n.id === incomingEdge?.source);
    const userPrompt = promptNode?.data?.output || '';

    updateNodeData(id, { isRunning: true, error: undefined, progress: 10 });

    try {
      let finalPrompt = userPrompt;
      if (isLyria) {
        finalPrompt = `Genre: ${genre}. Mood: ${mood}. Instrumentation: ${instrumentation}. Tempo: ${tempo}. Vocal Style: ${vocalStyle}. Language: ${language}. ${userPrompt}`.trim();
      }

      updateNodeData(id, { progress: 30 });
      const audioUrl = await generateAudio({
        prompt: finalPrompt,
        model,
        projectId: uploadEnabled ? currentProject?.id : undefined,
        referenceImages: referenceImages.map(r => ({ url: r.url })),
        negativePrompt: isLyria ? negativePrompt : undefined,
        duration: isPro ? duration : undefined,
        seed: isLyria ? seed : undefined,
        temperature: isLyria ? temperature : undefined,
      });

      updateNodeData(id, { output: audioUrl, isRunning: false, progress: 100 });

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
      const message = err instanceof Error ? err.message : 'Unknown error';
      const displayMessage = message.includes('timed out') 
        ? 'Audio generation timed out. Try a shorter duration.'
        : message;
      updateNodeData(id, { error: displayMessage, isRunning: false });
      toast.error('Audio generation failed', displayMessage);
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun} className="border-[#0097A7]">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Model</label>
          <select 
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              updateNodeData(id, { config: { ...data.config, model: e.target.value } });
            }}
          >
            <option value="lyria-3-pro-preview">Lyria 3 Pro (Full Songs)</option>
            <option value="lyria-3-clip-preview">Lyria 3 Clip (30s Hooks)</option>
            <option value="gemini-2.5-flash-preview-tts">Text to Speech</option>
          </select>
        </div>

        {isLyria ? (
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Genre</label>
              <input 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                placeholder="e.g. Synthwave"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Mood</label>
              <input 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300"
                value={mood}
                onChange={(e) => setMood(e.target.value)}
                placeholder="e.g. Nostalgic"
              />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Instrumentation</label>
              <input 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300"
                value={instrumentation}
                onChange={(e) => setInstrumentation(e.target.value)}
                placeholder="e.g. Electric Guitar, Drums"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Tempo</label>
              <input 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300"
                value={tempo}
                onChange={(e) => setTempo(e.target.value)}
                placeholder="e.g. 120 BPM"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Language</label>
              <select 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                {['English', 'Spanish', 'French', 'German', 'Hindi', 'Japanese', 'Korean', 'Portuguese'].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Voice</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={data.config?.voice || 'Kore'}
              onChange={(e) => updateNodeData(id, { config: { ...data.config, voice: e.target.value } })}
            >
              <option value="Kore">Kore</option>
              <option value="Puck">Puck</option>
              <option value="Charon">Charon</option>
              <option value="Fenrir">Fenrir</option>
              <option value="Zephyr">Zephyr</option>
            </select>
          </div>
        )}

        {isLyria && (
          <>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Vocal Style</label>
              <input 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300"
                value={vocalStyle}
                onChange={(e) => setVocalStyle(e.target.value)}
                placeholder="e.g. Rasping Male Vocals"
              />
            </div>

            {isPro && (
              <ParameterSlider 
                label="Duration (Seconds)" 
                value={duration} 
                min={10} 
                max={184} 
                onChange={(v) => setDuration(v)}
                color="#0097A7"
              />
            )}

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Negative Prompt</label>
              <input 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300"
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                placeholder="Instruments/styles to avoid..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase font-bold">Seed</label>
                <input 
                  type="number"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300"
                  value={seed || ''}
                  onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                  placeholder="Random"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase font-bold">Temperature</label>
                <input 
                  type="number" step="0.1" min="0" max="2"
                  className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                />
              </div>
            </div>

            <ReferenceStrip 
              nodeId={id} 
              references={referenceImages.map(r => ({ edgeId: r.edgeId, url: r.url, role: 'style' as const, strength: 0.5 }))} 
              onUpdateRole={() => {}} 
            />
          </>
        )}

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Music className="w-3 h-3" />}
          {data.isRunning ? "GENERATING..." : `GENERATE ${isLyria ? 'MUSIC' : 'AUDIO'}`}
        </button>

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

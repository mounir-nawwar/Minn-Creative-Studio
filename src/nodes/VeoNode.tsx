import React, { useState, useMemo, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import ParameterSlider from '../components/ParameterSlider';
import ReferenceStrip from '../components/ReferenceStrip';
import { Video, Loader2, AlertCircle, XCircle, Download } from 'lucide-react';
import { generateVideo } from '../services/geminiService';
import { downloadFile } from '../lib/utils';
import { useAssets } from '../hooks/useAssets';

const VeoNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'veo-3.1-fast-generate-001');
  const [aspectRatio, setAspectRatio] = useState(data.config?.aspectRatio || '16:9');
  const [resolution, setResolution] = useState(data.config?.resolution || '720p');
  const [duration, setDuration] = useState(data.config?.duration || 8);
  const [sampleCount, setSampleCount] = useState(data.config?.sampleCount || 1);
  const [style, setStyle] = useState(data.config?.style || 'Cinematic');
  const [referenceStrength, setReferenceStrength] = useState(data.config?.referenceStrength || 50);
  const [negativePrompt, setNegativePrompt] = useState(data.config?.negativePrompt || '');
  const [personGeneration, setPersonGeneration] = useState(data.config?.personGeneration || 'allow_adult');
  const [audio, setAudio] = useState<boolean>(data.config?.audio ?? true);
  const [resizeMode, setResizeMode] = useState(data.config?.resizeMode || 'crop');
  
  const updateNodeData = useStore((state) => state.updateNodeData);
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const { currentProject } = useProjectStore();
  const { addAsset } = useAssets();
  const abortControllerRef = useRef<AbortController | null>(null);

  const referenceImages = useMemo(() => {
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
  }, [edges, nodes, id, data.config?.referenceRoles, referenceStrength]);

  const startFrame = useMemo(() => {
    const edge = edges.find(e => e.target === id && e.targetHandle === 'startFrame');
    const node = nodes.find(n => n.id === edge?.source);
    return node?.data?.output;
  }, [edges, nodes, id]);

  const endFrame = useMemo(() => {
    const edge = edges.find(e => e.target === id && e.targetHandle === 'endFrame');
    const node = nodes.find(n => n.id === edge?.source);
    return node?.data?.output;
  }, [edges, nodes, id]);

  const inputVideo = useMemo(() => {
    const edge = edges.find(e => e.target === id && e.targetHandle === 'video');
    const node = nodes.find(n => n.id === edge?.source);
    return node?.data?.output;
  }, [edges, nodes, id]);

  const handleUpdateRole = (edgeId: string, role: string) => {
    updateNodeData(id, {
      config: {
        ...data.config,
        referenceRoles: {
          ...(data.config?.referenceRoles || {}),
          [edgeId]: role
        }
      }
    });
  };

  const isDurationSupported = useMemo(() => {
    const max = model.includes('fast') ? 10 : 30;
    return duration <= max;
  }, [model, duration]);

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      updateNodeData(id, { isRunning: false, progress: 0, error: 'Generation cancelled' });
    }
  };

  const handleDownload = () => {
    if (!data.output) return;
    downloadFile(data.output, `generated-video-${Date.now()}.mp4`);
  };

  const handleRun = async () => {
    const state = useStore.getState();
    const nodeEdges = state.edges.filter(e => e.target === id);
    
    // Find prompt input
    const promptEdge = nodeEdges.find(e => e.targetHandle === 'prompt');
    const promptNode = state.nodes.find(n => n.id === promptEdge?.source);
    const prompt = promptNode?.data?.output;

    // Find parameter inputs
    const motionEdge = nodeEdges.find(e => e.targetHandle === 'motion');
    const seedEdge = nodeEdges.find(e => e.targetHandle === 'seed');

    const parameters = {
      seed: state.nodes.find(n => n.id === seedEdge?.source)?.data?.output,
      motionIntensity: state.nodes.find(n => n.id === motionEdge?.source)?.data?.output,
    };

    if (!prompt && !startFrame) {
      updateNodeData(id, { error: "No prompt or start frame connected" });
      return;
    }

    abortControllerRef.current = new AbortController();
    updateNodeData(id, { isRunning: true, error: undefined, progress: 10 });

    // Construct project context string
    const projectContext = currentProject ? `
      Project: ${currentProject.name}
      Type: ${currentProject.type}
      Description: ${currentProject.description}
      Brand: ${currentProject.clientName} (${currentProject.clientIndustry})
      AI Instructions: ${currentProject.aiInstructions}
      Style Keywords: ${currentProject.styleKeywords}
    `.trim() : undefined;

    try {
      const finalPrompt = `${prompt} in ${style} style.`;
      const videos = await generateVideo({
        prompt: finalPrompt,
        model,
        aspectRatio,
        resolution,
        duration,
        sampleCount,
        negativePrompt: negativePrompt || undefined,
        seed: parameters.seed !== undefined ? Number(parameters.seed) : undefined,
        personGeneration,
        audio,
        resizeMode,
        startFrameUrl: startFrame,
        endFrameUrl: endFrame,
        referenceImages: referenceImages.map(ref => ({
          url: ref.url,
          role: ref.role,
          strength: ref.strength
        })),
        motionIntensity: parameters.motionIntensity,
        videoUrl: inputVideo,
        projectId: currentProject?.id,
        projectContext,
        onProgress: (p) => updateNodeData(id, { progress: p })
      }, abortControllerRef.current.signal);

      // Server already uploaded to Storage — URLs are permanent
      updateNodeData(id, { output: videos[0], outputs: videos, isRunning: false, progress: 100 });

      // Add to Assets grid
      videos.forEach((url, i) => {
        if (url) {
          addAsset({
            name: `Generated Video - ${new Date().toLocaleTimeString()} (${i + 1})`,
            type: 'video',
            url: url,
            thumbnailUrl: startFrame || url,
            tags: ['generated', 'video', 'veo']
          });
        }
      });

    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.log('Video generation aborted');
      } else {
        updateNodeData(id, { error: err.message, isRunning: false });
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun} className="border-[#FF5722]">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 col-span-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Model</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={model}
              onChange={(e) => {
                setModel(e.target.value);
                updateNodeData(id, { config: { ...data.config, model: e.target.value } });
              }}
            >
              <option value="veo-3.1-fast-generate-001">Veo 3.1 Fast</option>
              <option value="veo-3.1-generate-001">Veo 3.1 (High Quality)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Aspect Ratio</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={aspectRatio}
              onChange={(e) => {
                setAspectRatio(e.target.value);
                updateNodeData(id, { config: { ...data.config, aspectRatio: e.target.value } });
              }}
            >
              <option value="16:9">16:9 Landscape</option>
              <option value="9:16">9:16 Portrait</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Resolution</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={resolution}
              onChange={(e) => {
                setResolution(e.target.value);
                updateNodeData(id, { config: { ...data.config, resolution: e.target.value } });
              }}
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4K">4K (Ultra)</option>
            </select>
          </div>

          <div className="space-y-1 col-span-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Style</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={style}
              onChange={(e) => {
                setStyle(e.target.value);
                updateNodeData(id, { config: { ...data.config, style: e.target.value } });
              }}
            >
              <option value="Cinematic">Cinematic</option>
              <option value="Photorealistic">Photorealistic</option>
              <option value="Hand-drawn">Hand-drawn</option>
              <option value="3D Animation">3D Animation</option>
              <option value="Abstract">Abstract</option>
            </select>
          </div>

          <div className="space-y-1 col-span-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Duration</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={duration}
              onChange={(e) => {
                setDuration(Number(e.target.value));
                updateNodeData(id, { config: { ...data.config, duration: Number(e.target.value) } });
              }}
            >
              {[4, 6, 8].map(d => (
                <option key={d} value={d}>{d} seconds</option>
              ))}
            </select>
            {!isDurationSupported && (
              <div className="flex items-center gap-1 text-[8px] text-orange-400 font-bold mt-1">
                <AlertCircle className="w-2 h-2" />
                <span>Valid durations: 4s, 6s, 8s</span>
              </div>
            )}
          </div>

          <div className="space-y-1 col-span-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Output Videos</label>
            <select
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={sampleCount}
              onChange={(e) => {
                setSampleCount(Number(e.target.value));
                updateNodeData(id, { config: { ...data.config, sampleCount: Number(e.target.value) } });
              }}
            >
              <option value={1}>1 Video</option>
              <option value={2}>2 Videos</option>
              <option value={3}>3 Videos</option>
              <option value={4}>4 Videos</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Person Generation</label>
            <select
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={personGeneration}
              onChange={(e) => {
                setPersonGeneration(e.target.value);
                updateNodeData(id, { config: { ...data.config, personGeneration: e.target.value } });
              }}
            >
              <option value="allow_adult">Allow Adults</option>
              <option value="disallow">Disallow All</option>
            </select>
          </div>

          {startFrame && (
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Resize Mode</label>
              <select
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                value={resizeMode}
                onChange={(e) => {
                  setResizeMode(e.target.value);
                  updateNodeData(id, { config: { ...data.config, resizeMode: e.target.value } });
                }}
              >
                <option value="crop">Crop to fit</option>
                <option value="pad">Pad to fit</option>
              </select>
            </div>
          )}

          <div className="col-span-2 flex items-center justify-between py-1 px-2 bg-[#111] rounded-lg border border-[#2a2a2a]">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Native Audio</label>
            <button
              onClick={() => {
                const next = !audio;
                setAudio(next);
                updateNodeData(id, { config: { ...data.config, audio: next } });
              }}
              className={`relative w-8 h-4 rounded-full transition-colors ${audio ? 'bg-[#FF5722]' : 'bg-[#2a2a2a]'}`}
            >
              <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${audio ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </button>
          </div>

          <div className="space-y-1 col-span-2">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Negative Prompt</label>
            <input
              type="text"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-[#FF5722]"
              placeholder="Avoid (e.g. blur, distorted, text)..."
              value={negativePrompt}
              onChange={(e) => {
                setNegativePrompt(e.target.value);
                updateNodeData(id, { config: { ...data.config, negativePrompt: e.target.value } });
              }}
            />
          </div>
        </div>

        <div className="flex gap-2">
          {inputVideo && (
            <div className="flex-1 space-y-1">
              <label className="text-[8px] text-gray-600 uppercase font-bold">Input Video</label>
              <div className="aspect-video rounded border border-[#2a2a2a] overflow-hidden bg-black">
                <video src={inputVideo} className="w-full h-full object-cover" muted />
              </div>
            </div>
          )}
          {startFrame && (
            <div className="flex-1 space-y-1">
              <label className="text-[8px] text-gray-600 uppercase font-bold">Start Frame</label>
              <div className="aspect-video rounded border border-[#2a2a2a] overflow-hidden bg-black">
                <img src={startFrame} className="w-full h-full object-cover" alt="Start" referrerPolicy="no-referrer" />
              </div>
            </div>
          )}
          {endFrame && (
            <div className="flex-1 space-y-1">
              <label className="text-[8px] text-gray-600 uppercase font-bold">End Frame</label>
              <div className="aspect-video rounded border border-[#2a2a2a] overflow-hidden bg-black">
                <img src={endFrame} className="w-full h-full object-cover" alt="End" referrerPolicy="no-referrer" />
              </div>
            </div>
          )}
        </div>

        <ReferenceStrip 
          nodeId={id} 
          references={referenceImages} 
          onUpdateRole={handleUpdateRole} 
        />

        <ParameterSlider 
          label="Reference Strength" 
          value={referenceStrength} 
          min={0} 
          max={100} 
          onChange={(v) => {
            setReferenceStrength(v);
            updateNodeData(id, { config: { ...data.config, referenceStrength: v } });
          }}
          color="#FF5722"
        />

        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={data.isRunning}
            className="flex-1 py-2 bg-[#FF5722] hover:bg-[#E64A19] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
            {data.isRunning ? "GENERATING..." : "GENERATE VIDEO"}
          </button>
          
          {data.isRunning && (
            <button
              onClick={handleCancel}
              className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-lg transition-all flex items-center justify-center"
              title="Cancel Generation"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {data.output && (
          <div className="mt-2 space-y-2">
            {(data.outputs && data.outputs.length > 1 ? data.outputs : [data.output]).map((url: string, i: number) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">
                    {data.outputs?.length > 1 ? `Video ${i + 1}` : 'Result Video'}
                  </span>
                  <button
                    onClick={() => downloadFile(url, `generated-video-${i + 1}-${Date.now()}.mp4`)}
                    className="p-1.5 bg-[#1a1a1a] hover:bg-[#FF5722] text-gray-400 hover:text-white rounded-lg transition-all border border-[#2a2a2a]"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
                <div className="rounded-xl overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
                  <video src={url} className="w-full h-auto" controls loop autoPlay muted />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default VeoNode;

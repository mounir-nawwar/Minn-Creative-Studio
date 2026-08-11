import React, { useState, useMemo, useRef, useEffect } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { buildProjectContext } from '../lib/projectContext';
import ParameterSlider from '../components/ParameterSlider';
import ReferenceStrip from '../components/ReferenceStrip';
import { Video, Loader2, AlertCircle, XCircle, Download } from 'lucide-react';
import { generateVideo } from '../services/geminiService';
import { downloadFile } from '../lib/utils';
import { useAssets } from '../hooks/useAssets';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { toast } from '../store/useToastStore';
import { NodeProps } from '../types/nodeProps';
import { NodeField, NodeSelect, NodeInput, NodeLabel } from './ui';
import { VIDEO_MODELS, resolveVideoModel } from '../lib/models';

interface VeoNodeData {
  type: 'veo';
  config?: {
    model?: string;
    aspectRatio?: string;
    resolution?: string;
    duration?: number;
    sampleCount?: number;
    style?: string;
    referenceStrength?: number;
    referenceRoles?: Record<string, 'style' | 'background' | 'composition' | 'character' | 'subject'>;
    negativePrompt?: string;
    personGeneration?: string;
    audio?: boolean;
    resizeMode?: string;
  };
  output?: string;
  outputs?: string[];
  isRunning?: boolean;
  error?: string;
  progress?: number;
  [key: string]: unknown;
}

const VeoNode = ({ id, data }: NodeProps<VeoNodeData>) => {
  const [model, setModel] = useState(() => resolveVideoModel(data.config?.model));
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
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    startTimeRef.current = null;
    updateNodeData(id, { isRunning: false, progress: undefined, error: 'Generation cancelled' });
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

    const projectContext = buildProjectContext(currentProject) || undefined;

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
        projectId: uploadEnabled ? currentProject?.id : undefined,
        projectContext,
      }, abortControllerRef.current.signal);

      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      updateNodeData(id, { output: videos[0], outputs: videos, isRunning: false, progress: undefined });

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

      if (videos.length > 0 && videos[0]) {
        toast.success('Video generated', `${videos.length} video${videos.length > 1 ? 's' : ''} ready`);
      }

    } catch (err: unknown) {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Video generation aborted');
      } else {
        const displayMessage = message.includes('timed out') 
          ? 'Video generation timed out after 10 minutes. Try a shorter duration or simpler prompt.'
          : message;
        updateNodeData(id, { error: displayMessage, isRunning: false, progress: undefined });
        toast.error('Video generation failed', displayMessage);
      }
    } finally {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      startTimeRef.current = null;
      abortControllerRef.current = null;
    }
  };

  return (
    <BaseNode id={id} data={{ ...data, label: (data.label as string) ?? 'Video Generator' }} inputs={true} onRun={handleRun}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <NodeField label="Model">
              <NodeSelect value={model} onChange={(e) => { setModel(e.target.value); updateNodeData(id, { config: { ...data.config, model: e.target.value } }); }}>
                {VIDEO_MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
              </NodeSelect>
            </NodeField>
          </div>

          <NodeField label="Aspect ratio">
            <NodeSelect value={aspectRatio} onChange={(e) => { setAspectRatio(e.target.value); updateNodeData(id, { config: { ...data.config, aspectRatio: e.target.value } }); }}>
              <option value="16:9">16:9 Landscape</option>
              <option value="9:16">9:16 Portrait</option>
            </NodeSelect>
          </NodeField>

          <NodeField label="Resolution">
            <NodeSelect value={resolution} onChange={(e) => { setResolution(e.target.value); updateNodeData(id, { config: { ...data.config, resolution: e.target.value } }); }}>
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4K">4K (Ultra)</option>
            </NodeSelect>
          </NodeField>

          <div className="col-span-2">
            <NodeField label="Style">
              <NodeSelect value={style} onChange={(e) => { setStyle(e.target.value); updateNodeData(id, { config: { ...data.config, style: e.target.value } }); }}>
                <option value="Cinematic">Cinematic</option>
                <option value="Photorealistic">Photorealistic</option>
                <option value="Hand-drawn">Hand-drawn</option>
                <option value="3D Animation">3D Animation</option>
                <option value="Abstract">Abstract</option>
              </NodeSelect>
            </NodeField>
          </div>

          <div className="col-span-2 space-y-1.5">
            <NodeField label="Duration">
              <NodeSelect value={duration} onChange={(e) => { setDuration(Number(e.target.value)); updateNodeData(id, { config: { ...data.config, duration: Number(e.target.value) } }); }}>
                {[4, 6, 8].map((d) => <option key={d} value={d}>{d} seconds</option>)}
              </NodeSelect>
            </NodeField>
            {!isDurationSupported && (
              <div className="flex items-center gap-1 text-[10px] text-orange-400">
                <AlertCircle className="h-3 w-3" />
                <span>Valid durations: 4s, 6s, 8s</span>
              </div>
            )}
          </div>

          <div className="col-span-2">
            <NodeField label="Output videos">
              <NodeSelect value={sampleCount} onChange={(e) => { setSampleCount(Number(e.target.value)); updateNodeData(id, { config: { ...data.config, sampleCount: Number(e.target.value) } }); }}>
                {[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n} video{n > 1 ? 's' : ''}</option>)}
              </NodeSelect>
            </NodeField>
          </div>

          <NodeField label="Person generation">
            <NodeSelect value={personGeneration} onChange={(e) => { setPersonGeneration(e.target.value); updateNodeData(id, { config: { ...data.config, personGeneration: e.target.value } }); }}>
              <option value="allow_adult">Allow adults</option>
              <option value="disallow">Disallow all</option>
            </NodeSelect>
          </NodeField>

          {startFrame && (
            <NodeField label="Resize mode">
              <NodeSelect value={resizeMode} onChange={(e) => { setResizeMode(e.target.value); updateNodeData(id, { config: { ...data.config, resizeMode: e.target.value } }); }}>
                <option value="crop">Crop to fit</option>
                <option value="pad">Pad to fit</option>
              </NodeSelect>
            </NodeField>
          )}

          <div className="col-span-2 flex items-center justify-between rounded-lg bg-white/[0.03] px-2.5 py-1.5 ring-1 ring-white/10">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Native audio</span>
            <button
              onClick={() => { const next = !audio; setAudio(next); updateNodeData(id, { config: { ...data.config, audio: next } }); }}
              className={`relative h-4 w-8 rounded-full transition-colors duration-150 ${audio ? 'bg-[#0097A7]' : 'bg-white/15'}`}
            >
              <span className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform duration-150 ${audio ? 'translate-x-[16px]' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="col-span-2">
            <NodeField label="Negative prompt">
              <NodeInput
                type="text"
                placeholder="Avoid (e.g. blur, distorted, text)…"
                value={negativePrompt}
                onChange={(e) => { setNegativePrompt(e.target.value); updateNodeData(id, { config: { ...data.config, negativePrompt: e.target.value } }); }}
              />
            </NodeField>
          </div>
        </div>

        {(inputVideo || startFrame || endFrame) && (
          <div className="flex gap-2">
            {inputVideo && (
              <div className="flex-1 space-y-1">
                <NodeLabel>Input video</NodeLabel>
                <div className="aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
                  <video src={inputVideo} className="h-full w-full object-cover" muted />
                </div>
              </div>
            )}
            {startFrame && (
              <div className="flex-1 space-y-1">
                <NodeLabel>Start frame</NodeLabel>
                <div className="aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
                  <img src={startFrame} className="h-full w-full object-cover" alt="Start" referrerPolicy="no-referrer" />
                </div>
              </div>
            )}
            {endFrame && (
              <div className="flex-1 space-y-1">
                <NodeLabel>End frame</NodeLabel>
                <div className="aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
                  <img src={endFrame} className="h-full w-full object-cover" alt="End" referrerPolicy="no-referrer" />
                </div>
              </div>
            )}
          </div>
        )}

        <ReferenceStrip nodeId={id} references={referenceImages} onUpdateRole={handleUpdateRole} />

        <ParameterSlider
          label="Reference strength"
          value={referenceStrength}
          min={0}
          max={100}
          onChange={(v) => { setReferenceStrength(v); updateNodeData(id, { config: { ...data.config, referenceStrength: v } }); }}
        />

        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={data.isRunning}
            className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0097A7] text-[12px] font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.98] disabled:opacity-50"
          >
            {data.isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
            {data.isRunning ? 'Generating…' : 'Generate video'}
          </button>

          {data.isRunning && (
            <button
              onClick={handleCancel}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/10 text-red-400 ring-1 ring-red-500/25 transition-[transform,background-color] duration-150 hover:bg-red-500/15 active:scale-[0.96]"
              title="Cancel generation"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>

        {data.output && (
          <div className="mt-2 space-y-2">
            {(data.outputs && data.outputs.length > 1 ? data.outputs : [data.output]).map((url: string, i: number) => (
              <div key={url || `video-${i}`} className="space-y-1">
                <div className="flex items-center justify-between">
                  <NodeLabel>{data.outputs && data.outputs.length > 1 ? `Video ${i + 1}` : 'Result video'}</NodeLabel>
                  <button
                    onClick={() => downloadFile(url, `generated-video-${i + 1}-${Date.now()}.mp4`)}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-gray-400 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:bg-[#0097A7] hover:text-white active:scale-[0.96]"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>
                <ExpandableAssetWrapper onClick={() => setExpandedAsset(url, 'video')} type="video">
                  <video src={url} className="h-auto w-full" controls loop autoPlay muted />
                </ExpandableAssetWrapper>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default React.memo(VeoNode);

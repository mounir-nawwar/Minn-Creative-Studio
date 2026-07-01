import React, { useState, useMemo } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import ParameterSlider from '../components/ParameterSlider';
import ReferenceStrip from '../components/ReferenceStrip';
import { Video, Loader2, AlertCircle } from 'lucide-react';
import { generateVideo } from '../services/geminiService';
import { NodeField, NodeSelect, NodeLabel } from './ui';

const ImageToVideoNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'veo-3.1-fast-generate-001');
  const [aspectRatio, setAspectRatio] = useState(data.config?.aspectRatio || '16:9');
  const [duration, setDuration] = useState(data.config?.duration || 8);
  const [referenceStrength, setReferenceStrength] = useState(data.config?.referenceStrength || 50);

  const updateNodeData = useStore((state) => state.updateNodeData);
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const { currentProject, uploadEnabled } = useProjectStore();

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
    const edge = edges.find(e => e.target === id && e.targetHandle === 'start');
    const node = nodes.find(n => n.id === edge?.source);
    return node?.data?.output;
  }, [edges, nodes, id]);

  const endFrame = useMemo(() => {
    const edge = edges.find(e => e.target === id && e.targetHandle === 'end');
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

    if (!startFrame) {
      updateNodeData(id, { error: "No start image input connected" });
      return;
    }

    updateNodeData(id, { isRunning: true, error: undefined, progress: 10 });

    try {
      const videos = await generateVideo({
        prompt: prompt || 'Animate this image',
        model,
        aspectRatio,
        duration,
        startFrameUrl: startFrame,
        endFrameUrl: endFrame,
        referenceImages: referenceImages.map(ref => ({
          url: ref.url,
          role: ref.role,
          strength: ref.strength
        })),
        motionIntensity: parameters.motionIntensity,
        projectId: uploadEnabled ? currentProject?.id : undefined,
      });

      updateNodeData(id, { output: videos[0], isRunning: false, progress: 100 });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const displayMessage = message.includes('timed out') 
        ? 'Video generation timed out after 10 minutes. Try a shorter duration.'
        : message;
      updateNodeData(id, { error: displayMessage, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Model">
          <NodeSelect value={model} onChange={(e) => { setModel(e.target.value); updateNodeData(id, { config: { ...data.config, model: e.target.value } }); }}>
            <option value="veo-3.1-fast-generate-001">Veo 3.1 Fast</option>
            <option value="veo-3.1-generate-001">Veo 3.1 (High Quality)</option>
          </NodeSelect>
        </NodeField>

        <NodeField label="Aspect ratio">
          <NodeSelect value={aspectRatio} onChange={(e) => { setAspectRatio(e.target.value); updateNodeData(id, { config: { ...data.config, aspectRatio: e.target.value } }); }}>
            <option value="16:9">16:9 Wide</option>
            <option value="9:16">9:16 Tall</option>
          </NodeSelect>
        </NodeField>

        <div className="space-y-1.5">
          <NodeField label="Duration">
            <NodeSelect value={duration} onChange={(e) => { setDuration(Number(e.target.value)); updateNodeData(id, { config: { ...data.config, duration: Number(e.target.value) } }); }}>
              {[4, 6, 8].map((d) => <option key={d} value={d}>{d} seconds</option>)}
            </NodeSelect>
          </NodeField>
          {!isDurationSupported && (
            <div className="flex items-center gap-1 text-[10px] text-orange-400">
              <AlertCircle className="h-3 w-3" />
              <span>Model max is {model.includes('fast') ? 10 : 30}s, clamping on run.</span>
            </div>
          )}
        </div>

        {(startFrame || endFrame) && (
          <div className="flex gap-2">
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

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0097A7] text-[12px] font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.98] disabled:opacity-50"
        >
          {data.isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
          {data.isRunning ? 'Generating…' : 'Generate video'}
        </button>

        {data.output && (
          <div className="mt-2 overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
            <video src={data.output} className="h-auto w-full" controls loop autoPlay muted />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default React.memo(ImageToVideoNode);

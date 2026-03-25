import React, { useState, useMemo } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { Handle, Position } from 'reactflow';
import ParameterSlider from '../components/ParameterSlider';
import ReferenceStrip from '../components/ReferenceStrip';
import { Video, Loader2, AlertCircle } from 'lucide-react';
import { generateVideo } from '../services/geminiService';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

const VeoNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'veo-3.1-fast-generate-preview');
  const [aspectRatio, setAspectRatio] = useState(data.config?.aspectRatio || '16:9');
  const [resolution, setResolution] = useState(data.config?.resolution || '720p');
  const [duration, setDuration] = useState(data.config?.duration || 5);
  const [style, setStyle] = useState(data.config?.style || 'Cinematic');
  const [referenceStrength, setReferenceStrength] = useState(data.config?.referenceStrength || 50);
  
  const updateNodeData = useStore((state) => state.updateNodeData);
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const { currentProject } = useProjectStore();

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
      const videoUrl = await generateVideo({
        prompt: finalPrompt,
        model,
        aspectRatio,
        resolution,
        duration,
        startFrameUrl: startFrame,
        endFrameUrl: endFrame,
        referenceImages: referenceImages.map(ref => ({
          url: ref.url,
          role: ref.role,
          strength: ref.strength
        })),
        motionIntensity: parameters.motionIntensity,
        videoUrl: inputVideo,
        projectContext
      });

      updateNodeData(id, { output: videoUrl, isRunning: false, progress: 100 });

      // Save to Project Assets
      if (currentProject && auth.currentUser) {
        try {
          await addDoc(collection(db, 'projects', currentProject.id, 'assets'), {
            name: `Generated Video - ${new Date().toLocaleTimeString()}`,
            type: 'video',
            url: videoUrl,
            userId: auth.currentUser.uid,
            nodeId: id,
            workflowId: 'current',
            createdAt: serverTimestamp(),
            isFavorited: false,
            metadata: {
              model,
              prompt: finalPrompt,
              rawPrompt: prompt,
              aspectRatio,
              resolution,
              duration,
              style,
              motionIntensity: parameters.motionIntensity,
            }
          });
        } catch (assetErr) {
          console.error("Failed to save asset to library:", assetErr);
        }
      }
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun} color="#FF5722">
      {/* Input Handles */}
      <div className="absolute -left-3 top-0 bottom-0 flex flex-col justify-around py-4">
        <div className="relative group">
          <Handle type="target" position={Position.Left} id="prompt" className="w-3 h-3 !bg-[#FF5722] border-2 border-[#0a0a0a]" />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[8px] text-gray-500 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity">Prompt</span>
        </div>
        <div className="relative group">
          <Handle type="target" position={Position.Left} id="startFrame" className="w-3 h-3 !bg-green-500 border-2 border-[#0a0a0a]" />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[8px] text-gray-500 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Start Frame</span>
        </div>
        <div className="relative group">
          <Handle type="target" position={Position.Left} id="endFrame" className="w-3 h-3 !bg-red-500 border-2 border-[#0a0a0a]" />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[8px] text-gray-500 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">End Frame</span>
        </div>
        <div className="relative group">
          <Handle type="target" position={Position.Left} id="reference" className="w-3 h-3 !bg-orange-500 border-2 border-[#0a0a0a]" />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[8px] text-gray-500 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity">References</span>
        </div>
        <div className="relative group">
          <Handle type="target" position={Position.Left} id="video" className="w-3 h-3 !bg-purple-500 border-2 border-[#0a0a0a]" />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[8px] text-gray-500 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Input Video (Extend)</span>
        </div>
        <div className="relative group">
          <Handle type="target" position={Position.Left} id="motion" className="w-3 h-3 !bg-blue-400 border-2 border-[#0a0a0a]" />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[8px] text-gray-500 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity">Motion</span>
        </div>
        <div className="relative group">
          <Handle type="target" position={Position.Left} id="seed" className="w-3 h-3 !bg-blue-500 border-2 border-[#0a0a0a]" />
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[8px] text-gray-500 uppercase font-bold opacity-0 group-hover:opacity-100 transition-opacity">Seed</span>
        </div>
      </div>

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
              <option value="veo-3.1-fast-generate-preview">Veo 3.1 Fast</option>
              <option value="veo-3.1-generate-preview">Veo 3.1 (High Quality)</option>
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
              <option value="16:9">16:9 Wide</option>
              <option value="9:16">9:16 Tall</option>
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
              {[2, 3, 4, 5, 6, 7, 8, 10, 12, 15, 20, 30].map(d => (
                <option key={d} value={d}>{d} seconds</option>
              ))}
            </select>
            {!isDurationSupported && (
              <div className="flex items-center gap-1 text-[8px] text-orange-400 font-bold mt-1">
                <AlertCircle className="w-2 h-2" />
                <span>Model max is {model.includes('fast') ? 10 : 30}s, clamping on run.</span>
              </div>
            )}
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

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#FF5722] hover:bg-[#E64A19] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Video className="w-3 h-3" />}
          {data.isRunning ? "GENERATING..." : "GENERATE VIDEO"}
        </button>

        {data.output && (
          <div className="mt-2 rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
            <video 
              src={data.output} 
              className="w-full h-auto"
              controls
              loop
              autoPlay
              muted
            />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default VeoNode;

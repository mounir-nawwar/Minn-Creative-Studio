import React, { useState, useMemo, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import ParameterSlider from '../components/ParameterSlider';
import ReferenceStrip from '../components/ReferenceStrip';
import { ImageIcon, Loader2, Download, XCircle } from 'lucide-react';
import { generateImage } from '../services/geminiService';
import { downloadFile } from '../lib/utils';
import { useAssets } from '../hooks/useAssets';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';

const ImagenNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'gemini-3.1-flash-image-preview');
  const [aspectRatio, setAspectRatio] = useState(data.config?.aspectRatio || '1:1');
  const [imageSize, setImageSize] = useState(data.config?.imageSize || '1K');
  const [style, setStyle] = useState(data.config?.style || 'Photorealistic');
  const [negativePrompt, setNegativePrompt] = useState(data.config?.negativePrompt || '');
  const [referenceStrength, setReferenceStrength] = useState(data.config?.referenceStrength || 50);
  
  const updateNodeData = useStore((state) => state.updateNodeData);
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const { currentProject } = useProjectStore();
  const { addAsset } = useAssets();
  const abortControllerRef = useRef<AbortController | null>(null);
  const { setExpandedAsset } = useAssetExpand();

  const isNanoBanana = model.includes('flash') || model.includes('pro');

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

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      updateNodeData(id, { isRunning: false, progress: 0, error: 'Generation cancelled' });
    }
  };

  const handleDownload = () => {
    if (!data.output) return;
    downloadFile(data.output, `generated-image-${Date.now()}.png`);
  };

  const handleRun = async () => {
    const state = useStore.getState();
    const nodeEdges = state.edges.filter(e => e.target === id);
    
    // Find prompt input
    const promptEdge = nodeEdges.find(e => e.targetHandle === 'prompt');
    const promptNode = state.nodes.find(n => n.id === promptEdge?.source);
    const prompt = promptNode?.data?.output;

    // Find parameter inputs
    const seedEdge = nodeEdges.find(e => e.targetHandle === 'seed');
    const guidanceEdge = nodeEdges.find(e => e.targetHandle === 'guidance');
    const cfgEdge = nodeEdges.find(e => e.targetHandle === 'cfg');

    const parameters = {
      seed: state.nodes.find(n => n.id === seedEdge?.source)?.data?.output,
      guidanceStrength: state.nodes.find(n => n.id === guidanceEdge?.source)?.data?.output,
      cfgScale: state.nodes.find(n => n.id === cfgEdge?.source)?.data?.output,
    };

    if (!prompt) {
      updateNodeData(id, { error: "No prompt input connected or prompt is empty" });
      return;
    }

    // Setup AbortController
    abortControllerRef.current = new AbortController();
    updateNodeData(id, { isRunning: true, error: undefined, progress: 5 });

    // Construct project context string
    const projectContext = currentProject ? `
      Project: ${currentProject.name}
      Type: ${currentProject.type}
      Description: ${currentProject.description}
      Brand: ${currentProject.clientName} (${currentProject.clientIndustry})
      AI Instructions: ${currentProject.aiInstructions}
      Style Keywords: ${currentProject.styleKeywords}
    `.trim() : undefined;

    // Fake progress ticker: increments 20 → 78% while waiting for the API
    let tickerProgress = 20;
    const progressTicker = setInterval(() => {
      tickerProgress = Math.min(tickerProgress + 3, 78);
      updateNodeData(id, { progress: tickerProgress });
    }, 800);

    try {
      const finalPrompt = isNanoBanana ? prompt : `${prompt} in ${style} style. ${negativePrompt ? `Avoid: ${negativePrompt}` : ''}`;

      updateNodeData(id, { progress: 20 });

      const imageUrl = await generateImage({
        prompt: finalPrompt,
        model,
        aspectRatio,
        imageSize: isNanoBanana ? imageSize : undefined,
        referenceImages: referenceImages.map(ref => ({
          url: ref.url,
          role: ref.role,
          strength: ref.strength
        })),
        seed: parameters.seed,
        guidanceStrength: parameters.guidanceStrength,
        cfgScale: parameters.cfgScale,
        projectContext,
        projectId: currentProject?.id,
      }, abortControllerRef.current.signal);

      clearInterval(progressTicker);
      // Server already uploaded to Storage — URL is permanent
      updateNodeData(id, { output: imageUrl, isRunning: false, progress: 100 });

      // Add to Assets grid
      if (imageUrl) {
        addAsset({
          name: `Generated Image - ${new Date().toLocaleTimeString()}`,
          type: 'image',
          url: imageUrl,
          thumbnailUrl: imageUrl,
          tags: ['generated', 'image', 'imagen']
        });
      }

    } catch (err: any) {
      clearInterval(progressTicker);
      if (err.name === 'AbortError') {
        console.log('Generation aborted');
      } else {
        updateNodeData(id, { error: err.message, isRunning: false });
      }
    } finally {
      clearInterval(progressTicker);
      abortControllerRef.current = null;
    }
  };

  return (
    <BaseNode id={id} data={{ ...data, label: 'Image Generator' }} inputs={true} onRun={handleRun} className="border-[#0097A7]">
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
              <option value="imagen-4.0-generate-001">Imagen 3 (High Quality)</option>
              <option value="gemini-3.1-flash-image-preview">Nano Banana 2 (Latest)</option>
              <option value="gemini-2.5-flash-image">Nano Banana 1</option>
              <option value="gemini-3-pro-image-preview">Nano Banana Pro</option>
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
              <option value="1:1">1:1 Square</option>
              <option value="16:9">16:9 Wide</option>
              <option value="9:16">9:16 Vertical</option>
              <option value="4:3">4:3 Photo</option>
              <option value="3:4">3:4 Portrait</option>
              <option value="3:2">3:2 Classic</option>
              <option value="2:3">2:3 Classic Port</option>
              <option value="4:5">4:5 Social</option>
              <option value="5:4">5:4 Social Land</option>
              <option value="21:9">21:9 Cinematic</option>
              <option value="9:21">9:21 Ultrawide Vert</option>
            </select>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">{isNanoBanana ? 'Resolution' : 'Style'}</label>
            {isNanoBanana ? (
              <select 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                value={imageSize}
                onChange={(e) => {
                  setImageSize(e.target.value);
                  updateNodeData(id, { config: { ...data.config, imageSize: e.target.value } });
                }}
              >
                <option value="512">512px</option>
                <option value="768">768px</option>
                <option value="1K">1K (Standard)</option>
                <option value="2K">2K (High)</option>
                <option value="4K">4K (Ultra)</option>
              </select>
            ) : (
              <select 
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                value={style}
                onChange={(e) => {
                  setStyle(e.target.value);
                  updateNodeData(id, { config: { ...data.config, style: e.target.value } });
                }}
              >
                <option value="Photorealistic">Photorealistic</option>
                <option value="Illustration">Illustration</option>
                <option value="Cinematic">Cinematic</option>
                <option value="Abstract">Abstract</option>
                <option value="Digital Art">Digital Art</option>
                <option value="3D Render">3D Render</option>
              </select>
            )}
          </div>
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
          color="#0097A7"
        />

        {!isNanoBanana && (
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Negative Prompt</label>
            <input
              type="text"
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-[#0097A7]"
              placeholder="Avoid (e.g. blur, text)..."
              value={negativePrompt}
              onChange={(e) => {
                setNegativePrompt(e.target.value);
                updateNodeData(id, { config: { ...data.config, negativePrompt: e.target.value } });
              }}
            />
          </div>
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
              title="Cancel Generation"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}
        </div>

        {data.output && (
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Result Image</span>
              <button 
                onClick={handleDownload}
                className="p-1.5 bg-[#1a1a1a] hover:bg-[#0097A7] text-gray-400 hover:text-white rounded-lg transition-all border border-[#2a2a2a]"
              >
                <Download className="w-3 h-3" />
              </button>
            </div>
            <ExpandableAssetWrapper
              onClick={() => setExpandedAsset(data.output, 'image')}
              type="image"
              className="h-[200px]"
            >
              <img 
                src={data.output} 
                alt="Generated" 
                className="w-full h-full object-cover transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
            </ExpandableAssetWrapper>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default ImagenNode;

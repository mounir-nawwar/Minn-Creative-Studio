import React, { useState, useMemo } from 'react';
import { Palette, Sliders, Image as ImageIcon, Download, Sparkles } from 'lucide-react';
import { transferStyle } from '../services/geminiService';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { useAssets } from '../hooks/useAssets';
import { downloadFile } from '../lib/utils';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { RunButton } from './ui';

const StyleTransferNode = ({ data, id }: any) => {
  const [strength, setStrength] = useState(data.config?.strength || 0.5);
  const [preserveStructure, setPreserveStructure] = useState(data.config?.preserveStructure ?? true);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { setExpandedAsset } = useAssetExpand();
  const { currentProject, uploadEnabled } = useProjectStore();
  const { addAsset } = useAssets({ autoFetch: false });

  const contentUrl = useMemo(() => {
    const edge = useStore.getState().edges.find(e => e.target === id && (e.targetHandle === 'contentUrl' || e.targetHandle === 'content' || e.targetHandle === 'image'));
    const node = useStore.getState().nodes.find(n => n.id === edge?.source);
    return node?.data?.output || node?.data?.outputs?.[0] || data.config?.contentUrl;
  }, [id, data.config?.contentUrl]);

  const styleUrl = useMemo(() => {
    const edge = useStore.getState().edges.find(e => e.target === id && (e.targetHandle === 'styleUrl' || e.targetHandle === 'style' || e.targetHandle === 'reference'));
    const node = useStore.getState().nodes.find(n => n.id === edge?.source);
    return node?.data?.output || node?.data?.outputs?.[0] || data.config?.styleUrl;
  }, [id, data.config?.styleUrl]);

  const handleRun = async () => {
    if (!contentUrl || !styleUrl) {
      updateNodeData(id, { error: "Both Content Image and Style Image inputs are required" });
      return;
    }

    setIsProcessing(true);
    updateNodeData(id, { isRunning: true, error: undefined, progress: 10 });
    
    try {
      updateNodeData(id, { progress: 30 });
      const resultUrl = await transferStyle({
        contentUrl,
        styleUrl,
        strength,
        preserveStructure,
        projectId: uploadEnabled ? currentProject?.id : undefined
      });

      updateNodeData(id, { output: resultUrl, isRunning: false, progress: 100 });

      // Add to Assets grid
      if (resultUrl) {
        addAsset({
          name: `Style Transferred - ${new Date().toLocaleTimeString()}`,
          type: 'image',
          url: resultUrl,
          thumbnailUrl: resultUrl,
          tags: ['generated', 'image', 'style-transfer']
        });
      }
    } catch (err: any) {
      console.error('Style Transfer Error:', err);
      updateNodeData(id, { error: err.message || 'Style transfer failed', isRunning: false });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} outputs={true} onRun={handleRun}>
      <div className="nodrag nowheel space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Content Image</label>
            <div className="aspect-square bg-black/60 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
              {contentUrl ? (
                <img src={contentUrl} alt="Content" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-600">
                  <ImageIcon className="w-5 h-5" />
                  <span className="text-[9px]">Connect content</span>
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Style Image</label>
            <div className="aspect-square bg-black/60 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
              {styleUrl ? (
                <img src={styleUrl} alt="Style" className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-1 text-gray-600">
                  <Palette className="w-5 h-5 text-[#0097A7]" />
                  <span className="text-[9px]">Connect style</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <Sliders className="w-3 h-3 text-[#0097A7]" /> Style Strength: {strength}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={strength}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setStrength(v);
                updateNodeData(id, { config: { ...data.config, strength: v } });
              }}
              className="w-full accent-[#0097A7]"
            />
          </div>

          <div className="flex items-center gap-2 py-2 px-3 bg-black/40 rounded-lg border border-white/5">
            <input
              type="checkbox"
              id={`preserve-${id}`}
              checked={preserveStructure}
              onChange={(e) => {
                const v = e.target.checked;
                setPreserveStructure(v);
                updateNodeData(id, { config: { ...data.config, preserveStructure: v } });
              }}
              className="w-4 h-4 rounded border-gray-700 bg-black/60 text-[#0097A7] focus:ring-[#0097A7]/50"
            />
            <label htmlFor={`preserve-${id}`} className="text-[10px] text-gray-300 font-bold uppercase cursor-pointer">
              Preserve Content Structure
            </label>
          </div>
        </div>

        <RunButton onClick={handleRun} running={isProcessing} icon={Sparkles}>
          {isProcessing ? 'Transferring Style...' : 'Apply Style Transfer'}
        </RunButton>

        {data.output && (
          <div className="pt-2 border-t border-white/10 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Result Image</span>
              <button 
                type="button"
                onClick={() => downloadFile(data.output, `styled-${Date.now()}.png`)}
                className="p-1.5 bg-black/60 hover:bg-[#0097A7] text-gray-400 hover:text-white rounded-lg transition-all border border-white/10"
                title="Download"
              >
                <Download className="w-3 h-3" />
              </button>
            </div>
            <div className="aspect-square bg-black rounded-lg overflow-hidden border border-white/10">
              <ExpandableAssetWrapper
                onClick={() => setExpandedAsset(data.output, 'image')}
                type="image"
              >
                <img src={data.output} alt="Style Result" className="w-full h-full object-cover" />
              </ExpandableAssetWrapper>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default StyleTransferNode;
import React, { useState, useMemo } from 'react';
import { Palette, Sliders, Image as ImageIcon, Download } from 'lucide-react';
import { transferStyle } from '../services/geminiService';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { useAssets } from '../hooks/useAssets';
import { downloadFile } from '../lib/utils';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';

const StyleTransferNode = ({ data, id }: any) => {
  const [strength, setStrength] = useState(data.config?.strength || 0.5);
  const [preserveStructure, setPreserveStructure] = useState(data.config?.preserveStructure ?? true);
  
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { setExpandedAsset } = useAssetExpand();
  const { currentProject, uploadEnabled } = useProjectStore();
  const { addAsset } = useAssets();

  const contentUrl = useMemo(() => {
    const edge = useStore.getState().edges.find(e => e.target === id && e.targetHandle === 'contentUrl');
    const node = useStore.getState().nodes.find(n => n.id === edge?.source);
    return node?.data?.output;
  }, [id]);

  const styleUrl = useMemo(() => {
    const edge = useStore.getState().edges.find(e => e.target === id && e.targetHandle === 'styleUrl');
    const node = useStore.getState().nodes.find(n => n.id === edge?.source);
    return node?.data?.output;
  }, [id]);

  const handleRun = async () => {
    if (!contentUrl || !styleUrl) {
      updateNodeData(id, { error: "Content and Style inputs required" });
      return;
    }

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
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun} className="border-[#6366f1]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase font-bold">Content</label>
            <div className="aspect-square bg-black/40 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
              {contentUrl ? (
                <img src={contentUrl} alt="Content" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-zinc-700" />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase font-bold">Style</label>
            <div className="aspect-square bg-black/40 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center">
              {styleUrl ? (
                <img src={styleUrl} alt="Style" className="w-full h-full object-cover" />
              ) : (
                <Palette className="w-6 h-6 text-zinc-700" />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1">
              <Sliders className="w-3 h-3" /> Strength: {strength}
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
              className="w-full accent-indigo-500"
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
              className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/50"
            />
            <label htmlFor={`preserve-${id}`} className="text-[10px] text-zinc-400 font-bold uppercase">Preserve Structure</label>
          </div>
        </div>

        {data.output && (
          <div className="pt-2 border-t border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500 uppercase font-bold tracking-widest">Result Image</span>
              <button 
                onClick={() => downloadFile(data.output, `styled-${Date.now()}.png`)}
                className="p-1.5 bg-[#1a1a1a] hover:bg-[#6366f1] text-gray-400 hover:text-white rounded-lg transition-all border border-white/10"
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


import React from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Download, FileDown, Trash2 } from 'lucide-react';
import VideoPreview from '../components/VideoPreview';
import { downloadFile } from '../lib/utils';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableGridWrapper } from '../components/ExpandableAssetWrapper';

const OutputNode = ({ id, data }: any) => {
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const { setExpandedAsset } = useAssetExpand();

  const incomingEdges = edges.filter(e => e.target === id);
  const outputs = incomingEdges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    return {
      id: sourceNode?.id,
      label: sourceNode?.data?.label,
      type: sourceNode?.data?.type,
      content: sourceNode?.data?.output
    };
  }).filter(o => o.content);

  const handleDownload = (url: string, label: string) => {
    downloadFile(url, `${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`);
  };

  return (
    <BaseNode id={id} data={data} outputs={false}>
      <div className="space-y-4">
        {outputs.length === 0 ? (
          <div className="py-8 flex flex-col items-center justify-center text-gray-600 border-2 border-dashed border-[#2a2a2a] rounded-xl">
            <FileDown className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-[10px] uppercase font-bold tracking-widest">Waiting for inputs</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {outputs.map((output, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 uppercase font-bold">{output.label}</span>
                  <button 
                    onClick={() => handleDownload(output.content, output.label || 'output')}
                    className="p-1.5 bg-[#2a2a2a] hover:bg-[#0097A7] text-gray-400 hover:text-white rounded-lg transition-all"
                  >
                    <Download className="w-3 h-3" />
                  </button>
                </div>
                
                {output.type === 'veo' ? (
                  <ExpandableGridWrapper
                    onClick={() => setExpandedAsset(output.content, 'video')}
                    type="video"
                  >
                    <VideoPreview url={output.content} />
                  </ExpandableGridWrapper>
                ) : (
                  <ExpandableGridWrapper
                    onClick={() => setExpandedAsset(output.content, 'image')}
                    type="image"
                  >
                    <div className="rounded-lg overflow-hidden">
                      <img 
                        src={output.content} 
                        alt="Output" 
                        className="w-full h-auto"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </ExpandableGridWrapper>
                )}
              </div>
            ))}
          </div>
        )}

        {outputs.length > 0 && (
          <button className="w-full py-2 bg-[#1a1a1a] hover:bg-[#2a2a2a] text-gray-300 rounded-lg text-xs font-bold transition-colors border border-[#2a2a2a]">
            DOWNLOAD ALL AS ZIP
          </button>
        )}
      </div>
    </BaseNode>
  );
};

export default OutputNode;

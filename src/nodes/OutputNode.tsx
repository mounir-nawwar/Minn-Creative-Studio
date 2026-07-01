import React from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Download, FileDown } from 'lucide-react';
import VideoPreview from '../components/VideoPreview';
import { downloadFile } from '../lib/utils';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableGridWrapper } from '../components/ExpandableAssetWrapper';
import { NodeLabel } from './ui';

const OutputNode = ({ id, data }: any) => {
  const edges = useStore((state) => state.edges);
  const nodes = useStore((state) => state.nodes);
  const { setExpandedAsset } = useAssetExpand();

  const incomingEdges = edges.filter((e) => e.target === id);
  const outputs = incomingEdges
    .map((edge) => {
      const sourceNode = nodes.find((n) => n.id === edge.source);
      return { id: sourceNode?.id, label: sourceNode?.data?.label, type: sourceNode?.data?.type, content: sourceNode?.data?.output };
    })
    .filter((o) => o.content);

  const handleDownload = (url: string, label: string) => {
    downloadFile(url, `${label.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`);
  };

  return (
    <BaseNode id={id} data={data} outputs={false}>
      <div className="space-y-4">
        {outputs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-8 text-gray-600">
            <FileDown className="h-7 w-7 opacity-30" />
            <p className="text-[11px] text-gray-500">Waiting for inputs</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {outputs.map((output, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <NodeLabel>{output.label}</NodeLabel>
                  <button
                    onClick={() => handleDownload(output.content, output.label || 'output')}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-gray-400 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:bg-[#0097A7] hover:text-white active:scale-[0.96]"
                    title="Download"
                  >
                    <Download className="h-3.5 w-3.5" />
                  </button>
                </div>

                {output.type === 'veo' ? (
                  <ExpandableGridWrapper onClick={() => setExpandedAsset(output.content, 'video')} type="video">
                    <VideoPreview url={output.content} />
                  </ExpandableGridWrapper>
                ) : (
                  <ExpandableGridWrapper onClick={() => setExpandedAsset(output.content, 'image')} type="image">
                    <img src={output.content} alt="Output" className="h-auto w-full" referrerPolicy="no-referrer" />
                  </ExpandableGridWrapper>
                )}
              </div>
            ))}
          </div>
        )}

        {outputs.length > 0 && (
          <button className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white/[0.04] text-[12px] font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:bg-white/[0.07] hover:text-white active:scale-[0.98]">
            <Download className="h-3.5 w-3.5" />
            Download all
          </button>
        )}
      </div>
    </BaseNode>
  );
};

export default OutputNode;

import React from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableGridWrapper } from './ExpandableAssetWrapper';

interface ReferenceImage {
  edgeId: string;
  url: string;
  role: 'style' | 'composition' | 'character' | 'subject' | 'background';
  strength: number;
}

interface ReferenceStripProps {
  nodeId: string;
  references: ReferenceImage[];
  onUpdateRole: (edgeId: string, role: string) => void;
}

const ReferenceStrip: React.FC<ReferenceStripProps> = ({ references, onUpdateRole }) => {
  const deleteEdge = useStore((state) => state.deleteEdge);
  const { setExpandedAsset } = useAssetExpand();

  if (references.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">References ({references.length})</span>
      <div className="scrollbar-hide flex gap-2 overflow-x-auto pb-2">
        {references.map((ref) => (
          <div key={ref.edgeId} className="w-24 shrink-0 space-y-1.5">
            <ExpandableGridWrapper onClick={() => setExpandedAsset(ref.url, 'image')} type="image" className="h-24 w-24">
              <div className="relative aspect-square">
                <img src={ref.url} className="h-full w-full object-cover" alt="Reference" referrerPolicy="no-referrer" />
                <button
                  onClick={(e) => { e.stopPropagation(); deleteEdge(ref.edgeId); }}
                  className="absolute right-1 top-1 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-[transform,background-color] duration-150 hover:bg-red-500 active:scale-[0.96]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            </ExpandableGridWrapper>
            <select
              value={ref.role}
              onChange={(e) => onUpdateRole(ref.edgeId, e.target.value)}
              className="w-full rounded-md bg-[#0a0a0a] px-1 py-1 text-[10px] text-gray-300 ring-1 ring-white/10 focus:outline-none focus:ring-[#0097A7]/50"
            >
              <option value="style">Style</option>
              <option value="composition">Composition</option>
              <option value="character">Character</option>
              <option value="subject">Subject</option>
              <option value="background">Background</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReferenceStrip;

import React from 'react';
import { X } from 'lucide-react';
import { useStore } from '../store/useStore';

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

const ReferenceStrip: React.FC<ReferenceStripProps> = ({ nodeId, references, onUpdateRole }) => {
  const deleteEdge = useStore((state) => state.deleteEdge);

  if (references.length === 0) return null;

  return (
    <div className="space-y-2">
      <label className="text-[10px] text-gray-500 uppercase font-bold">References ({references.length})</label>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
        {references.map((ref) => (
          <div key={ref.edgeId} className="flex-shrink-0 w-24 space-y-1">
            <div className="relative aspect-square rounded-lg overflow-hidden border border-[#2a2a2a] bg-[#0a0a0a]">
              <img 
                src={ref.url} 
                className="w-full h-full object-cover" 
                alt="Ref" 
                referrerPolicy="no-referrer"
              />
              <button
                onClick={() => deleteEdge(ref.edgeId)}
                className="absolute top-1 right-1 p-0.5 bg-black/50 hover:bg-red-500 rounded-full text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <select
              value={ref.role}
              onChange={(e) => onUpdateRole(ref.edgeId, e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded p-0.5 text-[8px] text-gray-400 focus:outline-none focus:border-[#0097A7]"
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

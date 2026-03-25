import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Palette, Loader2, Sparkles, Sliders, Image as ImageIcon } from 'lucide-react';
import { transferStyle } from '../services/geminiService';

const StyleTransferNode = ({ data, id }: any) => {
  const [strength, setStrength] = useState(0.5);
  const [preserveStructure, setPreserveStructure] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outputUrl, setOutputUrl] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!data.contentUrl || !data.styleUrl) return;
    setIsGenerating(true);
    try {
      const resultUrl = await transferStyle({
        contentUrl: data.contentUrl,
        styleUrl: data.styleUrl,
        strength,
        preserveStructure
      });
      setOutputUrl(resultUrl);
    } catch (err) {
      console.error('Style Transfer Error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden min-w-[320px] shadow-2xl">
      <div className="bg-zinc-900/50 p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-indigo-500" />
          <span className="text-xs font-medium text-zinc-200 uppercase tracking-wider">Style Transfer</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase tracking-tighter">Content</label>
            <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center">
              {data.contentUrl ? (
                <img src={data.contentUrl} alt="Content" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-6 h-6 text-zinc-700" />
              )}
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase tracking-tighter">Style</label>
            <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 flex items-center justify-center">
              {data.styleUrl ? (
                <img src={data.styleUrl} alt="Style" className="w-full h-full object-cover" />
              ) : (
                <Palette className="w-6 h-6 text-zinc-700" />
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase tracking-tighter flex items-center gap-1">
              <Sliders className="w-3 h-3" /> Strength: {strength}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={strength}
              onChange={(e) => setStrength(parseFloat(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="preserveStructure"
              checked={preserveStructure}
              onChange={(e) => setPreserveStructure(e.target.checked)}
              className="w-4 h-4 rounded border-zinc-800 bg-zinc-900 text-indigo-500 focus:ring-indigo-500/50"
            />
            <label htmlFor="preserveStructure" className="text-xs text-zinc-400">Preserve Structure</label>
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !data.contentUrl || !data.styleUrl}
          className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-white text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isGenerating ? 'Generating...' : 'Transfer Style'}
        </button>

        {outputUrl && (
          <div className="pt-4 border-t border-zinc-800">
            <label className="text-[10px] text-zinc-500 uppercase tracking-tighter">Result</label>
            <div className="mt-2 aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
              <img src={outputUrl} alt="Style Transfer Result" className="w-full h-full object-cover" />
            </div>
          </div>
        )}
      </div>

      <Handle type="target" position={Position.Left} id="contentUrl" style={{ top: '30%', background: '#6366f1' }} />
      <Handle type="target" position={Position.Left} id="styleUrl" style={{ top: '70%', background: '#6366f1' }} />
      <Handle type="source" position={Position.Right} id="output" style={{ background: '#6366f1' }} />
    </div>
  );
};

export default StyleTransferNode;

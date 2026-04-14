import React, { useState } from 'react';
import { Copy, Loader2, Sparkles, Sliders, Grid } from 'lucide-react';
import { generateVariations } from '../services/geminiService';
import BaseNode from './BaseNode';

const VariationNode = ({ data, id }: any) => {
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [count, setCount] = useState(4);
  const [strength, setStrength] = useState(0.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [variations, setVariations] = useState<string[]>([]);

  const handleGenerate = async () => {
    if (!data.imageUrl) return;
    setIsGenerating(true);
    try {
      const images = await generateVariations({
        imageUrl: data.imageUrl,
        prompt,
        count
      });
      setVariations(images);
    } catch (err) {
      console.error('Variation Generation Error:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate variations');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <BaseNode id={id} data={{ ...data, label: 'Variations' }} inputs={true} outputs={false} className="border-emerald-500">
      <div className="space-y-4">
        <div className="space-y-1">
          <label className="text-[10px] text-zinc-500 uppercase tracking-tighter">Variation Prompt (Optional)</label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the desired changes..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white h-16 focus:outline-none focus:border-emerald-500/50 resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase tracking-tighter flex items-center gap-1">
              <Grid className="w-3 h-3" /> Count: {count}
            </label>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value))}
              className="w-full accent-emerald-500"
            />
          </div>
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
              className="w-full accent-emerald-500"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isGenerating || !data.imageUrl}
          className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-white text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          {isGenerating ? 'Generating...' : 'Generate Variations'}
        </button>

        {variations.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-zinc-800">
            {variations.map((url, idx) => (
              <div key={idx} className="relative group aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
                <img src={url} alt={`Variation ${idx}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                   <button className="p-2 bg-white/20 hover:bg-white/40 rounded-full">
                      <Copy className="w-4 h-4 text-white" />
                   </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default VariationNode;

import React, { useState } from 'react';
import { Palette, Hash, Sparkles, AlertCircle, Shield } from 'lucide-react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { NodeOutput, RunButton } from './ui';

const BrandContextNode = ({ data, id }: any) => {
  const [brand, setBrand] = useState({
    name: data.config?.name || data.name || '',
    primaryColor: data.config?.primaryColor || data.primaryColor || '#0097A7',
    styleKeywords: data.config?.styleKeywords || data.styleKeywords || 'clean, high fashion, editorial lighting',
    negativeKeywords: data.config?.negativeKeywords || data.negativeKeywords || 'blurry, low quality, distorted',
    mood: data.config?.mood || data.mood || 'Luxury',
    typography: data.config?.typography || data.typography || 'Sans-serif'
  });

  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleChange = (field: string, value: string) => {
    const updated = { ...brand, [field]: value };
    setBrand(updated);
    updateNodeData(id, {
      config: updated,
      output: updated,
    });
  };

  const handleApply = () => {
    updateNodeData(id, {
      config: brand,
      output: brand,
    });
  };

  return (
    <BaseNode id={id} data={data} inputs={false} outputs={true}>
      <div className="space-y-3.5">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <Hash className="w-3 h-3 text-[#0097A7]" /> Brand Name
            </label>
            <input
              type="text"
              value={brand.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Minn Agency"
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#0097A7]/50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <Palette className="w-3 h-3 text-[#0097A7]" /> Primary Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={brand.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="w-10 h-8 bg-black/60 border border-white/10 rounded cursor-pointer"
              />
              <input
                type="text"
                value={brand.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="flex-1 bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#0097A7]/50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#0097A7]" /> Style Keywords
            </label>
            <textarea
              value={brand.styleKeywords}
              onChange={(e) => handleChange('styleKeywords', e.target.value)}
              placeholder="e.g. minimalist, high-contrast, cinematic lighting"
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white h-16 focus:outline-none focus:border-[#0097A7]/50 resize-none placeholder:text-gray-600"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <AlertCircle className="w-3 h-3 text-red-400" /> Negative Keywords
            </label>
            <textarea
              value={brand.negativeKeywords}
              onChange={(e) => handleChange('negativeKeywords', e.target.value)}
              placeholder="e.g. blurry, low quality, distorted"
              className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white h-14 focus:outline-none focus:border-[#0097A7]/50 resize-none placeholder:text-gray-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Mood</label>
              <select
                value={brand.mood}
                onChange={(e) => handleChange('mood', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#0097A7]/50 cursor-pointer"
              >
                <option>Luxury</option>
                <option>Professional</option>
                <option>Playful</option>
                <option>Energetic</option>
                <option>Calm</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Typography</label>
              <select
                value={brand.typography}
                onChange={(e) => handleChange('typography', e.target.value)}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-[#0097A7]/50 cursor-pointer"
              >
                <option>Sans-serif</option>
                <option>Serif</option>
                <option>Monospace</option>
                <option>Display</option>
              </select>
            </div>
          </div>
        </div>

        <RunButton onClick={handleApply} icon={Shield}>
          Set Brand Context
        </RunButton>

        {data.output && (
          <NodeOutput label="Brand Output JSON">
            <pre className="text-[10px] whitespace-pre-wrap font-mono text-gray-300 max-h-32 overflow-y-auto">
              {JSON.stringify(data.output, null, 2)}
            </pre>
          </NodeOutput>
        )}
      </div>
    </BaseNode>
  );
};

export default BrandContextNode;
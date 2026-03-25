import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Briefcase, Palette, Type, Hash, Sparkles, AlertCircle } from 'lucide-react';

const BrandContextNode = ({ data, id }: any) => {
  const [brand, setBrand] = useState({
    name: data.name || '',
    primaryColor: data.primaryColor || '#f97316',
    styleKeywords: data.styleKeywords || '',
    negativeKeywords: data.negativeKeywords || '',
    mood: data.mood || 'Professional',
    typography: data.typography || 'Sans-serif'
  });

  const handleChange = (field: string, value: string) => {
    setBrand(prev => ({ ...prev, [field]: value }));
    // Update data in store (handled by useStore if we use it, but for now local state is fine)
    // In a real app, we'd call a store action here
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden min-w-[320px] shadow-2xl">
      <div className="bg-zinc-900/50 p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Briefcase className="w-4 h-4 text-purple-500" />
          <span className="text-xs font-medium text-zinc-200 uppercase tracking-wider">Brand Context</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase tracking-tighter flex items-center gap-1">
              <Hash className="w-3 h-3" /> Brand Name
            </label>
            <input
              type="text"
              value={brand.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="e.g. Minn Creative"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase tracking-tighter flex items-center gap-1">
              <Palette className="w-3 h-3" /> Primary Color
            </label>
            <div className="flex gap-2">
              <input
                type="color"
                value={brand.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="w-10 h-8 bg-zinc-900 border border-zinc-800 rounded cursor-pointer"
              />
              <input
                type="text"
                value={brand.primaryColor}
                onChange={(e) => handleChange('primaryColor', e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase tracking-tighter flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Style Keywords
            </label>
            <textarea
              value={brand.styleKeywords}
              onChange={(e) => handleChange('styleKeywords', e.target.value)}
              placeholder="e.g. minimalist, high-contrast, cinematic lighting"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white h-16 focus:outline-none focus:border-purple-500/50 resize-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-zinc-500 uppercase tracking-tighter flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Negative Keywords
            </label>
            <textarea
              value={brand.negativeKeywords}
              onChange={(e) => handleChange('negativeKeywords', e.target.value)}
              placeholder="e.g. blurry, low quality, distorted"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white h-12 focus:outline-none focus:border-purple-500/50 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-tighter flex items-center gap-1">
                Mood
              </label>
              <select
                value={brand.mood}
                onChange={(e) => handleChange('mood', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
              >
                <option>Professional</option>
                <option>Playful</option>
                <option>Luxury</option>
                <option>Energetic</option>
                <option>Calm</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-500 uppercase tracking-tighter flex items-center gap-1">
                Typography
              </label>
              <select
                value={brand.typography}
                onChange={(e) => handleChange('typography', e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-purple-500/50"
              >
                <option>Sans-serif</option>
                <option>Serif</option>
                <option>Monospace</option>
                <option>Display</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} id="brand" style={{ background: '#a855f7' }} />
    </div>
  );
};

export default BrandContextNode;

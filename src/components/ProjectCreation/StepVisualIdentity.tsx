import React from 'react';
import { motion } from 'motion/react';
import type { StepProps } from './types';
import { MOODS } from './types';
import type { FontStyle, Project } from '../../types/project.types';

export default function StepVisualIdentity({ formData, updateFormData, toggleItem }: StepProps) {
  return (
    <motion.div
      key="step3"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-2">
        <h3 className="text-4xl font-black text-white tracking-tighter">Visual Identity</h3>
        <p className="text-gray-500 text-sm">Define the look and feel of the brand.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
        <div className="space-y-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Color Palette</label>
            <div className="space-y-4">
              {(['primaryColor', 'secondaryColor', 'accentColor'] as (keyof Project)[]).map((field) => (
                <div key={field as string} className="flex items-center gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 bg-[#111111] border border-white/5 rounded-2xl p-3 focus-within:border-[#0097A7] transition-all">
                      <div className="relative w-10 h-10 rounded-full border border-white/10 overflow-hidden shrink-0 shadow-lg">
                        <input
                          type="color"
                          value={formData[field] as string}
                          onChange={(e) => updateFormData({ [field]: e.target.value })}
                          className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer border-none p-0 bg-transparent"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={formData[field] as string}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                              updateFormData({ [field]: val });
                            }
                          }}
                          onBlur={(e) => {
                            const val = e.target.value;
                            if (!/^#[0-9A-Fa-f]{6}$/.test(val)) {
                              const defaults: Partial<Record<keyof Project, string>> = {
                                primaryColor: '#0097A7',
                                secondaryColor: '#1a1a1a',
                                accentColor: '#ffffff'
                              };
                              updateFormData({ [field]: defaults[field] || '#000000' });
                            }
                          }}
                          className="w-full bg-transparent border-none p-0 text-xs font-mono text-white focus:outline-none uppercase"
                        />
                        <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-0.5">
                          {(field as string).replace('Color', '')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Font Style</label>
            <div className="grid grid-cols-2 gap-2">
              {(['geometric', 'serif', 'handwritten', 'monospace', 'display', 'mixed'] as FontStyle[]).map((font) => (
                <button
                  key={font}
                  onClick={() => updateFormData({ fontStyle: font })}
                  className={`px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                    formData.fontStyle === font
                      ? 'bg-[#0097A7] border-[#0097A7] text-white'
                      : 'bg-[#111111] border-white/5 text-gray-500 hover:text-white'
                  }`}
                >
                  {font}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Visual Mood</label>
            <div className="flex flex-wrap gap-2">
              {MOODS.map(mood => (
                <button
                  key={mood}
                  onClick={() => toggleItem('visualMood', mood)}
                  className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                    formData.visualMood?.includes(mood)
                      ? 'bg-[#0097A7]/20 border-[#0097A7] text-[#0097A7]'
                      : 'bg-[#111111] border-white/5 text-gray-600 hover:text-gray-400'
                  }`}
                >
                  {mood}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Style Keywords</label>
            <input
              type="text"
              value={formData.styleKeywords || ''}
              onChange={(e) => updateFormData({ styleKeywords: e.target.value })}
              placeholder="e.g. Grainy, Minimal, High Contrast..."
              className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white text-xs focus:outline-none focus:border-[#0097A7]"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

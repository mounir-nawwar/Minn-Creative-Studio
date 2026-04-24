import React from 'react';
import { motion } from 'motion/react';
import type { StepProps } from './types';
import { TONES, PLATFORMS } from './types';

export default function StepTargetAudience({ formData, updateFormData, toggleItem }: StepProps) {
  return (
    <motion.div
      key="step4"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-2">
        <h3 className="text-4xl font-black text-white tracking-tighter">Target & Platforms</h3>
        <p className="text-gray-500 text-sm">Who is this for and where will it live?</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-10">
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Target Audience</label>
            <textarea
              value={formData.targetAudience || ''}
              onChange={(e) => updateFormData({ targetAudience: e.target.value })}
              placeholder="Describe your ideal viewer..."
              className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white text-xs h-32 resize-none focus:outline-none focus:border-[#0097A7]"
            />
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Brand Personality</label>
            <div className="flex flex-wrap gap-2">
              {TONES.map(tone => (
                <button
                  key={tone}
                  onClick={() => updateFormData({ brandPersonality: tone })}
                  className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                    formData.brandPersonality === tone
                      ? 'bg-[#0097A7] border-[#0097A7] text-white'
                      : 'bg-[#111111] border-white/5 text-gray-600 hover:text-gray-400'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Platform Targets</label>
          <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
            {PLATFORMS.map(platform => (
              <button
                key={platform.id}
                onClick={() => toggleItem('platforms', platform.id)}
                className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${
                  formData.platforms?.includes(platform.id)
                    ? 'bg-[#0097A7]/20 border-[#0097A7] text-[#0097A7]'
                    : 'bg-[#111111] border-white/5 text-gray-600 hover:text-white'
                }`}
              >
                <platform.icon className="w-6 h-6" />
                <span className="text-[8px] font-black uppercase tracking-tighter">{platform.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

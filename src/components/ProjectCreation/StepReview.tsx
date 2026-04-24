import React from 'react';
import { motion } from 'motion/react';
import { Globe } from 'lucide-react';
import { PROJECT_TYPES } from '../../types/project.types';
import type { StepProps } from './types';
import { PLATFORMS } from './types';

interface StepReviewProps extends StepProps {
  mode: 'create' | 'edit';
}

export default function StepReview({ formData, mode }: StepReviewProps) {
  return (
    <motion.div
      key="step7"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-2">
        <h3 className="text-4xl font-black text-white tracking-tighter">
          {mode === 'edit' ? 'Update your mission' : 'Your project is ready'}
        </h3>
        <p className="text-gray-500 text-sm">
          {mode === 'edit' ? 'Review and save your changes.' : 'Review everything before launching.'}
        </p>
      </div>

      <div className="max-w-2xl mx-auto bg-[#111111] border border-white/5 rounded-[40px] p-10 space-y-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-[#0097A7]/20 text-[#0097A7] rounded-full text-[9px] font-black uppercase tracking-widest">
                {PROJECT_TYPES[formData.type as keyof typeof PROJECT_TYPES]?.label}
              </span>
              <span className="text-[10px] text-gray-600 uppercase font-bold">{formData.subtype}</span>
            </div>
            <h4 className="text-3xl font-black text-white tracking-tighter">{formData.name}</h4>
          </div>
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-full border border-white/10" style={{ backgroundColor: formData.primaryColor }} />
            <div className="w-8 h-8 rounded-full border border-white/10" style={{ backgroundColor: formData.secondaryColor }} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Visual Mood</label>
            <div className="flex flex-wrap gap-2">
              {formData.visualMood?.map(m => (
                <span key={m} className="px-3 py-1 bg-white/5 text-gray-400 rounded-lg text-[9px] font-bold uppercase">{m}</span>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Platforms</label>
            <div className="flex flex-wrap gap-3">
              {formData.platforms?.map(p => {
                const PlatformIcon = PLATFORMS.find(pl => pl.id === p)?.icon || Globe;
                return <PlatformIcon key={p} className="w-5 h-5 text-gray-500" />;
              })}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Collaborators</label>
          <div className="flex flex-wrap gap-2">
            {formData.collaborators?.length === 0 ? (
              <span className="text-xs text-gray-600 italic">No collaborators</span>
            ) : (
              formData.collaborators?.map(email => (
                <span key={email} className="px-3 py-1 bg-[#0097A7]/10 text-[#0097A7] rounded-lg text-[9px] font-bold">{email}</span>
              ))
            )}
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">AI Instructions Preview</label>
          <p className="text-xs text-gray-400 leading-relaxed italic line-clamp-3">
            "{formData.aiInstructions || 'No instructions generated yet.'}"
          </p>
        </div>
      </div>
    </motion.div>
  );
}

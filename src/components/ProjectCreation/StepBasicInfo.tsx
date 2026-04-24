import React from 'react';
import { motion } from 'motion/react';
import { PROJECT_TYPES } from '../../types/project.types';
import type { StepProps, ProjectStatus } from './types';

export default function StepBasicInfo({ formData, updateFormData }: StepProps) {
  return (
    <motion.div
      key="step2"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-2">
        <h3 className="text-4xl font-black text-white tracking-tighter">Tell us more</h3>
        <p className="text-gray-500 text-sm">Define the basics of your creative mission.</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Subtype</label>
          <div className="flex flex-wrap gap-2">
            {PROJECT_TYPES[formData.type as keyof typeof PROJECT_TYPES]?.subtypes.map(sub => (
              <button
                key={sub}
                onClick={() => updateFormData({ subtype: sub })}
                className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                  formData.subtype === sub
                    ? 'bg-[#0097A7] text-white'
                    : 'bg-[#111111] text-gray-500 hover:text-white border border-white/5'
                }`}
              >
                {sub}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Project Status</label>
          <div className="flex gap-2">
            {(['active', 'archived', 'completed'] as ProjectStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => updateFormData({ status })}
                className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${
                  formData.status === status
                    ? 'bg-[#0097A7] border-[#0097A7] text-white'
                    : 'bg-[#111111] border-white/5 text-gray-500 hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Project Name *</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => updateFormData({ name: e.target.value })}
              placeholder="e.g. Summer Launch 2026"
              className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-[#0097A7] transition-all"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Client Name</label>
            <input
              type="text"
              value={formData.clientName || ''}
              onChange={(e) => updateFormData({ clientName: e.target.value })}
              placeholder="e.g. Nike, Apple, Personal"
              className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-[#0097A7] transition-all"
            />
          </div>
        </div>

        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Description</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => updateFormData({ description: e.target.value })}
            placeholder="What is this project about?"
            className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white h-32 resize-none focus:outline-none focus:border-[#0097A7] transition-all"
          />
        </div>
      </div>
    </motion.div>
  );
}

import React from 'react';
import { motion } from 'motion/react';
import { PROJECT_TYPES } from '../../types/project.types';
import type { StepProps, ProjectStatus } from './types';
import { Upload } from 'lucide-react';

export default function StepBasicInfo({ formData, updateFormData }: StepProps) {
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        updateFormData({ coverImage: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

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
        {/* Cover Image Upload */}
        <div className="space-y-3">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Cover Image</label>
          <div className="flex items-center gap-4">
            <label className="relative w-32 h-20 rounded-xl overflow-hidden cursor-pointer bg-[#0D1219] border border-[#1A2434] hover:border-[rgba(0,151,167,0.3)] transition-all group">
              <input type="file" accept="image/*" onChange={handleImageUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
              {formData.coverImage ? (
                <img src={formData.coverImage} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-[#4A6070] group-hover:text-[#0097A7] transition-colors">
                  <Upload className="w-5 h-5 mb-1" />
                  <span className="text-[8px]">Upload</span>
                </div>
              )}
            </label>
            <div className="flex-1">
              <p className="text-[11px] text-[#4A6070]">Upload a cover image for your project card. If no image is uploaded, a gradient will be displayed instead.</p>
              {formData.coverImage && (
                <button
                  onClick={() => updateFormData({ coverImage: undefined })}
                  className="text-[10px] text-red-400 hover:text-red-300 mt-2"
                >
                  Remove image
                </button>
              )}
            </div>
          </div>
        </div>

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

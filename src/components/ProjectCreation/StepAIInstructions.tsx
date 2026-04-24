import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Loader2 } from 'lucide-react';
import type { StepProps } from './types';

interface StepAIInstructionsProps extends StepProps {
  onGenerate: () => void;
  isGenerating: boolean;
  aiError: string | null;
}

export default function StepAIInstructions({ formData, updateFormData, onGenerate, isGenerating, aiError }: StepAIInstructionsProps) {
  return (
    <motion.div
      key="step5"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-2">
        <h3 className="text-4xl font-black text-white tracking-tighter">Brief the AI</h3>
        <p className="text-gray-500 text-sm">Master instructions injected into every AI call.</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-8">
        <div className="relative">
          <div className="absolute -top-3 left-6 px-3 bg-[#0a0a0a] z-10">
            <label className="text-[10px] font-black text-[#0097A7] uppercase tracking-widest">AI Master Instructions</label>
          </div>
          <textarea
            value={formData.aiInstructions || ''}
            onChange={(e) => updateFormData({ aiInstructions: e.target.value })}
            placeholder="e.g. Always maintain a clean minimal aesthetic. The brand uses teal as its hero color..."
            className="w-full bg-[#111111] border border-[#0097A7]/30 rounded-[32px] p-8 pt-10 text-white text-sm h-64 resize-none focus:outline-none focus:border-[#0097A7] transition-all leading-relaxed"
          />
          {aiError && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
              <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-relaxed">
                {aiError}
              </p>
            </div>
          )}
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="absolute bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            {isGenerating ? 'Generating...' : 'Generate from my inputs'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Deliverables</label>
            <input
              type="text"
              value={formData.deliverables || ''}
              onChange={(e) => updateFormData({ deliverables: e.target.value })}
              placeholder="e.g. 10 Reels, 5 Feed Posts"
              className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white text-xs focus:outline-none focus:border-[#0097A7]"
            />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Budget</label>
            <input
              type="text"
              value={formData.budget || ''}
              onChange={(e) => updateFormData({ budget: e.target.value })}
              placeholder="e.g. $5,000"
              className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white text-xs focus:outline-none focus:border-[#0097A7]"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

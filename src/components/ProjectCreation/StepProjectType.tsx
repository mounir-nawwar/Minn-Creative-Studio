import React from 'react';
import { motion } from 'motion/react';
import { PROJECT_TYPES } from '../../types/project.types';
import type { StepProps } from './types';

export default function StepProjectType({ formData, updateFormData }: StepProps) {
  return (
    <motion.div
      key="step1"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-2">
        <h3 className="text-4xl font-black text-white tracking-tighter">What are you working on?</h3>
        <p className="text-gray-500 text-sm">Select the category that best fits your project.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {Object.entries(PROJECT_TYPES).map(([key, type]) => (
          <button
            key={key}
            onClick={() => updateFormData({ type: key, subtype: type.subtypes[0] })}
            className={`p-6 rounded-3xl border transition-all flex flex-col items-center gap-4 group ${
              formData.type === key
                ? 'bg-[#0097A7]/20 border-[#0097A7] shadow-[0_0_30px_rgba(0,151,167,0.2)]'
                : 'bg-[#111111] border-white/5 hover:border-white/20'
            }`}
          >
            <span className={`text-4xl transition-transform group-hover:scale-110 ${formData.type === key ? '' : 'grayscale opacity-40'}`}>
              {type.icon}
            </span>
            <span className={`text-[10px] font-black uppercase tracking-widest text-center leading-tight ${formData.type === key ? 'text-white' : 'text-gray-500'}`}>
              {type.label}
            </span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

import React from 'react';
import { motion } from 'motion/react';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

export default function StepIndicator({ currentStep, totalSteps }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-3 mb-12">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const step = index + 1;
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <div key={step} className="flex items-center">
            <motion.div
              animate={{
                scale: isActive ? 1.2 : 1,
                backgroundColor: isActive || isCompleted ? '#0097A7' : '#1a1a1a',
                borderColor: isActive || isCompleted ? '#0097A7' : '#2a2a2a',
              }}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-[10px] font-black transition-colors ${
                isActive || isCompleted ? 'text-white' : 'text-gray-600'
              }`}
            >
              {isCompleted ? '✓' : step}
            </motion.div>
            {step < totalSteps && (
              <motion.div
                animate={{
                  backgroundColor: isCompleted ? '#0097A7' : '#1a1a1a',
                }}
                className="w-12 h-0.5 mx-2"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

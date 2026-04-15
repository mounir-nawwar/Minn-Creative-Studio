import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, Trash2, Archive } from 'lucide-react';
import { Project } from '../types/project.types';

interface DeleteProjectModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  retentionDays: number;
}

export default function DeleteProjectModal({
  project,
  isOpen,
  onClose,
  onConfirm,
  retentionDays
}: DeleteProjectModalProps) {
  if (!project) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-2xl z-50"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md mx-4"
          >
            <div className="bg-[#111111] border border-white/10 rounded-2xl p-8 shadow-2xl space-y-6">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-[#0097A7]/10 border border-[#0097A7]/30 flex items-center justify-center">
                  <Archive className="w-8 h-8 text-[#0097A7]" />
                </div>
              </div>
              
              <div className="text-center space-y-3">
                <h2 className="text-xl font-black text-white uppercase tracking-wider">
                  Move to Recycle Bin?
                </h2>
                
                <div className="bg-black/40 border border-white/5 rounded-xl p-4">
                  <h3 className="text-sm font-black text-white mb-1 truncate">
                    {project.name}
                  </h3>
                  {project.clientName && (
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter">
                      {project.clientName}
                    </p>
                  )}
                </div>
                
                <div className="bg-[#0097A7]/5 border border-[#0097A7]/20 rounded-lg p-3">
                  <p className="text-[11px] font-bold text-gray-300 leading-relaxed">
                    Projects in the Recycle Bin are kept for{' '}
                    <span className="text-[#0097A7]">{retentionDays} days</span> and can be restored.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex-1 py-3 bg-[#1a1a1a] border border-white/10 text-gray-400 hover:text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:border-white/20 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="flex-1 py-3 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,151,167,0.2)] hover:shadow-[0_0_25px_rgba(0,151,167,0.4)] transition-all flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Move to Bin
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

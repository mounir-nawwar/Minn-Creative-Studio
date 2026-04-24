import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import type { StepProps } from './types';

interface StepCollaboratorsProps extends StepProps {
  newCollaborator: string;
  onCollaboratorChange: (value: string) => void;
}

export default function StepCollaborators({ formData, updateFormData, newCollaborator, onCollaboratorChange }: StepCollaboratorsProps) {
  const addCollaborator = () => {
    if (!newCollaborator.trim()) return;
    updateFormData({ collaborators: [...(formData.collaborators || []), newCollaborator.trim()] });
    onCollaboratorChange('');
  };

  return (
    <motion.div
      key="step6"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <div className="text-center space-y-2">
        <h3 className="text-4xl font-black text-white tracking-tighter">Sharing & Collaborators</h3>
        <p className="text-gray-500 text-sm">Add people who can view and work on this project.</p>
      </div>

      <div className="max-w-xl mx-auto space-y-8">
        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Add Collaborator by Email</label>
          <div className="flex gap-2">
            <input
              type="email"
              value={newCollaborator}
              onChange={(e) => onCollaboratorChange(e.target.value)}
              placeholder="e.g. colleague@example.com"
              className="flex-1 bg-[#111111] border border-white/5 rounded-2xl p-4 text-white text-xs focus:outline-none focus:border-[#0097A7]"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCollaborator();
                }
              }}
            />
            <button
              onClick={addCollaborator}
              className="px-6 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-105 transition-all"
            >
              Add
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Current Collaborators</label>
          <div className="space-y-2">
            {formData.collaborators?.length === 0 ? (
              <p className="text-xs text-gray-600 italic">No collaborators added yet.</p>
            ) : (
              formData.collaborators?.map((email, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-[#111111] border border-white/5 rounded-2xl group">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-[#0097A7]/10 rounded-full flex items-center justify-center text-[#0097A7] text-[10px] font-bold">
                      {email[0].toUpperCase()}
                    </div>
                    <span className="text-xs text-gray-300">{email}</span>
                  </div>
                  <button
                    onClick={() => updateFormData({ collaborators: formData.collaborators?.filter((_, idx) => idx !== i) })}
                    className="p-2 text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-6 bg-[#0097A7]/5 border border-[#0097A7]/20 rounded-3xl">
          <p className="text-[10px] text-gray-500 leading-relaxed">
            <span className="text-[#0097A7] font-black uppercase tracking-widest block mb-1">How it works:</span>
            Collaborators can view your project, assets, and workflows when they sign in with their own Google account. They cannot delete the project or change its settings.
          </p>
        </div>
      </div>
    </motion.div>
  );
}

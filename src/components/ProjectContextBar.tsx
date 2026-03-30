import React from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { PROJECT_TYPES } from '../types/project.types';
import { Settings, ArrowLeftRight, Briefcase, Calendar, ChevronRight, PanelLeftOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProjectContextBar() {
  const { currentProject, clearProject, openSettings, isSidebarOpen, toggleSidebar } = useProjectStore();
  
  if (!currentProject) return null;

  const projectType = PROJECT_TYPES[currentProject.type as keyof typeof PROJECT_TYPES] || PROJECT_TYPES.personal;

  return (
    <div className="h-12 bg-black border-b border-white/5 flex items-center justify-between px-6 relative z-50">
      <div className="flex items-center gap-6">
        <AnimatePresence>
          {!isSidebarOpen && (
            <motion.button
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onClick={toggleSidebar}
              className="p-2 -ml-2 text-gray-400 hover:text-[#0097A7] transition-colors rounded-lg hover:bg-white/5"
              title="Open Sidebar"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Project Info */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#111111] border border-white/5 rounded-lg flex items-center justify-center text-lg grayscale group-hover:grayscale-0 transition-all">
            {projectType.icon}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-[11px] font-black text-white uppercase tracking-tight">{currentProject.name}</h2>
              <span className="px-2 py-0.5 bg-[#0097A7]/20 text-[#0097A7] rounded-full text-[8px] font-black uppercase tracking-widest">
                {currentProject.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest">
              <span>{projectType.label}</span>
              <ChevronRight className="w-2.5 h-2.5" />
              <span>{currentProject.subtype}</span>
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-white/5" />

        {/* Client & Metadata */}
        <div className="flex items-center gap-6">
          {currentProject.clientName && (
            <div className="flex items-center gap-2">
              <Briefcase className="w-3 h-3 text-gray-600" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{currentProject.clientName}</span>
            </div>
          )}
          {currentProject.deadline && (
            <div className="flex items-center gap-2">
              <Calendar className="w-3 h-3 text-gray-600" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                {typeof (currentProject.deadline as any).toDate === 'function' 
                  ? (currentProject.deadline as any).toDate().toLocaleDateString() 
                  : new Date(currentProject.deadline as any).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        <div className="h-6 w-px bg-white/5" />

        {/* Color Palette */}
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: currentProject.primaryColor }} />
          <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: currentProject.secondaryColor }} />
          <div className="w-3 h-3 rounded-full border border-white/10" style={{ backgroundColor: currentProject.accentColor }} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button 
          onClick={() => openSettings('edit')}
          className="flex items-center gap-2 px-4 py-1.5 bg-[#111111] hover:bg-white/5 border border-white/5 rounded-full text-[9px] font-black text-gray-400 hover:text-white uppercase tracking-widest transition-all"
        >
          <Settings className="w-3 h-3" />
          Project Settings
        </button>
        
        <button 
          onClick={clearProject}
          className="flex items-center gap-2 px-4 py-1.5 bg-[#0097A7]/10 hover:bg-[#0097A7]/20 border border-[#0097A7]/20 rounded-full text-[9px] font-black text-[#0097A7] uppercase tracking-widest transition-all"
        >
          <ArrowLeftRight className="w-3 h-3" />
          Switch Project
        </button>
      </div>
    </div>
  );
}

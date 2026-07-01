import { useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { PROJECT_TYPES } from '../types/project.types';
import { Settings, ArrowLeftRight, Briefcase, ChevronRight, PanelLeftOpen, DollarSign, Coins } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function ProjectContextBar() {
  const { currentProject, clearProject, openSettings, isSidebarOpen, toggleSidebar } = useProjectStore();
  const [showCostBreakdown, setShowCostBreakdown] = useState(false);

  if (!currentProject) return null;

  const projectType = PROJECT_TYPES[currentProject.type as keyof typeof PROJECT_TYPES] || PROJECT_TYPES.personal;
  const usage = currentProject.usage || {
    totalCost: 0, textCost: 0, imageCost: 0, videoCost: 0, audioCost: 0,
    totalTokens: 0, totalImages: 0, totalVideos: 0, totalAudio: 0,
  };

  const costRow = (label: string, value: number) => (
    <div className="flex items-center justify-between">
      <span className="text-xs text-gray-400">{label}</span>
      <span className="text-xs tabular-nums text-white">${(value || 0).toFixed(4)}</span>
    </div>
  );

  return (
    <div className="relative z-50 flex h-12 items-center justify-between border-b border-white/5 bg-black px-5">
      <div className="flex items-center gap-4">
        <AnimatePresence initial={false}>
          {!isSidebarOpen && (
            <motion.button
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              onClick={toggleSidebar}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-[transform,color,background-color] duration-150 hover:bg-white/5 hover:text-[#0097A7] active:scale-[0.96]"
              title="Open sidebar"
            >
              <PanelLeftOpen className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Project */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04] text-base ring-1 ring-white/10">
            {projectType.icon}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-white">{currentProject.name}</h2>
              <span className="rounded-full bg-[#0097A7]/15 px-2 py-0.5 text-[10px] font-medium capitalize text-[#0097A7]">
                {currentProject.status}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <span>{projectType.label}</span>
              <ChevronRight className="h-3 w-3" />
              <span>{currentProject.subtype}</span>
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-white/10" />

        {currentProject.clientName && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Briefcase className="h-3.5 w-3.5 text-gray-600" />
            <span>{currentProject.clientName}</span>
            {currentProject.clientIndustry && <span className="text-gray-600">· {currentProject.clientIndustry}</span>}
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {[currentProject.primaryColor, currentProject.secondaryColor, currentProject.accentColor].map((c, i) => (
            <span key={i} className="h-3.5 w-3.5 rounded-full ring-1 ring-inset ring-white/10" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Cost */}
        <div className="relative" onMouseEnter={() => setShowCostBreakdown(true)} onMouseLeave={() => setShowCostBreakdown(false)}>
          <div className="flex cursor-default items-center gap-1.5 rounded-lg bg-white/[0.04] px-3 py-1.5 ring-1 ring-white/10 transition-shadow duration-150 hover:ring-[#0097A7]/30">
            <DollarSign className="h-3.5 w-3.5 text-[#0097A7]" />
            <span className="text-[13px] font-medium tabular-nums text-[#0097A7]">{usage.totalCost.toFixed(4)}</span>
          </div>

          <AnimatePresence>
            {showCostBreakdown && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                transition={{ duration: 0.15, ease: [0.2, 0, 0, 1] }}
                className="absolute right-0 top-full z-50 mt-2 w-60 rounded-xl bg-[#0d0d0d] p-3 ring-1 ring-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.7)]"
              >
                <p className="mb-3 text-[10px] font-medium uppercase tracking-wide text-gray-500">Cost breakdown</p>
                <div className="space-y-2">
                  {costRow('Text / chat', usage.textCost)}
                  {costRow(`Images (${usage.totalImages || 0})`, usage.imageCost)}
                  {costRow(`Videos (${usage.totalVideos || 0})`, usage.videoCost)}
                  {costRow(`Audio (${usage.totalAudio || 0})`, usage.audioCost)}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3">
                  <span className="text-xs font-medium text-[#0097A7]">Total</span>
                  <span className="text-sm font-semibold tabular-nums text-[#0097A7]">${usage.totalCost.toFixed(4)}</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 border-t border-white/5 pt-2 text-[10px] text-gray-600">
                  <Coins className="h-2.5 w-2.5" />
                  <span>Cumulative — never decreases</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <button
          onClick={() => openSettings('edit')}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-gray-400 ring-1 ring-white/10 transition-[transform,color,background-color,box-shadow] duration-150 hover:bg-white/5 hover:text-white hover:ring-white/20 active:scale-[0.96]"
        >
          <Settings className="h-3.5 w-3.5" />
          Settings
        </button>

        <button
          onClick={clearProject}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0097A7]/10 px-3 text-xs font-medium text-[#0097A7] ring-1 ring-[#0097A7]/20 transition-[transform,background-color] duration-150 hover:bg-[#0097A7]/15 active:scale-[0.96]"
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          Switch project
        </button>
      </div>
    </div>
  );
}

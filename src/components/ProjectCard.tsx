import React, { useState } from 'react';
import { Project, PROJECT_TYPES, ProjectStatus } from '../types/project.types';
import { User, Trash2, Settings } from 'lucide-react';
import { motion } from 'motion/react';

interface ProjectCardProps {
  project: Project;
  layout?: 'grid' | 'list';
  isShared?: boolean;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (status: ProjectStatus) => void;
  key?: string | number;
}

export default function ProjectCard({ project, layout = 'grid', isShared, onClick, onEdit, onDelete, onStatusChange }: ProjectCardProps) {
  const [isStatusMenuOpen, setIsStatusMenuOpen] = useState(false);
  const projectType = PROJECT_TYPES[project.type as keyof typeof PROJECT_TYPES] || PROJECT_TYPES.personal;
  
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (layout === 'list') {
    return (
      <motion.div
        whileHover={{ x: 4 }}
        whileTap={{ scale: 0.995 }}
        onClick={onClick}
        className="group relative bg-black border border-white/5 hover:border-[rgba(0,151,167,0.2)] rounded-2xl p-4 cursor-pointer transition-all flex items-center gap-5"
      >
        {/* Thumbnail */}
        <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-gradient-to-br from-[rgba(0,151,167,0.1)] to-black">
          {project.coverImage ? (
            <img src={project.coverImage} alt={project.name} className="w-full h-full object-contain" style={{ opacity: 0.7 }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-xl grayscale opacity-30">{projectType.icon}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[9px] font-semibold text-[#0097A7] uppercase tracking-[0.14em]">{projectType.label}</span>
            <span className="text-[8px] text-[#4A6070] font-medium uppercase tracking-widest">{project.subtype}</span>
          </div>
          <h3 className="text-sm font-semibold group-hover:text-[#0097A7] transition-colors truncate">
            {project.name}
          </h3>
          {project.clientName && (
            <p className="text-[10px] text-[#2C3A4E] mt-0.5 tracking-tight">{project.clientName}</p>
          )}
        </div>

        {/* Status */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={`w-1.5 h-1.5 rounded-full ${project.status === 'active' ? 'bg-[#0097A7] shadow-[0_0_5px_#0097A7]' : project.status === 'completed' ? 'bg-[#22c55e]' : 'bg-[#4A6070]'}`} />
          <span className="text-[10px] font-medium capitalize">{project.status}</span>
        </div>

        {/* Date */}
        <div className="text-[10px] text-[#2C3A4E] shrink-0 min-w-[90px] text-right">{formatDate(project.updatedAt)}</div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="w-[30px] h-[30px] rounded-lg bg-[#121A24] border border-[#1A2434] flex items-center justify-center text-[#8A9EAE] hover:text-[#0097A7] hover:border-[rgba(0,151,167,0.3)] transition-all"
          >
            <Settings className="w-[11px] h-[11px]" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-[30px] h-[30px] rounded-lg bg-[#121A24] border border-[#1A2434] flex items-center justify-center text-[rgba(239,68,68,0.6)] hover:text-red-500 hover:border-red-500/30 transition-all"
          >
            <Trash2 className="w-[11px] h-[11px]" />
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      whileHover={{ scale: 1.025, y: -3 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative bg-[#000000] border border-[rgba(255,255,255,0.05)] hover:border-[rgba(0,151,167,0.3)] rounded-3xl overflow-hidden cursor-pointer transition-all"
      style={{
        height: 320,
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      }}
      animate={{
        boxShadow: '0 4px 20px rgba(0,0,0,0.3), 0 24px 60px rgba(0,0,0,0.6), 0 0 30px rgba(0,151,167,0.1)',
      }}
    >
      {/* Full-bleed Image or category icon - top 85% */}
      <div className="absolute inset-0 h-[85%]">
        {project.coverImage ? (
          <img 
            src={project.coverImage} 
            alt={project.name} 
            className="w-full h-full object-contain"
            style={{ opacity: 0.6 }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[rgba(0,151,167,0.09)] to-black flex items-center justify-center">
            <span className="text-[80px] grayscale opacity-20">{projectType.icon}</span>
          </div>
        )}
      </div>

      {/* Gradient overlay - bottom 40% only */}
      <div className="absolute bottom-0 left-0 right-0 h-[40%] bg-gradient-to-t from-black to-transparent" />

      {/* Status pill - top left */}
      <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 bg-[rgba(4,6,9,0.72)] backdrop-blur-xl border border-[rgba(255,255,255,0.07)] rounded-md">
        <div className={`w-1 h-1 rounded-full ${project.status === 'active' ? 'bg-[#0097A7] shadow-[0_0_5px_#0097A7]' : project.status === 'completed' ? 'bg-[#22c55e]' : 'bg-[#4A6070]'}`} />
        <span className="text-[9px] font-medium text-[rgba(255,255,255,0.55)] tracking-[0.07em] uppercase">{project.status}</span>
      </div>

      {/* Shared badge */}
      {isShared && (
        <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 ml-24 bg-[rgba(0,151,167,0.2)] backdrop-blur-xl border border-[rgba(0,151,167,0.3)] rounded-md">
          <User className="w-2.5 h-2.5 text-[#0097A7]" />
          <span className="text-[9px] font-semibold text-[#0097A7] tracking-[0.07em] uppercase">Shared</span>
        </div>
      )}

      {/* Action buttons - top right, on hover */}
      {!isShared && (
        <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-all">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit();
            }}
            className="w-[30px] h-[30px] rounded-full bg-[rgba(4,6,9,0.72)] backdrop-blur-xl border border-[rgba(255,255,255,0.07)] flex items-center justify-center text-[rgba(255,255,255,0.5)] hover:text-[#0097A7] hover:border-[rgba(0,151,167,0.3)] transition-all"
          >
            <Settings className="w-[11px] h-[11px]" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="w-[30px] h-[30px] rounded-full bg-[rgba(4,6,9,0.72)] backdrop-blur-xl border border-[rgba(255,255,255,0.07)] flex items-center justify-center text-[rgba(239,68,68,0.65)] hover:text-red-500 transition-all"
          >
            <Trash2 className="w-[11px] h-[11px]" />
          </button>
        </div>
      )}

      {/* Bottom text - spans full card */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-black">
        <div className="text-[9px] font-semibold text-[#0097A7] tracking-[0.16em] uppercase mb-1">{projectType.label}</div>
        <div className="text-[17px] font-semibold tracking-[-0.03em] leading-tight">{project.name}</div>
        <div className="text-[10px] text-[rgba(255,255,255,0.3)] mt-1">
          {project.clientName} · {formatDate(project.updatedAt)}
        </div>

        {/* Color dots */}
        <div className="flex gap-1.5 mt-2.5">
          <div className="w-[11px] h-[11px] rounded-full border border-[rgba(255,255,255,0.08)]" style={{ backgroundColor: project.primaryColor || '#0097A7' }} />
          <div className="w-[11px] h-[11px] rounded-full border border-[rgba(255,255,255,0.08)]" style={{ backgroundColor: project.secondaryColor || '#C9A96E' }} />
          <div className="w-[11px] h-[11px] rounded-full border border-[rgba(255,255,255,0.08)]" style={{ backgroundColor: project.accentColor || '#F2EDE8' }} />
        </div>
      </div>
    </motion.div>
  );
}

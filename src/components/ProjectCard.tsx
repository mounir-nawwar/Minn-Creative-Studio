import React from 'react';
import { Project, PROJECT_TYPES } from '../types/project.types';
import { Calendar, User, Briefcase, Layout, Clock, Trash2, MoreVertical } from 'lucide-react';
import { motion } from 'motion/react';

interface ProjectCardProps {
  project: Project;
  isShared?: boolean;
  onClick: () => void;
  onDelete: () => void;
  key?: string | number;
}

export default function ProjectCard({ project, isShared, onClick, onDelete }: ProjectCardProps) {
  const projectType = PROJECT_TYPES[project.type as keyof typeof PROJECT_TYPES] || PROJECT_TYPES.personal;
  
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="group relative bg-[#111111] border border-white/5 hover:border-[#0097A7]/50 rounded-3xl overflow-hidden cursor-pointer transition-all shadow-2xl"
    >
      {/* Cover Image or Icon Placeholder */}
      <div className="h-40 bg-[#0a0a0a] relative overflow-hidden">
        {project.coverImage ? (
          <img 
            src={project.coverImage} 
            alt={project.name} 
            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#0097A7]/10 to-black">
            <span className="text-6xl grayscale opacity-20 group-hover:grayscale-0 group-hover:opacity-40 transition-all duration-500">
              {projectType.icon}
            </span>
          </div>
        )}
        
        {/* Status Badge */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <div className="px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${project.status === 'active' ? 'bg-[#0097A7] animate-pulse' : 'bg-gray-500'}`} />
              <span className="text-[9px] font-black text-white uppercase tracking-widest">{project.status}</span>
            </div>
          </div>
          {isShared && (
            <div className="px-3 py-1 bg-[#0097A7]/20 backdrop-blur-md rounded-full border border-[#0097A7]/30">
              <div className="flex items-center gap-2">
                <User className="w-2.5 h-2.5 text-[#0097A7]" />
                <span className="text-[9px] font-black text-[#0097A7] uppercase tracking-widest">Shared</span>
              </div>
            </div>
          )}
        </div>

        {/* Delete Button */}
        {!isShared && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute top-4 right-4 p-2 bg-black/60 backdrop-blur-md rounded-full border border-white/10 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black text-[#0097A7] uppercase tracking-[0.2em]">
              {projectType.label}
            </span>
            <span className="text-[10px] text-gray-600">•</span>
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              {project.subtype}
            </span>
          </div>
          <h3 className="text-lg font-black text-white tracking-tight group-hover:text-[#0097A7] transition-colors truncate">
            {project.name}
          </h3>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {project.clientName && (
            <div className="flex items-center gap-2 text-gray-500">
              <Briefcase className="w-3.5 h-3.5" />
              <span className="text-[10px] font-bold truncate uppercase tracking-tighter">{project.clientName}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{formatDate(project.updatedAt)}</span>
          </div>
        </div>

        {/* Visual Identity Preview */}
        <div className="flex items-center gap-1.5 pt-2">
          <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: project.primaryColor }} />
          <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: project.secondaryColor }} />
          <div className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: project.accentColor }} />
          <div className="flex-1" />
          <div className="flex -space-x-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="w-6 h-6 rounded-full border-2 border-[#111111] bg-[#1a1a1a] flex items-center justify-center">
                <div className="w-1 h-1 bg-gray-600 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

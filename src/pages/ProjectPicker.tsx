import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, Filter, LayoutGrid, List, Sparkles, LogOut } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import ProjectCard from '../components/ProjectCard';
import ProjectCreationOverlay from '../components/ProjectCreationOverlay';
import { Project } from '../types/project.types';
import { auth, signOut } from '../firebase';
import MinnLogo from '../assets/Minn.svg';

export default function ProjectPicker() {
  const { projects, loading, createProject, selectProject, updateProjectById, deleteProject } = useProject();
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived' | 'completed'>('active');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.clientName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === 'all' || p.status === filter;
    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="h-screen w-screen bg-transparent flex flex-col items-center justify-center gap-6">
        <div className="w-16 h-16 border-4 border-[#0097A7] border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(0,151,167,0.2)]" />
        <div className="space-y-4 text-center flex flex-col items-center">
          <img src={MinnLogo} alt="MINN STUDIO" className="h-10 w-auto" />
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] animate-pulse">Loading Projects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent text-white selection:bg-[#0097A7]/30 relative z-10">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-24 bg-black/60 backdrop-blur-xl border-b border-white/5 z-50 px-12 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="space-y-1">
            <img src={MinnLogo} alt="MINN STUDIO" className="h-7 w-auto mb-2" />
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Creative Pipeline Management</p>
          </div>
          
          <div className="h-10 w-px bg-white/10" />
          
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-[#0097A7] transition-colors" />
            <input 
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects or clients..."
              className="bg-[#111111] border border-white/5 rounded-2xl py-3 pl-12 pr-6 text-xs font-bold w-80 focus:outline-none focus:border-[#0097A7] transition-all"
            />
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 bg-[#111111] p-1.5 pr-4 rounded-full border border-white/5">
            <img 
              src={auth.currentUser?.photoURL || ''} 
              alt="User" 
              className="w-8 h-8 rounded-full border border-[#0097A7]"
            />
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-white leading-none uppercase">{auth.currentUser?.displayName}</span>
              <button 
                onClick={() => signOut()}
                className="text-[8px] font-bold text-gray-600 hover:text-red-500 uppercase tracking-widest text-left"
              >
                Sign Out
              </button>
            </div>
          </div>
          
          <button
            onClick={() => setIsOverlayOpen(true)}
            className="flex items-center gap-3 px-8 py-4 bg-[#0097A7] text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] hover:scale-105 transition-all shadow-[0_0_30px_rgba(0,151,167,0.3)]"
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-20 px-12 max-w-[1600px] mx-auto">
        {/* Filters */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3">
            {['all', 'active', 'archived', 'completed'].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
                  filter === f 
                  ? 'bg-white text-black border-white' 
                  : 'bg-[#111111] text-gray-500 border-white/5 hover:border-white/20'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2 p-1 bg-[#111111] rounded-xl border border-white/5">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-white'}`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-white'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Project Grid / List */}
        <AnimatePresence mode="popLayout">
          {filteredProjects.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-40 text-center space-y-8"
            >
              <div className="w-32 h-32 bg-[#111111] rounded-[40px] flex items-center justify-center border border-white/5">
                <Sparkles className="w-12 h-12 text-gray-800" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-black text-white tracking-tighter uppercase">No projects found</h2>
                <p className="text-gray-500 text-sm max-w-md mx-auto">
                  {searchQuery 
                    ? `We couldn't find any projects matching "${searchQuery}"` 
                    : "You haven't created any projects yet. Start by creating your first creative mission."}
                </p>
              </div>
              {!searchQuery && (
                <button
                  onClick={() => setIsOverlayOpen(true)}
                  className="px-10 py-4 bg-white text-black rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] hover:scale-105 transition-all"
                >
                  Create Your First Project
                </button>
              )}
            </motion.div>
          ) : (
            <motion.div 
              layout
              className={viewMode === 'grid' 
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8"
                : "flex flex-col gap-4"
              }
            >
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  layout={viewMode}
                  isShared={project.userId !== auth.currentUser?.uid}
                  onClick={() => selectProject(project)}
                  onEdit={() => setEditingProject(project)}
                  onDelete={() => deleteProject(project.id)}
                  onStatusChange={(status) => updateProjectById(project.id, { status })}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Creation Overlay */}
      <AnimatePresence>
        {(isOverlayOpen || editingProject) && (
          <ProjectCreationOverlay
            isOpen={isOverlayOpen || !!editingProject}
            mode={editingProject ? 'edit' : 'create'}
            existingProject={editingProject}
            onClose={() => {
              setIsOverlayOpen(false);
              setEditingProject(null);
            }}
            onCreate={async (data) => {
              if (editingProject) {
                await updateProjectById(editingProject.id, data);
                setEditingProject(null);
              } else {
                const newProject = await createProject(data);
                selectProject(newProject);
              }
            }}
          />
        )}
      </AnimatePresence>

      {/* Footer Branding */}
      <footer className="fixed bottom-8 left-1/2 -translate-x-1/2 text-center space-y-2 opacity-20 hover:opacity-100 transition-opacity">
        <p className="text-[10px] font-black text-white uppercase tracking-[0.5em]">MINN STUDIO 2026</p>
        <div className="flex items-center justify-center gap-4">
          <div className="w-1 h-1 bg-[#0097A7] rounded-full" />
          <div className="w-1 h-1 bg-[#0097A7] rounded-full" />
          <div className="w-1 h-1 bg-[#0097A7] rounded-full" />
        </div>
      </footer>
    </div>
  );
}

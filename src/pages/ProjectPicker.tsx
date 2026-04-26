import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, Search, LayoutGrid, List, Sparkles, LogOut, Trash2, RotateCcw, Calendar, Clock, AlertTriangle, User } from 'lucide-react';
import { useProject } from '../hooks/useProject';
import ProjectCard from '../components/ProjectCard';
import ProjectCreationOverlay from '../components/ProjectCreationOverlay';
import DeleteProjectModal from '../components/DeleteProjectModal';
import { Project } from '../types/project.types';
import { auth, signOut } from '../firebase';
import MinnLogo from '../assets/Minn.svg';

const formatDate = (timestamp: any): string => {
  if (!timestamp) return 'Unknown';
  const date = timestamp.toDate?.() ?? new Date(timestamp);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ProjectPicker() {
  const {
    projects,
    archivedProjects,
    loading,
    createProject,
    selectProject,
    updateProjectById,
    deleteProject,
    restoreProject,
    permanentDeleteProject,
    getDaysUntilDeletion,
    RETENTION_DAYS
  } = useProject();
  
  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'archived' | 'completed' | 'recycle-bin'>('active');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [profileOpen, setProfileOpen] = useState(false);

  const filteredProjects = filter === 'recycle-bin' 
    ? archivedProjects 
    : projects.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             p.clientName?.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filter === 'all' || p.status === filter;
        return matchesSearch && matchesFilter;
      });

  const archivedCount = archivedProjects.length;

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
      <header className="fixed top-0 left-0 right-0 h-[70px] z-50 px-9 flex items-center justify-between">
        <div className="flex items-center gap-7">
          <img src={MinnLogo} alt="MINN STUDIO" style={{ height: 22, width: 'auto', display: 'block' }} />

          <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.06)' }} />

          <div className="relative">
            <Search className="absolute left-[13px] top-1/2 -translate-y-1/2 w-4 h-4 text-[#2C3A4E]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects or clients…"
              style={{
                width: 300,
                padding: '9px 16px 9px 36px',
                background: '#080B0E',
                border: '1px solid #1A2434',
                borderRadius: 11,
                fontSize: 13,
                color: '#F2EDE8',
                fontFamily: 'inherit',
                letterSpacing: '-0.01em',
                transition: 'border-color 0.15s',
              }}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Profile pill */}
          <div className="relative">
            <div 
              onClick={() => setProfileOpen(!profileOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 14px 7px 8px',
                borderRadius: 999,
                background: '#080B0E',
                border: '1px solid #1A2434',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 30,
                height: 30,
                borderRadius: '50%',
                background: '#121A24',
                border: '1.5px solid rgba(0,151,167,0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#4A6070',
                overflow: 'hidden',
              }}>
                {auth.currentUser?.photoURL ? (
                  <img src={auth.currentUser?.photoURL} alt="User" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-4 h-4" />
                )}
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#F2EDE8', letterSpacing: '-0.01em', lineHeight: 1 }}>{auth.currentUser?.displayName}</div>
                <div style={{ fontSize: 10, color: '#2C3A4E', marginTop: 2, letterSpacing: '0.01em' }}>Admin</div>
              </div>
            </div>
            {profileOpen && (
              <div className="absolute top-full right-0 mt-2 p-1.5 border border-[rgba(255,255,255,0.07)] rounded-[14px] min-w-[170px] shadow-[0_16px_40px_rgba(0,0,0,0.6)] z-50" style={{ animation: 'scaleIn 0.18s cubic-bezier(0.22,1,0.36,1)', background: '#080B0E' }}>
                <button 
                  onClick={() => {
                    signOut();
                    setProfileOpen(false);
                  }} 
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[9px] bg-none border-none text-[12px] font-medium"
                  style={{ color: 'rgba(239,68,68,0.7)', letterSpacing: '-0.01em', textAlign: 'left' }}
                >
                  <LogOut className="w-[12px] h-[12px]" />
                  Sign Out
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setIsOverlayOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 22px',
              borderRadius: 12,
              background: '#0097A7',
              border: 'none',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: '-0.01em',
              boxShadow: '0 0 22px rgba(0,151,167,0.3)',
              transition: 'all 0.18s',
            }}
          >
            <Plus className="w-4 h-4" />
            New Project
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main style={{ paddingTop: 110, paddingBottom: 80, paddingLeft: 36, paddingRight: 36, maxWidth: 1400, margin: '0 auto' }}>
        {/* Filters */}
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-1.5">
            {['all', 'active', 'completed', 'archived'].map((f) => {
              const isActive = filter === f;
              const label = f.charAt(0).toUpperCase() + f.slice(1);
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className="px-[18px] py-2 rounded-full text-[12px] font-medium transition-all border"
                  style={{
                    background: isActive ? '#F2EDE8' : 'transparent',
                    border: `1px solid ${isActive ? '#F2EDE8' : 'rgba(255,255,255,0.07)'}`,
                    color: isActive ? '#080B0E' : '#4A6070',
                    letterSpacing: '-0.01em',
                  }}
                >
                  {label}
                </button>
              );
            })}
            
            {/* Recycle Bin Tab */}
            <button
              onClick={() => setFilter('recycle-bin')}
              className="px-[18px] py-2 rounded-full text-[12px] font-medium transition-all border"
              style={{
                background: filter === 'recycle-bin' ? '#0097A7' : (archivedCount > 0 ? 'rgba(0,151,167,0.1)' : 'transparent'),
                border: `1px solid ${filter === 'recycle-bin' ? '#0097A7' : (archivedCount > 0 ? 'rgba(0,151,167,0.3)' : 'rgba(255,255,255,0.07)')}`,
                color: filter === 'recycle-bin' ? '#fff' : (archivedCount > 0 ? '#0097A7' : '#4A6070'),
                letterSpacing: '-0.01em',
                display: 'flex',
                alignItems: 'center',
                gap: 7,
              }}
            >
              Recycle Bin
              {archivedCount > 0 && (
                <span 
                  style={{
                    background: filter === 'recycle-bin' ? 'rgba(255,255,255,0.25)' : 'rgba(0,151,167,0.2)',
                    color: filter === 'recycle-bin' ? '#fff' : '#0097A7',
                    borderRadius: 999,
                    minWidth: 18,
                    height: 18,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9,
                    fontWeight: 600,
                    padding: '0 5px'
                  }}
                >
                  {archivedCount}
                </span>
              )}
            </button>
          </div>
          
          <div className="flex items-center gap-0.5 p-1 border border-[#1A2434] rounded-[10px]" style={{ background: '#080B0E' }}>
            <button 
              onClick={() => setViewMode('grid')}
              className="w-8 h-8 rounded-[7px] flex items-center justify-center transition-all"
              style={{
                background: viewMode === 'grid' ? '#1A2535' : 'transparent',
                color: viewMode === 'grid' ? '#F2EDE8' : '#2C3A4E',
              }}
            >
              <LayoutGrid className="w-[14px] h-[14px]" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className="w-8 h-8 rounded-[7px] flex items-center justify-center transition-all"
              style={{
                background: viewMode === 'list' ? '#1A2535' : 'transparent',
                color: viewMode === 'list' ? '#F2EDE8' : '#2C3A4E',
              }}
            >
            <List className="w-[14px] h-[14px]" />
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
              <div className="w-20 h-20 rounded-[24px] flex items-center justify-center border border-[#1A2434]" style={{ background: '#080B0E' }}>
                {filter === 'recycle-bin' ? (
                  <Trash2 className="w-7 h-7 text-[#2C3A4E]" />
                ) : (
                  <Sparkles className="w-7 h-7 text-[#2C3A4E]" />
                )}
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-semibold text-[#F2EDE8]" style={{ letterSpacing: '-0.03em' }}>
                  {filter === 'recycle-bin' ? 'Recycle bin is empty' : 'No projects here'}
                </h2>
                <p className="text-[#2C3A4E] text-sm mx-auto" style={{ letterSpacing: '-0.01em', maxWidth: 340 }}>
                  {filter === 'recycle-bin' 
                    ? `Deleted projects will appear here for ${RETENTION_DAYS} days before permanent removal.`
                    : searchQuery 
                      ? `We couldn't find any projects matching "${searchQuery}"` 
                      : 'Create your first project to get started.'}
                </p>
              </div>
              {!searchQuery && filter !== 'recycle-bin' && (
                <button
                  onClick={() => setIsOverlayOpen(true)}
                  className="flex items-center gap-2 px-[28px] py-3 bg-[#0097A7] text-white rounded-[12px] text-[13px] font-medium transition-all"
                  style={{ letterSpacing: '-0.01em', boxShadow: '0 0 22px rgba(0,151,167,0.3)', marginTop: 4 }}
                >
                  <Plus className="w-[13px] h-[13px]" />
                  New Project
                </button>
              )}
            </motion.div>
          ) : filter === 'recycle-bin' ? (
            <motion.div 
              layout
              className="flex flex-col gap-4"
            >
              {filteredProjects.map((project) => {
                const daysLeft = getDaysUntilDeletion(project);
                const isExpiringSoon = daysLeft !== null && daysLeft <= 7;
                
                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className="group bg-[#111111] border border-white/5 hover:border-[#0097A7]/30 rounded-2xl p-5 transition-all"
                  >
                    <div className="flex items-center gap-5">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-black text-white tracking-tight truncate group-hover:text-[#0097A7] transition-colors">
                          {project.name}
                        </h3>
                        {project.clientName && (
                          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-tighter mt-0.5">
                            {project.clientName}
                          </p>
                        )}
                        
                        <div className="flex items-center gap-4 mt-3">
                          <div className="flex items-center gap-1.5 text-gray-500">
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="text-[10px] font-bold uppercase tracking-tight">
                              Deleted {formatDate(project.deletedAt)}
                            </span>
                          </div>
                          
                          {daysLeft !== null && (
                            <div className={`flex items-center gap-1.5 ${isExpiringSoon ? 'text-orange-400' : 'text-gray-500'}`}>
                              <Clock className="w-3.5 h-3.5" />
                              <span className="text-[10px] font-bold uppercase tracking-tight">
                                {daysLeft === 0 ? 'Expires today!' : `${daysLeft} days left`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {isExpiringSoon && (
                        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                          <AlertTriangle className="w-4 h-4 text-orange-400" />
                          <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">
                            Expiring Soon
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => restoreProject(project.id)}
                          className="flex items-center gap-2 px-4 py-2.5 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                        >
                          <RotateCcw className="w-4 h-4" />
                          <span className="hidden sm:inline">Restore</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            if (confirm('Permanently delete this project? This cannot be undone.')) {
                              permanentDeleteProject(project.id);
                            }
                          }}
                          className="p-2.5 text-gray-500 hover:text-red-500 hover:bg-red-500/10 rounded-xl border border-white/5 hover:border-red-500/30 transition-all"
                          title="Delete Forever"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          ) : (
            <motion.div 
              layout
              className={viewMode === 'grid' 
                ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
                : "flex flex-col gap-2"
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
                  onDelete={() => setProjectToDelete(project)}
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

      {/* Delete Confirmation Modal */}
      <DeleteProjectModal
        project={projectToDelete}
        isOpen={!!projectToDelete}
        onClose={() => setProjectToDelete(null)}
        onConfirm={() => {
          if (projectToDelete) {
            deleteProject(projectToDelete.id);
            setProjectToDelete(null);
          }
        }}
        retentionDays={RETENTION_DAYS}
      />

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.04)', padding: '40px 36px 48px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, marginTop: 60 }}>
        <img src={MinnLogo} alt="MINN STUDIO" className="h-[18px] w-auto" />

        <div className="flex items-center gap-7">
          {['Privacy', 'Terms', 'Docs', 'Status'].map((link, i, arr) => (
            <React.Fragment key={link}>
              <span className="text-[12px] text-[#2C3A4E] hover:text-[#8A9EAE] cursor-pointer transition-colors tracking-[-0.01em]">
                {link}
              </span>
              {i < arr.length - 1 && (
                <div className="w-[3px] h-[3px] rounded-full bg-[#1A2535]" />
              )}
            </React.Fragment>
          ))}
        </div>

        <span className="text-[11px] text-[#1A2535] tracking-[-0.005em]">
          © 2026 Minn Studio. All rights reserved.
        </span>
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, LayoutGrid, List, Sparkles, Trash2, RotateCcw, Calendar, Clock, AlertTriangle,
} from 'lucide-react';
import { useProject } from '../hooks/useProject';
import ProjectCard from '../components/ProjectCard';
import ProjectPickerHeader from '../components/ProjectPickerHeader';
import ProjectCreationOverlay from '../components/ProjectCreationOverlay';
import DeleteProjectModal from '../components/DeleteProjectModal';
import LibraryDialog from '../components/Library/LibraryDialog';
import AssetExpandModal from '../components/AssetExpandModal';
import { Project } from '../types/project.types';
import { auth } from '../lib/api';
import MinnLogo from '../assets/Minn.svg';

type Filter = 'all' | 'active' | 'archived' | 'completed' | 'recycle-bin';
const BASE_FILTERS: Filter[] = ['all', 'active', 'completed', 'archived'];

const formatDate = (timestamp: unknown): string => {
  if (!timestamp) return 'Unknown';
  const date = new Date(timestamp as string | number | Date);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function ProjectPicker({ onLogout }: { onLogout: () => void }) {
  const {
    projects,
    archivedProjects,
    loading,
    createProject,
    selectProject,
    enterPlayground,
    updateProjectById,
    deleteProject,
    restoreProject,
    permanentDeleteProject,
    getDaysUntilDeletion,
    RETENTION_DAYS,
  } = useProject();

  const [isOverlayOpen, setIsOverlayOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('active');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);

  const currentUser = auth.getCurrentUser();

  const filteredProjects = filter === 'recycle-bin'
    ? archivedProjects
    : projects.filter((p) => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = p.name.toLowerCase().includes(q) || p.clientName?.toLowerCase().includes(q);
        const matchesFilter = filter === 'all' || p.status === filter;
        return matchesSearch && matchesFilter;
      });

  const archivedCount = archivedProjects.length;

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-transparent antialiased">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#0097A7]/20 border-t-[#0097A7]" />
        <div className="flex flex-col items-center gap-3">
          <img src={MinnLogo} alt="MINN STUDIO" className="h-9 w-auto" />
          <p className="text-[11px] uppercase tracking-[0.25em] text-gray-600">Loading projects</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 min-h-screen bg-transparent text-white antialiased selection:bg-[#0097A7]/30">
      {/* Header */}
      <ProjectPickerHeader
        user={currentUser}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onNewProject={() => setIsOverlayOpen(true)}
        onEnterPlayground={(mode) => { void enterPlayground(mode); }}
        onOpenLibrary={() => setIsLibraryOpen(true)}
        onLogout={onLogout}
      />

      {/* Global asset library (+ preview modal, which the main app normally mounts) */}
      <LibraryDialog open={isLibraryOpen} onOpenChange={setIsLibraryOpen} />
      <AssetExpandModal />

      {/* Main */}
      <main className="mx-auto max-w-[1600px] px-6 pb-24 pt-24">
        {/* Filters */}
        <div className="mb-10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {BASE_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`h-9 rounded-full px-4 text-[13px] font-medium capitalize ring-1 transition-[transform,color,background-color,box-shadow] duration-150 active:scale-[0.96] ${
                  filter === f
                    ? 'bg-white/10 text-white ring-white/10'
                    : 'text-gray-400 ring-transparent hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                {f}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setFilter('recycle-bin')}
              className={`inline-flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium ring-1 transition-[transform,color,background-color,box-shadow] duration-150 active:scale-[0.96] ${
                filter === 'recycle-bin'
                  ? 'bg-[#0097A7] text-white ring-[#0097A7]'
                  : archivedCount > 0
                    ? 'bg-[#0097A7]/10 text-[#0097A7] ring-[#0097A7]/25 hover:bg-[#0097A7]/15'
                    : 'text-gray-400 ring-transparent hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              Recycle Bin
              {archivedCount > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#0097A7] px-1.5 text-[11px] font-semibold tabular-nums text-white">
                  {archivedCount}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-xl bg-[#111111] p-1 ring-1 ring-white/5">
            {([['grid', LayoutGrid], ['list', List]] as const).map(([mode, Icon]) => (
              <button
                key={mode}
                type="button"
                aria-label={`${mode} view`}
                onClick={() => setViewMode(mode)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-lg transition-[transform,color,background-color] duration-150 active:scale-[0.96] ${
                  viewMode === mode ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'
                }`}
              >
                <Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-6 py-32 text-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[#111111] ring-1 ring-white/5">
              {filter === 'recycle-bin' ? (
                <Trash2 className="h-10 w-10 text-gray-700" />
              ) : (
                <Sparkles className="h-10 w-10 text-gray-700" />
              )}
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-white" style={{ textWrap: 'balance' }}>
                {filter === 'recycle-bin' ? 'Recycle bin is empty' : 'No projects found'}
              </h2>
              <p className="mx-auto max-w-md text-sm leading-relaxed text-gray-500" style={{ textWrap: 'pretty' }}>
                {filter === 'recycle-bin'
                  ? `Deleted projects stay here for ${RETENTION_DAYS} days before they're removed for good.`
                  : searchQuery
                    ? `Nothing matches "${searchQuery}".`
                    : 'You haven’t created any projects yet. Start your first one to get going.'}
              </p>
            </div>
            {!searchQuery && filter !== 'recycle-bin' && (
              <button
                type="button"
                onClick={() => setIsOverlayOpen(true)}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-6 text-sm font-medium text-black transition-transform duration-150 active:scale-[0.96]"
              >
                <Plus className="h-4 w-4" />
                Create your first project
              </button>
            )}
          </div>
        ) : filter === 'recycle-bin' ? (
          <div className="flex flex-col gap-3">
            <AnimatePresence initial={false}>
              {filteredProjects.map((project) => {
                const daysLeft = getDaysUntilDeletion(project);
                const isExpiringSoon = daysLeft !== null && daysLeft <= 7;

                return (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                    className="group flex items-center gap-5 rounded-2xl bg-[#111111] p-5 ring-1 ring-white/5 transition-shadow duration-200 hover:shadow-[0_10px_30px_rgba(0,0,0,0.5)]"
                  >
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-[15px] font-semibold text-white">{project.name}</h3>
                      {project.clientName && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">{project.clientName}</p>
                      )}

                      <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span className="tabular-nums">Deleted {formatDate(project.deletedAt)}</span>
                        </span>
                        {daysLeft !== null && (
                          <span className={`inline-flex items-center gap-1.5 ${isExpiringSoon ? 'text-orange-400' : ''}`}>
                            <Clock className="h-3.5 w-3.5" />
                            <span className="tabular-nums">
                              {daysLeft === 0 ? 'Expires today' : `${daysLeft} days left`}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpiringSoon && (
                      <div className="hidden items-center gap-2 rounded-lg bg-orange-500/10 px-3 py-1.5 ring-1 ring-orange-500/20 md:flex">
                        <AlertTriangle className="h-4 w-4 text-orange-400" />
                        <span className="text-xs font-medium text-orange-400">Expiring soon</span>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => restoreProject(project.id)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0097A7] px-3.5 text-xs font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96]"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span className="hidden sm:inline">Restore</span>
                      </button>
                      <button
                        type="button"
                        aria-label="Delete forever"
                        title="Delete forever"
                        onClick={() => {
                          if (confirm('Permanently delete this project? This cannot be undone.')) {
                            permanentDeleteProject(project.id);
                          }
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 ring-1 ring-white/5 transition-[transform,color,box-shadow] duration-150 hover:text-red-400 hover:ring-red-500/30 active:scale-[0.96]"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'flex flex-col gap-3'
            }
          >
            {filteredProjects.map((project, i) => (
              <motion.div
                key={project.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, ease: [0.2, 0, 0, 1], delay: Math.min(i * 0.03, 0.3) }}
              >
                <ProjectCard
                  project={project}
                  layout={viewMode}
                  isShared={project.userId !== currentUser?.id}
                  onClick={() => selectProject(project)}
                  onEdit={() => setEditingProject(project)}
                  onDelete={() => setProjectToDelete(project)}
                  onStatusChange={(status) => updateProjectById(project.id, { status })}
                />
              </motion.div>
            ))}
          </div>
        )}
      </main>

      {/* Creation / edit overlay */}
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

      {/* Delete confirmation */}
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
      <footer className="pointer-events-none fixed bottom-6 left-1/2 -translate-x-1/2">
        <p className="text-[11px] uppercase tracking-[0.35em] text-white/20">MINN STUDIO · 2026</p>
      </footer>
    </div>
  );
}

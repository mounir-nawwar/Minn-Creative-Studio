import { create } from 'zustand';
import { Project } from '../types/project.types';
import { PLAYGROUND_PROJECT_ID } from '../constants';

/** The two creation workspaces inside an open project (or the playground) */
export type StudioMode = 'canvas' | 'chat';

interface ProjectStore {
  currentProject: Project | null;
  activeWorkflowId: string | null;
  isSettingsOpen: boolean;
  isSidebarOpen: boolean;
  settingsMode: 'create' | 'edit';
  uploadEnabled: boolean;
  studioMode: StudioMode;
  setCurrentProject: (project: Project | null) => void;
  setActiveWorkflowId: (id: string | null) => void;
  clearProject: () => void;
  updateProject: (updates: Partial<Project>) => void;
  openSettings: (mode?: 'create' | 'edit') => void;
  closeSettings: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setUploadEnabled: (v: boolean) => void;
  setStudioMode: (mode: StudioMode) => void;
}

/** True when the open "project" is the shared hidden playground sentinel */
export function isPlaygroundProject(project: Project | null): boolean {
  return project?.id === PLAYGROUND_PROJECT_ID;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  activeWorkflowId: null,
  isSettingsOpen: false,
  isSidebarOpen: true,
  settingsMode: 'create',
  uploadEnabled: true,
  studioMode: 'canvas',
  setCurrentProject: (project) => set({ currentProject: project }),
  setActiveWorkflowId: (id) => set({ activeWorkflowId: id }),
  // Reset to canvas so the next project always opens predictably
  clearProject: () => set({ currentProject: null, activeWorkflowId: null, studioMode: 'canvas' }),
  updateProject: (updates) => set((state) => ({
    currentProject: state.currentProject ? { ...state.currentProject, ...updates } : null
  })),
  openSettings: (mode = 'create') => set({ isSettingsOpen: true, settingsMode: mode }),
  closeSettings: () => set({ isSettingsOpen: false }),
  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setUploadEnabled: (v) => set({ uploadEnabled: v }),
  setStudioMode: (mode) => set({ studioMode: mode }),
}));

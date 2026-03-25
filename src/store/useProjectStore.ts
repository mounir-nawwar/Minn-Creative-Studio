import { create } from 'zustand';
import { Project } from '../types/project.types';

interface ProjectStore {
  currentProject: Project | null;
  activeWorkflowId: string | null;
  isSettingsOpen: boolean;
  settingsMode: 'create' | 'edit';
  setCurrentProject: (project: Project | null) => void;
  setActiveWorkflowId: (id: string | null) => void;
  clearProject: () => void;
  updateProject: (updates: Partial<Project>) => void;
  openSettings: (mode?: 'create' | 'edit') => void;
  closeSettings: () => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  activeWorkflowId: null,
  isSettingsOpen: false,
  settingsMode: 'create',
  setCurrentProject: (project) => set({ currentProject: project }),
  setActiveWorkflowId: (id) => set({ activeWorkflowId: id }),
  clearProject: () => set({ currentProject: null, activeWorkflowId: null }),
  updateProject: (updates) => set((state) => ({
    currentProject: state.currentProject ? { ...state.currentProject, ...updates } : null
  })),
  openSettings: (mode = 'create') => set({ isSettingsOpen: true, settingsMode: mode }),
  closeSettings: () => set({ isSettingsOpen: false }),
}));

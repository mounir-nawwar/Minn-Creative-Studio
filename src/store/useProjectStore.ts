import { create } from 'zustand';
import { Project } from '../types/project.types';

interface ProjectStore {
  currentProject: Project | null;
  setCurrentProject: (project: Project | null) => void;
  clearProject: () => void;
  updateProject: (updates: Partial<Project>) => void;
}

export const useProjectStore = create<ProjectStore>((set) => ({
  currentProject: null,
  setCurrentProject: (project) => set({ currentProject: project }),
  clearProject: () => set({ currentProject: null }),
  updateProject: (updates) => set((state) => ({
    currentProject: state.currentProject ? { ...state.currentProject, ...updates } : null
  })),
}));

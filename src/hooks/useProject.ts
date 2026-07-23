import { useState, useEffect, useCallback, useRef } from 'react';
import { projectsApi, getAccessToken, Project as ApiProject } from '../lib/api';
import { Project } from '../types/project.types';
import { useProjectStore } from '../store/useProjectStore';
import { RETENTION_DAYS } from '../constants';

// Polling interval in milliseconds
const POLL_INTERVAL = 5000; // 5 seconds

// Convert API project to local Project type
function toProject(apiProject: ApiProject): Project {
  return {
    id: apiProject.id,
    userId: apiProject.user_id,
    name: apiProject.name,
    description: apiProject.description || '',
    type: apiProject.settings?.type || 'content',
    subtype: apiProject.settings?.subtype || 'Other',
    status: apiProject.settings?.status || 'active',
    visualMood: apiProject.settings?.visualMood || [],
    platforms: apiProject.settings?.platforms || [],
    outputFormats: apiProject.settings?.outputFormats || [],
    tags: apiProject.settings?.tags || [],
    aiInstructions: apiProject.settings?.aiInstructions || '',
    primaryColor: apiProject.settings?.primaryColor || '#0097A7',
    secondaryColor: apiProject.settings?.secondaryColor || '#000000',
    accentColor: apiProject.settings?.accentColor || '#FFFFFF',
    fontStyle: apiProject.settings?.fontStyle || 'geometric',
    negativeKeywords: apiProject.settings?.negativeKeywords || '',
    styleKeywords: apiProject.settings?.styleKeywords || '',
    clientName: apiProject.settings?.clientName,
    clientIndustry: apiProject.settings?.clientIndustry,
    collaborators: apiProject.settings?.collaborators || [],
    usage: {
      totalCost: apiProject.usage?.totalCost || 0,
      textCost: apiProject.usage?.textCost || 0,
      imageCost: apiProject.usage?.imageCost || 0,
      videoCost: apiProject.usage?.videoCost || 0,
      audioCost: apiProject.usage?.audioCost || 0,
      totalTokens: apiProject.usage?.totalTokens || 0,
      totalImages: apiProject.usage?.totalImages || 0,
      totalVideos: apiProject.usage?.totalVideos || 0,
      totalAudio: apiProject.usage?.totalAudio || 0,
      lastUpdated: apiProject.usage?.lastUpdated,
    },
    createdAt: apiProject.created_at,
    updatedAt: apiProject.updated_at,
    deletedAt: apiProject.settings?.deletedAt,
    deletedBy: apiProject.settings?.deletedBy,
  } as Project;
}

// Convert local Project to API format
function toApiProject(project: Partial<Project>): any {
  return {
    name: project.name,
    description: project.description,
    settings: {
      type: project.type,
      subtype: project.subtype,
      status: project.status,
      visualMood: project.visualMood,
      platforms: project.platforms,
      outputFormats: project.outputFormats,
      tags: project.tags,
      aiInstructions: project.aiInstructions,
      primaryColor: project.primaryColor,
      secondaryColor: project.secondaryColor,
      accentColor: project.accentColor,
      fontStyle: project.fontStyle,
      negativeKeywords: project.negativeKeywords,
      styleKeywords: project.styleKeywords,
      clientName: project.clientName,
      clientIndustry: project.clientIndustry,
      collaborators: project.collaborators,
      deletedAt: project.deletedAt,
      deletedBy: project.deletedBy,
    }
  };
}

export function useProject() {
  const { currentProject, setCurrentProject, updateProject, clearProject } = useProjectStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch projects
  const fetchProjects = useCallback(async () => {
    // Never hit the API when logged out — avoids 401 spam in the console
    // (this hook also runs at the app root, before/after authentication).
    if (!getAccessToken()) {
      setLoading(false);
      return;
    }
    try {
      const apiProjects = await projectsApi.list();
      const allProjects = apiProjects.map(toProject);
      
      const activeProjects = allProjects.filter(p => p.status !== 'archived');
      const archived = allProjects.filter(p => p.status === 'archived');

      setProjects(activeProjects);
      setArchivedProjects(archived);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
      setLoading(false);
    }
  }, []);

  // Initial fetch and polling
  useEffect(() => {
    fetchProjects();
    pollingRef.current = setInterval(fetchProjects, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchProjects]);

  // Sync currentProject with updates from projects list
  useEffect(() => {
    const storeCurrentProject = useProjectStore.getState().currentProject;
    if (!storeCurrentProject?.id || projects.length === 0) return;
    
    const updated = projects.find(p => p.id === storeCurrentProject.id);
    if (!updated) return;
    
    const newUsage = JSON.stringify(updated.usage);
    const currentUsage = JSON.stringify(storeCurrentProject.usage);
    
    if (newUsage !== currentUsage) {
      useProjectStore.getState().setCurrentProject(updated);
    }
  }, [projects]);

  const createProject = async (projectData: Partial<Project>): Promise<Project> => {
    const now = new Date().toISOString();
    
    const apiProject = await projectsApi.create({
      name: projectData.name || 'Untitled Project',
      description: projectData.description,
      settings: {
        type: projectData.type || 'content',
        subtype: projectData.subtype || 'Other',
        visualMood: projectData.visualMood || [],
        platforms: projectData.platforms || [],
        outputFormats: projectData.outputFormats || [],
        tags: projectData.tags || [],
        aiInstructions: projectData.aiInstructions || '',
        primaryColor: projectData.primaryColor || '#0097A7',
        secondaryColor: projectData.secondaryColor || '#000000',
        accentColor: projectData.accentColor || '#FFFFFF',
        fontStyle: projectData.fontStyle || 'geometric',
        negativeKeywords: projectData.negativeKeywords || '',
        styleKeywords: projectData.styleKeywords || '',
        clientName: projectData.clientName,
        clientIndustry: projectData.clientIndustry,
        collaborators: [],
      }
    });
    
    const project = toProject(apiProject);
    
    // Refresh projects list
    await fetchProjects();
    
    return project;
  };

  const selectProject = (project: Project) => {
    setCurrentProject(project);
  };

  /** Enter the shared playground (no client project) in the chosen workspace mode */
  const enterPlayground = async (mode: 'canvas' | 'chat'): Promise<void> => {
    const apiProject = await projectsApi.ensurePlayground();
    setCurrentProject(toProject(apiProject));
    useProjectStore.getState().setStudioMode(mode);
  };

  const updateCurrentProject = async (updates: Partial<Project>): Promise<void> => {
    if (!currentProject) return;
    await updateProjectById(currentProject.id, updates);
  };

  const updateProjectById = async (projectId: string, updates: Partial<Project>): Promise<void> => {
    const now = new Date().toISOString();
    const apiUpdates = toApiProject(updates);
    
    await projectsApi.update(projectId, {
      ...apiUpdates,
      updated_at: now
    });
    
    if (currentProject?.id === projectId) {
      updateProject({ ...updates, updatedAt: now });
    }
    
    // Refresh projects list
    await fetchProjects();
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    const now = new Date().toISOString();
    
    await projectsApi.update(projectId, {
      settings: { status: 'archived', deletedAt: now },
      updated_at: now
    });
    
    if (currentProject?.id === projectId) {
      clearProject();
    }
    
    // Refresh projects list
    await fetchProjects();
  };

  const restoreProject = async (projectId: string): Promise<void> => {
    const now = new Date().toISOString();
    
    await projectsApi.update(projectId, {
      settings: { status: 'active' },
      updated_at: now
    });
    
    // Refresh projects list
    await fetchProjects();
  };

  const permanentDeleteProject = async (projectId: string): Promise<void> => {
    await projectsApi.delete(projectId);
    
    setArchivedProjects(prev => prev.filter(p => p.id !== projectId));
    
    if (currentProject?.id === projectId) {
      clearProject();
    }
  };

  // Cleanup expired items (older than RETENTION_DAYS)
  const cleanupExpiredProjects = async () => {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);
    
    const expired = archivedProjects.filter(p => {
      if (!p.deletedAt) return false;
      const deletedDate = new Date(p.deletedAt as any);
      return deletedDate < cutoffDate;
    });

    for (const project of expired) {
      await permanentDeleteProject(project.id);
    }

    return expired.length;
  };

  // Get days until permanent deletion
  const getDaysUntilDeletion = (project: Project): number | null => {
    if (!project.deletedAt) return null;
    
    const deletedDate = new Date(project.deletedAt as any);
    const deletionDate = new Date(deletedDate);
    deletionDate.setDate(deletionDate.getDate() + RETENTION_DAYS);
    
    const now = new Date();
    const diffTime = deletionDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays);
  };

  return {
    projects,
    archivedProjects,
    currentProject,
    loading,
    createProject,
    selectProject,
    enterPlayground,
    updateCurrentProject,
    updateProjectById,
    deleteProject,
    restoreProject,
    permanentDeleteProject,
    cleanupExpiredProjects,
    getDaysUntilDeletion,
    clearProject,
    RETENTION_DAYS
  };
}

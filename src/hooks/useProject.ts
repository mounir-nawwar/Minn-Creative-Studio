import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import {
  db,
  auth,
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { Project } from '../types/project.types';
import { useProjectStore } from '../store/useProjectStore';
import { RETENTION_DAYS } from '../constants';

export function useProject() {
  const { currentProject, setCurrentProject, updateProject, clearProject } = useProjectStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [archivedProjects, setArchivedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Load active projects — re-subscribe whenever auth state changes.
  // The [] effect runs once at mount when auth.currentUser may still be null,
  // so we use onAuthStateChanged to set up (and tear down) the Firestore
  // snapshot only after a real user is available.
  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Tear down any existing snapshot when auth changes
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (!user) {
        setProjects([]);
        setArchivedProjects([]);
        setLoading(false);
        return;
      }

      const q = query(
        collection(db, 'projects'),
        orderBy('createdAt', 'desc')
      );

      unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const allProjects = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as Project[];

        const activeProjects = allProjects.filter(p => p.status !== 'archived');
        const archived = allProjects.filter(p => p.status === 'archived');

        setProjects(activeProjects);
        setArchivedProjects(archived);
        setLoading(false);
      }, (error) => {
        console.error('Firestore error in useProject:', error);
        setLoading(false);
        handleFirestoreError(error, OperationType.LIST, 'projects');
      });
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  // Sync currentProject with updates from projects list
  useEffect(() => {
    const storeCurrentProject = useProjectStore.getState().currentProject;
    if (!storeCurrentProject?.id || projects.length === 0) return;
    
    const updated = projects.find(p => p.id === storeCurrentProject.id);
    if (!updated) return;
    
    const newUsage = JSON.stringify(updated.usage);
    const currentUsage = JSON.stringify(storeCurrentProject.usage);
    
    console.log('[useProject] Sync check:', {
      projectId: storeCurrentProject.id,
      updatedUsage: updated.usage,
      currentUsage: storeCurrentProject.usage,
      isDifferent: newUsage !== currentUsage
    });
    
    if (newUsage !== currentUsage) {
      console.log('[useProject] Updating currentProject');
      useProjectStore.getState().setCurrentProject(updated);
    }
  }, [projects]);

  const createProject = async (projectData: Partial<Project>): Promise<Project> => {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const newProjectRef = doc(collection(db, 'projects'));
    const now = serverTimestamp();
    
    const project = {
      ...projectData,
      id: newProjectRef.id,
      userId: auth.currentUser.uid,
      status: 'active' as const,
      createdAt: now,
      updatedAt: now,
      name: projectData.name || 'Untitled Project',
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
      collaborators: [],
    };

    await setDoc(newProjectRef, project);
    return project as Project;
  };

  const selectProject = (project: Project) => {
    setCurrentProject(project);
  };

  const updateCurrentProject = async (updates: Partial<Project>): Promise<void> => {
    if (!currentProject) return;
    await updateProjectById(currentProject.id, updates);
  };

  const updateProjectById = async (projectId: string, updates: Partial<Project>): Promise<void> => {
    const projectRef = doc(db, 'projects', projectId);
    const now = serverTimestamp();
    const fullUpdates = { ...updates, updatedAt: now };
    await updateDoc(projectRef, fullUpdates);
    if (currentProject?.id === projectId) {
      updateProject(fullUpdates);
    }
  };

  const deleteProject = async (projectId: string): Promise<void> => {
    if (!auth.currentUser) throw new Error('User not authenticated');
    
    const projectRef = doc(db, 'projects', projectId);
    const now = serverTimestamp();
    
    await updateDoc(projectRef, {
      status: 'archived',
      deletedAt: now,
      deletedBy: auth.currentUser.uid,
      updatedAt: now
    });
    
    if (currentProject?.id === projectId) {
      clearProject();
    }
  };

  const restoreProject = async (projectId: string): Promise<void> => {
    const projectRef = doc(db, 'projects', projectId);
    const now = serverTimestamp();
    
    await updateDoc(projectRef, {
      status: 'active',
      updatedAt: now
    });
  };

  const permanentDeleteProject = async (projectId: string): Promise<void> => {
    await deleteDoc(doc(db, 'projects', projectId));
    
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
      const deletedDate = p.deletedAt instanceof Timestamp 
        ? p.deletedAt.toDate() 
        : new Date(p.deletedAt as any);
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
    
    const deletedDate = project.deletedAt instanceof Timestamp 
      ? project.deletedAt.toDate() 
      : new Date(project.deletedAt as any);
    
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

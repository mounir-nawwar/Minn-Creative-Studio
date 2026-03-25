import { useState, useEffect } from 'react';
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
  Timestamp
} from '../firebase';
import { Project } from '../types/project.types';
import { useProjectStore } from '../store/useProjectStore';

export function useProject() {
  const { currentProject, setCurrentProject, updateProject, clearProject } = useProjectStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.currentUser) {
      setProjects([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'projects'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('updatedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const projectsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Project[];
      setProjects(projectsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth.currentUser]);

  const createProject = async (projectData: Partial<Project>) => {
    if (!auth.currentUser) throw new Error('User not authenticated');

    const newProjectRef = doc(collection(db, 'projects'));
    const now = serverTimestamp();
    
    const project: any = {
      ...projectData,
      id: newProjectRef.id,
      userId: auth.currentUser.uid,
      status: 'active',
      createdAt: now,
      updatedAt: now,
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
    };

    await setDoc(newProjectRef, project);
    return project as Project;
  };

  const selectProject = (project: Project) => {
    setCurrentProject(project);
  };

  const updateCurrentProject = async (updates: Partial<Project>) => {
    if (!currentProject) return;
    const projectRef = doc(db, 'projects', currentProject.id);
    const now = serverTimestamp();
    const fullUpdates = { ...updates, updatedAt: now };
    await updateDoc(projectRef, fullUpdates);
    updateProject(fullUpdates);
  };

  const deleteProject = async (projectId: string) => {
    await deleteDoc(doc(db, 'projects', projectId));
    if (currentProject?.id === projectId) {
      clearProject();
    }
  };

  return {
    projects,
    currentProject,
    loading,
    createProject,
    selectProject,
    updateCurrentProject,
    deleteProject,
    clearProject
  };
}

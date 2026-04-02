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
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { Asset, AssetType } from '../types/project.types';
import { useProjectStore } from '../store/useProjectStore';
import { API_BASE } from '../constants';

export function useAssets() {
  const { currentProject } = useProjectStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    if (!currentProject || !auth.currentUser) {
      setAssets([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `projects/${currentProject.id}/assets`),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assetsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Asset[];
      setAssets(assetsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `projects/${currentProject.id}/assets`);
    });

    return () => unsubscribe();
  }, [currentProject, auth.currentUser]);

  /**
   * Primary Upload Method - Uses Backend API for maximum reliability (bypasses CORS)
   */
  const uploadAsset = async (file: File, onProgress?: (progress: number) => void) => {
    if (!currentProject || !auth.currentUser) throw new Error('No project selected');

    console.log(`[useAssets] Starting robust upload for: ${file.name}`);
    const fileId = `${Date.now()}-${file.name}`;
    
    // Set initial progress
    setUploadProgress(prev => ({ ...prev, [fileId]: 1 }));
    if (onProgress) onProgress(1);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('projectId', currentProject.id);

      console.log(`[useAssets] Sending to backend: ${API_BASE}/upload`);
      
      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Backend upload failed');
      }

      const { url, fileName: storagePath } = await response.json();
      console.log(`[useAssets] ✅ Backend upload success: ${url}`);
      
      // Finalize by saving metadata to Firestore
      const asset = await finalizeAsset(file, url, storagePath);
      
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
      
      if (onProgress) onProgress(100);
      return asset;
    } catch (error: any) {
      console.error(`[useAssets] ❌ Upload failed for ${file.name}:`, error.message);
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
      throw error;
    }
  };

  const finalizeAsset = async (file: File, url: string, storagePath: string) => {
    if (!currentProject || !auth.currentUser) throw new Error('Auth required');

    const type = file.type.startsWith('image') ? 'image' : 
                 file.type.startsWith('video') ? 'video' : 
                 file.type.startsWith('audio') ? 'audio' : 'document';
    
    const assetData: any = {
      name: file.name,
      type,
      url: url,
      thumbnailUrl: url,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      isFavorited: false,
      tags: [type, 'upload'],
      metadata: {
        size: file.size,
        mimeType: file.type,
        lastModified: file.lastModified,
        storagePath: storagePath
      },
    };

    console.log('[useAssets] Saving metadata to Firestore...');
    const docRef = await addDoc(collection(db, `projects/${currentProject.id}/assets`), assetData);
    console.log('[useAssets] ✅ Metadata saved with ID:', docRef.id);
    
    return { id: docRef.id, ...assetData } as Asset;
  };

  const uploadBase64 = async (base64: string, fileName: string, type: AssetType) => {
    if (!currentProject || !auth.currentUser) throw new Error('No project selected');

    try {
      const res = await fetch(base64);
      const blob = await res.blob();
      const file = new File([blob], fileName, { type: blob.type });
      return uploadAsset(file);
    } catch (err: any) {
      console.error('[useAssets] Base64 upload failed:', err.message);
      throw err;
    }
  };

  const addAsset = async (assetData: Partial<Asset>) => {
    if (!currentProject || !auth.currentUser) throw new Error('No project selected');

    const asset: any = {
      ...assetData,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      isFavorited: false,
      tags: assetData.tags || [],
      metadata: assetData.metadata || {},
    };

    try {
      const docRef = await addDoc(collection(db, `projects/${currentProject.id}/assets`), asset);
      return { id: docRef.id, ...asset } as Asset;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `projects/${currentProject.id}/assets`);
    }
  };

  const updateAsset = async (assetId: string, updates: Partial<Asset>) => {
    if (!currentProject) return;
    const assetRef = doc(db, `projects/${currentProject.id}/assets`, assetId);
    try {
      await updateDoc(assetRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `projects/${currentProject.id}/assets/${assetId}`);
    }
  };

  const deleteAsset = async (assetId: string) => {
    if (!currentProject) return;
    try {
      await deleteDoc(doc(db, `projects/${currentProject.id}/assets`, assetId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `projects/${currentProject.id}/assets/${assetId}`);
    }
  };

  const toggleFavorite = async (assetId: string, isFavorited: boolean) => {
    await updateAsset(assetId, { isFavorited: !isFavorited });
  };

  return {
    assets,
    loading,
    uploadProgress,
    uploadAsset,
    uploadBase64,
    addAsset,
    updateAsset,
    deleteAsset,
    toggleFavorite
  };
}

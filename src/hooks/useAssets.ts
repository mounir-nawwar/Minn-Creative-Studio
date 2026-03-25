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
  serverTimestamp 
} from '../firebase';
import { Asset, AssetType } from '../types/project.types';
import { useProjectStore } from '../store/useProjectStore';

export function useAssets() {
  const { currentProject } = useProjectStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentProject || !auth.currentUser) {
      setAssets([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, `projects/${currentProject.id}/assets`),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const assetsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Asset[];
      setAssets(assetsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentProject, auth.currentUser]);

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

    const docRef = await addDoc(collection(db, `projects/${currentProject.id}/assets`), asset);
    return { id: docRef.id, ...asset } as Asset;
  };

  const updateAsset = async (assetId: string, updates: Partial<Asset>) => {
    if (!currentProject) return;
    const assetRef = doc(db, `projects/${currentProject.id}/assets`, assetId);
    await updateDoc(assetRef, updates);
  };

  const deleteAsset = async (assetId: string) => {
    if (!currentProject) return;
    await deleteDoc(doc(db, `projects/${currentProject.id}/assets`, assetId));
  };

  const toggleFavorite = async (assetId: string, isFavorited: boolean) => {
    await updateAsset(assetId, { isFavorited: !isFavorited });
  };

  return {
    assets,
    loading,
    addAsset,
    updateAsset,
    deleteAsset,
    toggleFavorite
  };
}

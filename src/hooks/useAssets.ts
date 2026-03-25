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
  storage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  handleFirestoreError,
  OperationType
} from '../firebase';
import { Asset, AssetType } from '../types/project.types';
import { useProjectStore } from '../store/useProjectStore';

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
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `projects/${currentProject.id}/assets`);
    });

    return () => unsubscribe();
  }, [currentProject, auth.currentUser]);

  const uploadAsset = async (file: File) => {
    if (!currentProject || !auth.currentUser) throw new Error('No project selected');

    const fileId = `${Date.now()}-${file.name}`;
    const storageRef = ref(storage, `projects/${currentProject.id}/assets/${fileId}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    return new Promise<Asset>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [fileId]: progress }));
        },
        (error) => {
          console.error("Upload error:", error);
          reject(error);
        },
        async () => {
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            const type = file.type.startsWith('image') ? 'image' : 
                         file.type.startsWith('video') ? 'video' : 
                         file.type.startsWith('audio') ? 'audio' : 'document';
            
            const assetData: any = {
              name: file.name,
              type,
              url: downloadURL,
              thumbnailUrl: downloadURL, // For now use same URL, maybe generate thumb later
              userId: auth.currentUser!.uid,
              createdAt: serverTimestamp(),
              isFavorited: false,
              tags: [type, 'upload'],
              metadata: {
                size: file.size,
                mimeType: file.type,
                lastModified: file.lastModified,
                storagePath: storageRef.fullPath
              },
            };

            const docRef = await addDoc(collection(db, `projects/${currentProject.id}/assets`), assetData);
            setUploadProgress(prev => {
              const next = { ...prev };
              delete next[fileId];
              return next;
            });
            resolve({ id: docRef.id, ...assetData } as Asset);
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, `projects/${currentProject.id}/assets`);
            reject(error);
          }
        }
      );
    });
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
    addAsset,
    updateAsset,
    deleteAsset,
    toggleFavorite
  };
}

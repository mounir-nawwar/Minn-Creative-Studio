import { useState, useEffect, useCallback, useRef } from 'react';
import { assetsApi, Asset as ApiAsset } from '../lib/api';
import { Asset, AssetType } from '../types/project.types';
import { useProjectStore } from '../store/useProjectStore';
import { API_BASE } from '../constants';
import { getAccessToken } from '../lib/api';

// Polling interval in milliseconds
const POLL_INTERVAL = 5000; // 5 seconds

// Convert API asset to local Asset type
function toAsset(apiAsset: ApiAsset): Asset {
  return {
    id: apiAsset.id,
    name: apiAsset.filename,
    type: apiAsset.type,
    url: apiAsset.url,
    thumbnailUrl: apiAsset.url,
    userId: apiAsset.user_id,
    projectId: apiAsset.project_id,
    workflowId: apiAsset.workflow_id,
    nodeId: apiAsset.node_id,
    createdAt: apiAsset.created_at,
    isFavorited: apiAsset.metadata?.isFavorited || false,
    tags: apiAsset.metadata?.tags || [apiAsset.type, 'upload'],
    metadata: {
      size: apiAsset.size_bytes,
      mimeType: apiAsset.mime_type,
      storagePath: apiAsset.storage_path,
      ...apiAsset.metadata
    },
  } as Asset;
}

export function useAssets() {
  const { currentProject } = useProjectStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch assets
  const fetchAssets = useCallback(async () => {
    if (!currentProject) {
      setAssets([]);
      setLoading(false);
      return;
    }

    try {
      const apiAssets = await assetsApi.list(currentProject.id);
      setAssets(apiAssets.map(toAsset));
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
      setLoading(false);
    }
  }, [currentProject?.id]);

  // Initial fetch and polling
  useEffect(() => {
    fetchAssets();
    pollingRef.current = setInterval(fetchAssets, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchAssets]);

  /**
   * Primary Upload Method - Uses Backend API for maximum reliability (bypasses CORS)
   */
  const uploadAsset = async (file: File, onProgress?: (progress: number) => void, signal?: AbortSignal) => {
    if (!currentProject) throw new Error('No project selected');

    if (process.env.NODE_ENV === 'development') {
      console.log(`[useAssets] Starting robust upload for: ${file.name}`);
    }
    const fileId = `${Date.now()}-${file.name}`;
    
    // Set initial progress
    setUploadProgress(prev => ({ ...prev, [fileId]: 1 }));
    if (onProgress) onProgress(1);

    try {
      const result = await assetsApi.upload(currentProject.id, file, {
        metadata: {
          mimeType: file.type,
          size: file.size,
          lastModified: file.lastModified
        }
      });

      console.log(`[useAssets] ✅ Upload success: ${result.url}`);
      setUploadProgress(prev => ({ ...prev, [fileId]: 95 }));
      if (onProgress) onProgress(95);
      
      // Refresh assets list
      await fetchAssets();
      
      setUploadProgress(prev => {
        const next = { ...prev };
        delete next[fileId];
        return next;
      });
      
      if (onProgress) onProgress(100);
      
      return {
        id: result.id,
        url: result.url,
        name: file.name,
        type: file.type.startsWith('image') ? 'image' : 
              file.type.startsWith('video') ? 'video' : 
              file.type.startsWith('audio') ? 'audio' : 'document',
        storagePath: result.storagePath
      };
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

  const uploadBase64 = async (base64: string, fileName: string, type: AssetType) => {
    if (!currentProject) throw new Error('No project selected');

    try {
      const result = await assetsApi.uploadBase64(currentProject.id, {
        base64,
        mimeType: type === 'image' ? 'image/png' : 
                  type === 'video' ? 'video/mp4' : 
                  type === 'audio' ? 'audio/mpeg' : 'application/octet-stream',
        filename: fileName
      });

      // Refresh assets list
      await fetchAssets();

      return {
        id: result.id,
        url: result.url,
        name: fileName,
        type,
        storagePath: result.storagePath
      };
    } catch (err: any) {
      console.error('[useAssets] Base64 upload failed:', err.message);
      throw err;
    }
  };

  const addAsset = async (assetData: Partial<Asset>): Promise<Asset> => {
    if (!currentProject) throw new Error('No project selected');

    // Note: The API handles asset creation via upload methods
    // This is a placeholder for creating asset records without file upload
    const asset: Asset = {
      id: `temp-${Date.now()}`,
      name: assetData.name || 'Untitled',
      type: assetData.type || 'document',
      url: assetData.url || '',
      thumbnailUrl: assetData.thumbnailUrl || assetData.url || '',
      userId: '',
      projectId: currentProject.id,
      createdAt: new Date().toISOString(),
      isFavorited: false,
      tags: assetData.tags || [],
      metadata: assetData.metadata || {},
    } as Asset;

    // Refresh to get the actual asset if it was created server-side
    await fetchAssets();

    return asset;
  };

  const updateAsset = async (assetId: string, updates: Partial<Asset>) => {
    if (!currentProject) return;
    
    // Note: The API would need an update endpoint for this
    // For now, we'll update locally and refresh
    setAssets(prev => prev.map(a => 
      a.id === assetId ? { ...a, ...updates } : a
    ));
    
    // Refresh to sync with server
    await fetchAssets();
  };

  const deleteAsset = async (assetId: string) => {
    if (!currentProject) return;
    
    try {
      await assetsApi.delete(assetId);
      // Refresh assets list
      await fetchAssets();
    } catch (error) {
      console.error('Failed to delete asset:', error);
      throw error;
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

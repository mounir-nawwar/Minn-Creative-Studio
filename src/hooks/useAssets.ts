import { useState, useEffect, useCallback, useRef } from 'react';
import { assetsApi, Asset as ApiAsset } from '../lib/api';
import { Asset, AssetType } from '../types/project.types';
import { useProjectStore } from '../store/useProjectStore';

// Polling interval in milliseconds
const POLL_INTERVAL = 5000; // 5 seconds
const PAGE_SIZE = 10;

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

export interface UseAssetsOptions {
  type?: string;
  search?: string;
  pageSize?: number;
}

export function useAssets(options?: UseAssetsOptions) {
  const { currentProject } = useProjectStore();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});

  const pageSize = options?.pageSize || PAGE_SIZE;
  const typeFilter = options?.type;
  const searchFilter = options?.search;

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const nextBatchRef = useRef<Asset[] | null>(null);
  const isLastBatchRef = useRef(false);
  const isPrefetchingRef = useRef(false);
  const loadMoreRequestedRef = useRef(false);
  const currentOffsetRef = useRef(0);
  const optionsRef = useRef({ typeFilter, searchFilter, projectId: currentProject?.id });

  useEffect(() => {
    optionsRef.current = { typeFilter, searchFilter, projectId: currentProject?.id };
  }, [typeFilter, searchFilter, currentProject?.id]);

  const prefetchNextBatchRef = useRef<(offset: number) => void>(() => {});

  const appendBatch = useCallback((batch: Asset[]) => {
    setAssets((prev) => [...prev, ...batch]);
    currentOffsetRef.current += batch.length;

    if (isLastBatchRef.current || batch.length < pageSize) {
      setHasMore(false);
    } else {
      setHasMore(true);
      prefetchNextBatchRef.current(currentOffsetRef.current);
    }
  }, [pageSize]);

  const prefetchNextBatch = useCallback(async (offset: number) => {
    const { projectId, typeFilter: type, searchFilter: q } = optionsRef.current;
    if (!projectId || isPrefetchingRef.current) return;

    isPrefetchingRef.current = true;
    try {
      const apiAssets = await assetsApi.list(projectId, {
        type,
        q,
        limit: pageSize,
        offset,
      });
      const batch = apiAssets.map(toAsset);
      isPrefetchingRef.current = false;
      nextBatchRef.current = batch;

      if (batch.length < pageSize) {
        isLastBatchRef.current = true;
      }

      if (loadMoreRequestedRef.current) {
        loadMoreRequestedRef.current = false;
        setLoadingMore(false);
        appendBatch(batch);
      }
    } catch (err) {
      console.error('Failed to prefetch assets:', err);
      isPrefetchingRef.current = false;
      setLoadingMore(false);
    }
  }, [pageSize, appendBatch]);

  useEffect(() => {
    prefetchNextBatchRef.current = prefetchNextBatch;
  }, [prefetchNextBatch]);

  // Initial fetch
  const fetchAssets = useCallback(async () => {
    if (!currentProject) {
      setAssets([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    setLoading(true);
    setLoadingMore(false);
    setHasMore(false);
    nextBatchRef.current = null;
    isLastBatchRef.current = false;
    isPrefetchingRef.current = false;
    loadMoreRequestedRef.current = false;
    currentOffsetRef.current = 0;

    try {
      const apiAssets = await assetsApi.list(currentProject.id, {
        type: typeFilter,
        q: searchFilter,
        limit: pageSize,
        offset: 0,
      });
      const batch1 = apiAssets.map(toAsset);
      setAssets(batch1);
      setLoading(false);
      currentOffsetRef.current = batch1.length;

      if (batch1.length < pageSize) {
        setHasMore(false);
      } else {
        setHasMore(true);
        prefetchNextBatch(pageSize);
      }
    } catch (error) {
      console.error('Failed to fetch assets:', error);
      setLoading(false);
    }
  }, [currentProject?.id, typeFilter, searchFilter, pageSize, prefetchNextBatch]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Polling to keep visible assets fresh
  useEffect(() => {
    if (!currentProject) return;

    pollingRef.current = setInterval(async () => {
      if (!currentProject?.id || loadingMore || isPrefetchingRef.current) return;
      try {
        const countToFetch = Math.max(currentOffsetRef.current, pageSize);
        const apiAssets = await assetsApi.list(currentProject.id, {
          type: typeFilter,
          q: searchFilter,
          limit: countToFetch,
          offset: 0,
        });
        const fresh = apiAssets.map(toAsset);
        setAssets(fresh);
      } catch (err) {
        // quiet on poll
      }
    }, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [currentProject?.id, typeFilter, searchFilter, pageSize, loadingMore]);

  const loadMore = useCallback(() => {
    if (!hasMore || loading || loadingMore) return;

    if (nextBatchRef.current !== null) {
      const batch = nextBatchRef.current;
      nextBatchRef.current = null;
      appendBatch(batch);
    } else {
      setLoadingMore(true);
      loadMoreRequestedRef.current = true;
    }
  }, [hasMore, loading, loadingMore, appendBatch]);

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

    await fetchAssets();

    return asset;
  };

  const updateAsset = async (assetId: string, updates: Partial<Asset>) => {
    if (!currentProject) return;
    
    setAssets(prev => prev.map(a => 
      a.id === assetId ? { ...a, ...updates } : a
    ));
    
    await fetchAssets();
  };

  const deleteAsset = async (assetId: string) => {
    if (!currentProject) return;
    
    try {
      await assetsApi.delete(assetId);
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
    loadingMore,
    hasMore,
    loadMore,
    uploadProgress,
    uploadAsset,
    uploadBase64,
    addAsset,
    updateAsset,
    deleteAsset,
    toggleFavorite
  };
}
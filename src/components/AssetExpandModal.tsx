import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import AssetPreviewModal from './AssetPreviewModal';
import { Asset } from '../types/project.types';
import { assetsApi } from '../lib/api';
import { toast } from '../store/useToastStore';

/**
 * Global asset expansion modal — rendered once at root level.
 * All callers of setExpandedAsset pass a URL, type, and optional playlist.
 * Resolves the real DB record by URL so "Delete permanently" works.
 */
export const AssetExpandModal = () => {
  const expandedAsset = useStore((state) => state.expandedAsset);
  const setExpandedAsset = useStore((state) => state.setExpandedAsset);
  const [resolvedAsset, setResolvedAsset] = useState<Asset | null>(null);

  useEffect(() => {
    setResolvedAsset(null);
    if (!expandedAsset) return;
    let cancelled = false;
    assetsApi.findByUrl(expandedAsset.url).then((found) => {
      if (!cancelled && found) {
        setResolvedAsset({
          id: found.id,
          name: found.filename,
          type: found.type,
          url: found.url,
          thumbnailUrl: found.url,
          userId: found.user_id,
          projectId: found.project_id,
          workflowId: found.workflow_id,
          nodeId: found.node_id,
          createdAt: found.created_at,
          isFavorited: found.metadata?.isFavorited || false,
          tags: found.metadata?.tags || [],
          metadata: found.metadata || {},
        } as Asset);
      }
    });
    return () => { cancelled = true; };
  }, [expandedAsset?.url]);

  if (!expandedAsset) return null;

  const playlist = expandedAsset.playlist || [];
  const currentIndex = playlist.findIndex((item) => item.url === expandedAsset.url);

  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < playlist.length - 1;

  const handlePrev = () => {
    if (hasPrev) {
      const prevItem = playlist[currentIndex - 1];
      setExpandedAsset(prevItem.url, prevItem.type, playlist);
    }
  };

  const handleNext = () => {
    if (hasNext) {
      const nextItem = playlist[currentIndex + 1];
      setExpandedAsset(nextItem.url, nextItem.type, playlist);
    }
  };

  const activePlaylistItem = currentIndex >= 0 ? playlist[currentIndex] : null;

  const asset: Asset = resolvedAsset || {
    id: 'expanded',
    name: activePlaylistItem?.name || 'Expanded Asset',
    type: expandedAsset.type,
    url: expandedAsset.url,
    thumbnailUrl: expandedAsset.url,
    createdAt: new Date().toISOString(),
    isFavorited: false,
    metadata: {},
    tags: [],
  } as Asset;

  const handleDelete = async () => {
    if (!resolvedAsset?.id) {
      toast.error("Can't delete", "This preview isn't a saved asset yet");
      return;
    }
    try {
      await assetsApi.delete(resolvedAsset.id);
      toast.success('Asset deleted', 'The file was removed');
      if (hasNext) {
        handleNext();
      } else if (hasPrev) {
        handlePrev();
      } else {
        setExpandedAsset(null);
      }
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete asset');
    }
  };

  return (
    <AssetPreviewModal
      asset={asset}
      onClose={() => setExpandedAsset(null)}
      onDelete={handleDelete}
      onToggleFavorite={() => {}}
      onPrev={hasPrev ? handlePrev : undefined}
      onNext={hasNext ? handleNext : undefined}
      currentIndex={currentIndex >= 0 ? currentIndex : undefined}
      totalCount={playlist.length > 0 ? playlist.length : undefined}
    />
  );
};

export default AssetExpandModal;
import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';
import AssetPreviewModal from './AssetPreviewModal';
import { Asset } from '../types/project.types';
import { assetsApi } from '../lib/api';
import { toast } from '../store/useToastStore';

/**
 * Global asset expansion modal — rendered once at root level.
 * All ~28 callers of setExpandedAsset (canvas node outputs, chat media,
 * Library, etc.) only know a URL, not a real asset id, so on open we resolve
 * the real record by URL — that's what makes "Delete permanently" work here.
 */
export const AssetExpandModal = () => {
  const expandedAsset = useStore((state) => state.expandedAsset);
  const setExpandedAsset = useStore((state) => state.setExpandedAsset);
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    setResolvedId(null);
    if (!expandedAsset) return;
    let cancelled = false;
    assetsApi.findByUrl(expandedAsset.url).then((found) => {
      if (!cancelled) setResolvedId(found?.id ?? null);
    });
    return () => { cancelled = true; };
  }, [expandedAsset?.url]);

  const asset: Asset | null = expandedAsset
    ? {
        id: resolvedId ?? 'expanded',
        name: 'Expanded Asset',
        type: expandedAsset.type,
        url: expandedAsset.url,
        thumbnailUrl: expandedAsset.url,
        createdAt: new Date().toISOString(),
        isFavorited: false,
        metadata: {},
        tags: [],
      }
    : null;

  const handleDelete = async () => {
    if (!resolvedId) {
      toast.error("Can't delete", "This preview isn't a saved asset yet");
      return;
    }
    try {
      await assetsApi.delete(resolvedId);
      toast.success('Asset deleted', 'The file was removed');
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
    />
  );
};

export default AssetExpandModal;

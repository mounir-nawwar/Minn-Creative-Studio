import { useStore } from '../store/useStore';
import AssetPreviewModal from './AssetPreviewModal';
import { Asset } from '../types/project.types';

/**
 * Global asset expansion modal — rendered once at root level.
 * All nodes use this single instance via the global store.
 */
export const AssetExpandModal = () => {
  const expandedAsset = useStore((state) => state.expandedAsset);
  const setExpandedAsset = useStore((state) => state.setExpandedAsset);

  const asset: Asset | null = expandedAsset
    ? {
        id: 'expanded',
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

  return (
    <AssetPreviewModal
      asset={asset}
      onClose={() => setExpandedAsset(null)}
      onDelete={() => {}}
      onToggleFavorite={() => {}}
    />
  );
};

export default AssetExpandModal;

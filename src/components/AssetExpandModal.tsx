import React from 'react';
import { useStore } from '../store/useStore';
import AssetPreviewModal from './AssetPreviewModal';
import { Asset } from '../types/project.types';
import { Timestamp } from 'firebase/firestore';

/**
 * Global asset expansion modal - rendered once at root level
 * All nodes use this single modal instance via global store
 */
export const AssetExpandModal = () => {
  const expandedAsset = useStore((state) => state.expandedAsset);
  const setExpandedAsset = useStore((state) => state.setExpandedAsset);
  
  if (!expandedAsset) return null;

  const asset: Asset = {
    id: 'expanded',
    name: 'Expanded Asset',
    type: expandedAsset.type,
    url: expandedAsset.url,
    thumbnailUrl: expandedAsset.url,
    createdAt: Timestamp.now(),
    isFavorited: false,
    metadata: {},
    tags: [],
  };

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

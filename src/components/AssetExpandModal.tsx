import React from 'react';
import { useStore } from '../store/useStore';
import AssetPreviewModal from './AssetPreviewModal';
import { Asset } from '../types/project.types';

/**
 * Global asset expansion modal - rendered once at root level
 * All nodes use this single modal instance via global store
 */
export const AssetExpandModal = () => {
  const expandedAsset = useStore((state) => state.expandedAsset);
  const setExpandedAsset = useStore((state) => state.setExpandedAsset);
  
  if (!expandedAsset) return null;

  // Convert expandedAsset to Asset format
  const asset: Asset = {
    id: 'expanded',
    name: 'Expanded Asset',
    type: expandedAsset.type,
    url: expandedAsset.url,
    thumbnailUrl: expandedAsset.url,
    createdAt: new Date(),
    createdBy: 'system',
    isFavorited: false,
    metadata: {},
    tags: [],
    nodeId: undefined,
    workflowId: undefined
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

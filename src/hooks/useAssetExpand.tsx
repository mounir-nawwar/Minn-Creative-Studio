import { useStore } from '../store/useStore';
import { AssetType } from '../types/project.types';

/**
 * Hook for managing asset expansion across all nodes
 * Triggers global modal - modal itself rendered at root level
 */
export const useAssetExpand = () => {
  const setExpandedAsset = useStore((state) => state.setExpandedAsset);

  return {
    setExpandedAsset
  };
};

export default useAssetExpand;

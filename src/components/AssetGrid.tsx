import { useState, useRef, useEffect } from 'react';
import { useAssets } from '../hooks/useAssets';
import {
  Image as ImageIcon, Video as VideoIcon, Music as AudioIcon, FileText as DocIcon,
  Search, Filter, Heart, ExternalLink, Trash2, Plus, Upload, Play,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Asset, AssetType } from '../types/project.types';
import { useStore } from '../store/useStore';
import DeleteAssetModal from './DeleteAssetModal';
import { RETENTION_DAYS } from '../constants';

interface AssetGridProps {
  onAssetClick?: (asset: Asset) => void;
  isPicker?: boolean;
}

const FILTERS: (AssetType | 'all')[] = ['all', 'image', 'video', 'audio', 'reference'];
const SEARCH_DEBOUNCE_MS = 300;

export default function AssetGrid({ onAssetClick, isPicker = false }: AssetGridProps) {
  const [filter, setFilter] = useState<AssetType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const {
    assets,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    deleteAsset,
    toggleFavorite,
    uploadAsset,
    uploadProgress
  } = useAssets({
    type: filter === 'all' ? undefined : filter,
    search: debouncedSearch,
  });

  const setPendingNodeType = useStore((state) => state.setPendingNodeType);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      try {
        await uploadAsset(file);
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  };

  const getIcon = (type: AssetType) => {
    switch (type) {
      case 'image': return ImageIcon;
      case 'video': return VideoIcon;
      case 'audio': return AudioIcon;
      case 'document': return DocIcon;
      default: return ExternalLink;
    }
  };

  const handleAddToCanvas = (asset: Asset) => {
    const type = asset.type === 'video' ? 'videoUpload' : 'imageUpload';
    setPendingNodeType(type, { type, label: asset.name, output: asset.url, config: { ...asset.metadata, url: asset.url } });
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#0097A7]/20 border-t-[#0097A7]" />
      </div>
    );
  }

  return (
    <div
      className={`flex flex-1 flex-col overflow-hidden transition-colors duration-150 ${isDragging ? 'bg-[#0097A7]/10' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
    >
      {/* Controls */}
      <div className={`space-y-2 border-b border-white/5 ${isPicker ? 'p-2' : 'p-3'}`}>
        {!isPicker && (
          <>
            <input type="file" ref={fileInputRef} onChange={(e) => handleFiles(e.target.files)} className="hidden" multiple accept="image/*,video/*,audio/*" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0097A7] text-[13px] font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.98]"
            >
              <Upload className="h-4 w-4" />
              Upload asset
            </button>

            <AnimatePresence initial={false}>
              {Object.entries(uploadProgress).map(([fileId, progress]) => (
                <motion.div
                  key={fileId}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                  className="space-y-1.5 rounded-lg bg-black/40 p-2 ring-1 ring-white/10"
                >
                  <div className="flex justify-between text-[11px]">
                    <span className="max-w-[150px] truncate text-gray-400">{fileId.split('-').slice(1).join('-')}</span>
                    <span className="tabular-nums text-[#0097A7]">{Math.round(progress as number)}%</span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-white/5">
                    <motion.div className="h-full bg-[#0097A7]" initial={{ width: 0 }} animate={{ width: `${progress as number}%` }} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </>
        )}

        <div className="relative">
          <Search className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-gray-500 ${isPicker ? 'left-2.5 h-3 w-3' : 'left-3 h-3.5 w-3.5'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets"
            className={`w-full rounded-lg bg-white/[0.04] text-white placeholder:text-gray-600 ring-1 ring-white/10 transition-shadow duration-150 focus:outline-none focus:ring-[1.5px] focus:ring-[#0097A7]/60 ${isPicker ? 'py-1.5 pl-7 pr-3 text-[12px]' : 'py-2 pl-9 pr-3 text-[13px]'}`}
          />
        </div>

        <div className={`flex gap-1.5 ${isPicker ? 'scrollbar-none overflow-x-auto pb-0.5' : 'flex-wrap'}`}>
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ring-1 transition-[transform,color,background-color,box-shadow] duration-150 active:scale-[0.96] ${
                filter === f ? 'bg-[#0097A7] text-white ring-[#0097A7]' : 'bg-white/[0.03] text-gray-400 ring-white/10 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className={`custom-scrollbar flex-1 overflow-y-auto ${isPicker ? 'p-2' : 'p-3'}`}>
        {assets.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/10">
              <Filter className="h-5 w-5 text-gray-600" />
            </div>
            <p className="text-xs text-gray-500">No assets found</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className={`grid grid-cols-2 ${isPicker ? 'gap-2' : 'gap-3'}`}>
              {assets.map((asset) => {
                const Icon = getIcon(asset.type);
                return (
                  <div
                    key={asset.id}
                    onClick={() => onAssetClick?.(asset)}
                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-xl bg-[#111111] ring-1 ring-white/10 transition-[transform,box-shadow] duration-150 hover:ring-[#0097A7]/40 active:scale-[0.98]"
                  >
                    {asset.type === 'video' ? (
                      <div className="relative h-full w-full">
                        <video src={asset.url + '#t=0.1'} className="h-full w-full object-cover opacity-70 transition-opacity duration-150 group-hover:opacity-100" preload="metadata" />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 ring-1 ring-white/20 backdrop-blur-md transition-colors duration-150 group-hover:bg-[#0097A7]/50">
                            <Play className="h-3 w-3 fill-white text-white" />
                          </div>
                        </div>
                      </div>
                    ) : asset.type === 'image' ? (
                      <img src={asset.thumbnailUrl || asset.url} alt={asset.name} className="h-full w-full object-cover opacity-80 transition-opacity duration-150 group-hover:opacity-100" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Icon className="h-8 w-8 text-gray-700 transition-colors group-hover:text-[#0097A7]" />
                      </div>
                    )}

                    <span className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/[0.06]" />

                    <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-transparent p-2.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.id, asset.isFavorited); }}
                          className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ring-1 ring-white/10 backdrop-blur-md transition-[transform,color,background-color] duration-150 active:scale-[0.96] ${asset.isFavorited ? 'bg-red-500 text-white' : 'bg-black/40 text-gray-300 hover:text-white'}`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${asset.isFavorited ? 'fill-current' : ''}`} />
                        </button>
                        {!isPicker && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleAddToCanvas(asset); }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-gray-300 ring-1 ring-white/10 backdrop-blur-md transition-[transform,color] duration-150 hover:text-white active:scale-[0.96]"
                            title="Add to canvas"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="space-y-1">
                        <p className="truncate text-[12px] font-medium text-white">{asset.name}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] capitalize text-gray-400">{asset.type}</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); setAssetToDelete(asset); }}
                            className="p-0.5 text-gray-400 transition-colors hover:text-red-400"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {hasMore && (
              <div className="mt-4 flex justify-center pb-2">
                <button
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-white/[0.04] px-4 py-2 text-[12px] font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,background-color,color] duration-150 hover:bg-white/[0.08] hover:text-white active:scale-[0.96] disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0097A7]/20 border-t-[#0097A7]" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    <span>Load More</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <DeleteAssetModal
        asset={assetToDelete}
        isOpen={!!assetToDelete}
        onClose={() => setAssetToDelete(null)}
        onConfirm={() => {
          if (assetToDelete) {
            deleteAsset(assetToDelete.id);
            setAssetToDelete(null);
          }
        }}
        retentionDays={RETENTION_DAYS}
      />
    </div>
  );
}
import React, { useState } from 'react';
import { useAssets } from '../hooks/useAssets';
import { 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Music as AudioIcon, 
  FileText as DocIcon, 
  Search, 
  Filter, 
  Heart, 
  Download, 
  ExternalLink,
  Trash2,
  Maximize2,
  Upload,
  Plus,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Asset, AssetType } from '../types/project.types';
import { useStore } from '../store/useStore';
import { useReactFlow } from 'reactflow';
import { useRef } from 'react';
import DeleteAssetModal from './DeleteAssetModal';
import { RETENTION_DAYS } from '../constants';

interface AssetGridProps {
  onAssetClick?: (asset: Asset) => void;
  isPicker?: boolean;
}

export default function AssetGrid({ onAssetClick, isPicker = false }: AssetGridProps) {
  const { assets, loading, deleteAsset, toggleFavorite, uploadAsset, uploadProgress } = useAssets();
  const setPendingNodeType = useStore((state) => state.setPendingNodeType);
  const { project, getViewport } = useReactFlow();
  const [filter, setFilter] = useState<AssetType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files) return;
    const fileArray = Array.from(files);
    
    for (const file of fileArray) {
      try {
        await uploadAsset(file);
      } catch (err) {
        console.error(`Failed to upload ${file.name}:`, err);
      }
    }

    // Reset input value to allow re-uploading same file
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFiles(e.dataTransfer.files);
  };

  const filteredAssets = assets.filter(a => {
    const matchesFilter = filter === 'all' || a.type === filter;
    const matchesSearch = a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         a.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

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
    
    setPendingNodeType(type, { 
      type,
      label: asset.name,
      output: asset.url,
      config: {
        ...asset.metadata,
        url: asset.url
      }
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#0097A7] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className={`flex-1 flex flex-col overflow-hidden transition-all ${isDragging ? 'bg-[#0097A7]/10' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Filters & Search */}
      <div className={`border-b border-white/5 space-y-2 ${isPicker ? 'p-2' : 'p-4 space-y-4'}`}>
        {!isPicker && (
          <div className="flex flex-col gap-3">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
              multiple
              accept="image/*,video/*,audio/*"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-3 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-[0_0_15px_rgba(0,151,167,0.2)]"
            >
              <Upload className="w-4 h-4" />
              Upload Asset
            </button>

            {/* Upload Progress */}
            <AnimatePresence>
              {Object.entries(uploadProgress).map(([fileId, progress]) => (
                <motion.div
                  key={fileId}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-black/40 border border-white/5 rounded-lg p-2 space-y-1.5"
                >
                  <div className="flex justify-between text-[8px] font-bold uppercase tracking-widest">
                    <span className="text-gray-400 truncate max-w-[150px]">{fileId.split('-').slice(1).join('-')}</span>
                    <span className="text-[#0097A7]">{Math.round(progress as number)}%</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-[#0097A7]"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress as number}%` }}
                    />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <div className="relative group">
          <Search className={`absolute top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-[#0097A7] transition-colors ${isPicker ? 'left-2 w-3 h-3' : 'left-3 w-3.5 h-3.5'}`} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search assets..."
            className={`w-full bg-black/60 border border-white/5 rounded-lg text-white focus:outline-none focus:border-[#0097A7]/50 transition-all ${isPicker ? 'py-1.5 pl-7 pr-3 text-[10px]' : 'py-2.5 pl-10 pr-4 text-[11px] font-bold rounded-xl border'}`}
          />
        </div>

        <div className={`flex gap-1.5 ${isPicker ? 'overflow-x-auto pb-0.5 scrollbar-none' : 'flex-wrap gap-2'}`}>
          {['all', 'image', 'video', 'audio', 'reference'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`shrink-0 uppercase tracking-widest font-black transition-all border ${
                isPicker
                  ? `px-2 py-1 rounded-md text-[8px] ${filter === f ? 'bg-[#0097A7] text-white border-[#0097A7]' : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/10'}`
                  : `px-3 py-1.5 rounded-lg text-[9px] ${filter === f ? 'bg-[#0097A7] text-white border-[#0097A7]' : 'bg-white/5 text-gray-500 border-white/5 hover:border-white/10'}`
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className={`flex-1 overflow-y-auto custom-scrollbar ${isPicker ? 'p-2' : 'p-4'}`}>
        {filteredAssets.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
              <Filter className="w-6 h-6 text-gray-700" />
            </div>
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">No assets found</p>
          </div>
        ) : (
          <div className={`grid grid-cols-2 ${isPicker ? 'gap-2' : 'gap-4'}`}>
            {filteredAssets.map((asset) => {
              const Icon = getIcon(asset.type);
              return (
                <motion.div
                  layout
                  key={asset.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`group relative aspect-square bg-[#111111] border border-white/5 overflow-hidden cursor-pointer hover:border-[#0097A7]/50 transition-all ${isPicker ? 'rounded-xl' : 'rounded-2xl'}`}
                  onClick={() => onAssetClick?.(asset)}
                >
                  {asset.type === 'video' ? (
                    <div className="w-full h-full relative">
                      <video 
                        src={asset.url + "#t=0.1"} 
                        className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" 
                        preload="metadata"
                      />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-8 h-8 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center border border-white/30 group-hover:scale-110 group-hover:bg-[#0097A7]/40 transition-all">
                          <Play className="w-3 h-3 text-white fill-white" />
                        </div>
                      </div>
                    </div>
                  ) : asset.type === 'image' ? (
                    <img 
                      src={asset.thumbnailUrl || asset.url} 
                      alt={asset.name} 
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon className="w-8 h-8 text-gray-700 group-hover:text-[#0097A7] transition-colors" />
                    </div>
                  )}

                  {/* Overlay Controls */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-3 flex flex-col justify-between">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(asset.id, asset.isFavorited);
                        }}
                        className={`p-1.5 rounded-lg backdrop-blur-md border border-white/10 transition-all ${asset.isFavorited ? 'bg-red-500 text-white' : 'bg-black/40 text-gray-400 hover:text-white'}`}
                      >
                        <Heart className={`w-3.5 h-3.5 ${asset.isFavorited ? 'fill-current' : ''}`} />
                      </button>
                      {!isPicker && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCanvas(asset);
                          }}
                          className="p-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg text-gray-400 hover:text-white transition-all"
                          title="Add to Canvas"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-white uppercase tracking-tighter truncate">{asset.name}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">{asset.type}</span>
                        <div className="flex gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setAssetToDelete(asset);
                            }}
                            className="p-1 text-gray-500 hover:text-red-500 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Delete Confirmation Modal */}
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

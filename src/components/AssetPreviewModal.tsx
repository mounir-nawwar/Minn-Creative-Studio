import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, Share2, Heart, Trash2, ExternalLink, Info, Calendar, User, Box, Sparkles } from 'lucide-react';
import { Asset } from '../types/project.types';

interface AssetPreviewModalProps {
  asset: Asset | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, isFavorited: boolean) => void;
}

export default function AssetPreviewModal({ asset, onClose, onDelete, onToggleFavorite }: AssetPreviewModalProps) {
  if (!asset) return null;

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Just now';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-12">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-2xl"
      />

      {/* Modal Container */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="relative w-full max-w-6xl h-full bg-[#0a0a0a] border border-white/10 rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex"
      >
        {/* Main Preview Area */}
        <div className="flex-1 bg-black flex items-center justify-center p-12 relative overflow-hidden">
          {asset.type === 'image' ? (
            <img 
              src={asset.url} 
              alt={asset.name} 
              className="max-w-full max-h-full object-contain shadow-2xl rounded-2xl"
            />
          ) : asset.type === 'video' ? (
            <video 
              src={asset.url} 
              controls 
              className="max-w-full max-h-full rounded-2xl shadow-2xl"
            />
          ) : (
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="w-32 h-32 bg-[#111111] rounded-[40px] flex items-center justify-center border border-white/5">
                <Box className="w-12 h-12 text-gray-700" />
              </div>
              <p className="text-lg font-black text-white uppercase tracking-widest">Preview not available for this type</p>
              <a 
                href={asset.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="px-8 py-3 bg-[#0097A7] text-white rounded-2xl font-black uppercase text-[11px] tracking-widest hover:scale-105 transition-all"
              >
                Open in New Tab
              </a>
            </div>
          )}

          {/* Close Button */}
          <button 
            onClick={onClose}
            className="absolute top-8 left-8 p-3 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-gray-500 hover:text-white transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Sidebar Info Area */}
        <div className="w-[400px] border-l border-white/5 bg-[#0d0d0d] flex flex-col">
          {/* Header */}
          <div className="p-8 border-b border-white/5 space-y-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-[#0097A7]/20 text-[#0097A7] rounded-full text-[9px] font-black uppercase tracking-widest">
                {asset.type}
              </span>
              {asset.isFavorited && (
                <span className="px-3 py-1 bg-red-500/20 text-red-500 rounded-full text-[9px] font-black uppercase tracking-widest">
                  Favorite
                </span>
              )}
            </div>
            <h2 className="text-2xl font-black text-white tracking-tighter uppercase">{asset.name}</h2>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => onToggleFavorite(asset.id, asset.isFavorited)}
                className={`flex items-center justify-center gap-3 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all border ${
                  asset.isFavorited 
                  ? 'bg-red-500 border-red-500 text-white' 
                  : 'bg-white/5 border-white/5 text-gray-400 hover:text-white'
                }`}
              >
                <Heart className={`w-4 h-4 ${asset.isFavorited ? 'fill-current' : ''}`} />
                {asset.isFavorited ? 'Favorited' : 'Favorite'}
              </button>
              <a 
                href={asset.url} 
                download={asset.name}
                className="flex items-center justify-center gap-3 py-4 bg-white text-black rounded-2xl font-black uppercase text-[10px] tracking-widest hover:scale-[1.02] transition-all"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>

            {/* Metadata Section */}
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-gray-500">
                <Info className="w-4 h-4 text-[#0097A7]" />
                <h3 className="text-[10px] font-black uppercase tracking-widest">Asset Metadata</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-white/5">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-3.5 h-3.5 text-gray-700" />
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Created</span>
                  </div>
                  <span className="text-[10px] font-black text-white uppercase">{formatDate(asset.createdAt)}</span>
                </div>

                {asset.metadata.model && (
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <Sparkles className="w-3.5 h-3.5 text-gray-700" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Model</span>
                    </div>
                    <span className="text-[10px] font-black text-[#0097A7] uppercase">{asset.metadata.model}</span>
                  </div>
                )}

                {asset.metadata.width && asset.metadata.height && (
                  <div className="flex items-center justify-between py-3 border-b border-white/5">
                    <div className="flex items-center gap-3">
                      <Box className="w-3.5 h-3.5 text-gray-700" />
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Resolution</span>
                    </div>
                    <span className="text-[10px] font-black text-white uppercase">{asset.metadata.width} x {asset.metadata.height}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Prompt Section */}
            {asset.metadata.prompt && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-gray-500">
                  <Sparkles className="w-4 h-4 text-[#0097A7]" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest">Generation Prompt</h3>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl">
                  <p className="text-xs text-gray-400 leading-relaxed italic">"{asset.metadata.prompt}"</p>
                </div>
              </div>
            )}

            {/* Tags Section */}
            {asset.tags.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-gray-500">
                  <Box className="w-4 h-4 text-[#0097A7]" />
                  <h3 className="text-[10px] font-black uppercase tracking-widest">Tags</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {asset.tags.map(tag => (
                    <span key={tag} className="px-3 py-1 bg-[#0097A7]/10 text-[#0097A7] rounded-lg text-[9px] font-black uppercase tracking-widest">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-8 border-t border-white/5 bg-[#111111]">
            <button 
              onClick={() => {
                onDelete(asset.id);
                onClose();
              }}
              className="w-full flex items-center justify-center gap-3 py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete Asset Permanently
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

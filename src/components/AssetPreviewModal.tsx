import * as Dialog from '@radix-ui/react-dialog';
import { X, Download, Heart, Trash2, Info, Calendar, Box, Sparkles } from 'lucide-react';
import { Asset } from '../types/project.types';
import { downloadFile } from '../lib/utils';

interface AssetPreviewModalProps {
  asset: Asset | null;
  onClose: () => void;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string, isFavorited: boolean) => void;
}

function formatDate(timestamp: unknown): string {
  if (!timestamp) return 'Just now';
  const date = new Date(timestamp as string | number | Date);
  if (Number.isNaN(date.getTime())) return 'Just now';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function MetaRow({ icon: Icon, label, value, accent }: { icon: typeof Box; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-white/5 py-2.5">
      <span className="flex items-center gap-2.5 text-xs text-gray-500">
        <Icon className="h-3.5 w-3.5 text-gray-600" />
        {label}
      </span>
      <span className={`text-xs font-medium ${accent ? 'text-[#0097A7]' : 'text-white'}`}>{value}</span>
    </div>
  );
}

export default function AssetPreviewModal({ asset, onClose, onDelete, onToggleFavorite }: AssetPreviewModalProps) {
  return (
    <Dialog.Root open={!!asset} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/85 backdrop-blur-md data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[100] flex h-[86vh] w-[92vw] max-w-6xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-[#0a0a0a] ring-1 ring-white/10 shadow-[0_24px_100px_rgba(0,0,0,0.8)] focus:outline-none data-[state=open]:[animation:overlayIn_180ms_ease-out]"
        >
          {asset && (
            <>
              {/* Preview */}
              <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black p-10">
                {asset.type === 'image' ? (
                  <img src={asset.url} alt={asset.name} className="max-h-full max-w-full rounded-xl object-contain ring-1 ring-inset ring-white/10" />
                ) : asset.type === 'video' ? (
                  <video src={asset.url} controls className="max-h-full max-w-full rounded-xl ring-1 ring-inset ring-white/10" />
                ) : (
                  <div className="flex flex-col items-center gap-5 text-center">
                    <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-[#111111] ring-1 ring-white/10">
                      <Box className="h-10 w-10 text-gray-700" />
                    </div>
                    <p className="text-sm text-gray-400">Preview not available for this type</p>
                    <a
                      href={asset.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-9 items-center rounded-lg bg-[#0097A7] px-4 text-sm font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96]"
                    >
                      Open in new tab
                    </a>
                  </div>
                )}

                <Dialog.Close asChild>
                  <button
                    aria-label="Close"
                    className="absolute left-6 top-6 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-gray-300 ring-1 ring-white/10 backdrop-blur-md transition-[transform,color] duration-150 hover:text-white active:scale-[0.96]"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </Dialog.Close>
              </div>

              {/* Sidebar */}
              <div className="flex w-[380px] flex-col border-l border-white/5 bg-[#0d0d0d]">
                <div className="space-y-3 border-b border-white/5 p-6">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-[#0097A7]/15 px-2.5 py-1 text-[11px] font-medium capitalize text-[#0097A7]">{asset.type}</span>
                    {asset.isFavorited && (
                      <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-medium text-red-400">Favorite</span>
                    )}
                  </div>
                  <Dialog.Title className="text-xl font-semibold tracking-tight text-white" style={{ textWrap: 'balance' }}>
                    {asset.name}
                  </Dialog.Title>
                </div>

                <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto p-6">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      onClick={() => onToggleFavorite(asset.id, asset.isFavorited)}
                      className={`inline-flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-medium ring-1 transition-[transform,color,background-color] duration-150 active:scale-[0.96] ${
                        asset.isFavorited ? 'bg-red-500 text-white ring-red-500' : 'bg-white/[0.04] text-gray-300 ring-white/10 hover:text-white'
                      }`}
                    >
                      <Heart className={`h-4 w-4 ${asset.isFavorited ? 'fill-current' : ''}`} />
                      {asset.isFavorited ? 'Favorited' : 'Favorite'}
                    </button>
                    <button
                      onClick={() => downloadFile(asset.url, asset.name)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-white text-sm font-medium text-black transition-transform duration-150 hover:bg-white/90 active:scale-[0.96]"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="mb-2 flex items-center gap-2 text-gray-400">
                      <Info className="h-3.5 w-3.5 text-[#0097A7]" />
                      <h3 className="text-[11px] font-medium uppercase tracking-wide">Metadata</h3>
                    </div>
                    <MetaRow icon={Calendar} label="Created" value={formatDate(asset.createdAt)} />
                    {asset.metadata.model && <MetaRow icon={Sparkles} label="Model" value={String(asset.metadata.model)} accent />}
                    {asset.metadata.width && asset.metadata.height && (
                      <MetaRow icon={Box} label="Resolution" value={`${asset.metadata.width} × ${asset.metadata.height}`} />
                    )}
                  </div>

                  {asset.metadata.prompt && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Sparkles className="h-3.5 w-3.5 text-[#0097A7]" />
                        <h3 className="text-[11px] font-medium uppercase tracking-wide">Prompt</h3>
                      </div>
                      <div className="rounded-xl bg-white/[0.04] p-3.5 ring-1 ring-white/10">
                        <p className="text-xs leading-relaxed text-gray-400">{String(asset.metadata.prompt)}</p>
                      </div>
                    </div>
                  )}

                  {asset.tags.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Box className="h-3.5 w-3.5 text-[#0097A7]" />
                        <h3 className="text-[11px] font-medium uppercase tracking-wide">Tags</h3>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {asset.tags.map((tag) => (
                          <span key={tag} className="rounded-md bg-[#0097A7]/10 px-2 py-1 text-[11px] text-[#0097A7]">{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-white/5 p-4">
                  <button
                    onClick={() => { onDelete(asset.id); onClose(); }}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-red-500/10 text-sm font-medium text-red-400 ring-1 ring-red-500/20 transition-[transform,background-color] duration-150 hover:bg-red-500/15 active:scale-[0.98]"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete permanently
                  </button>
                </div>
              </div>
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

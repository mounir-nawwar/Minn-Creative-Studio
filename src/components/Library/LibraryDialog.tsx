import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Library, X, FolderInput, Trash2 } from 'lucide-react';
import LibraryGrid from './LibraryGrid';
import type { LibraryAsset } from './LibraryGrid';
import MoveToProjectDialog from './MoveToProjectDialog';
import { assetsApi, LibraryFilters } from '../../lib/api';
import { toast } from '../../store/useToastStore';

interface LibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialFilters?: LibraryFilters;
}

/** Full-screen global asset library, opened from the picker header or the toolbar */
export default function LibraryDialog({ open, onOpenChange, initialFilters }: LibraryDialogProps) {
  const [moveTarget, setMoveTarget] = useState<{ asset: LibraryAsset; refresh: () => void } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ asset: LibraryAsset; refresh: () => void } | null>(null);

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] flex h-[85vh] w-[92vw] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-[#0b0b0b] ring-1 ring-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:dialogIn_180ms_ease-out]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Library className="h-4 w-4 text-[#0097A7]" />
                <div>
                  <Dialog.Title className="text-[14px] font-semibold leading-none text-white">Library</Dialog.Title>
                  <Dialog.Description className="mt-1 text-[11px] leading-none text-gray-500">
                    Every asset across all projects and the playground
                  </Dialog.Description>
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-[transform,color,background-color] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.96]"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>
            {open && (
              <LibraryGrid
                initialFilters={initialFilters}
                renderCardActions={(asset, refresh) => (
                  <>
                    <button
                      onClick={(e) => { e.stopPropagation(); setMoveTarget({ asset, refresh }); }}
                      title="Move to project"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-gray-300 ring-1 ring-white/10 backdrop-blur-md transition-[transform,color,background-color] duration-150 hover:bg-[#0097A7]/50 hover:text-white active:scale-[0.96]"
                    >
                      <FolderInput className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget({ asset, refresh }); }}
                      title="Delete permanently"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-gray-300 ring-1 ring-white/10 backdrop-blur-md transition-[transform,color,background-color] duration-150 hover:bg-red-500/70 hover:text-white active:scale-[0.96]"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              />
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <MoveToProjectDialog
        open={!!moveTarget}
        onOpenChange={(o) => { if (!o) setMoveTarget(null); }}
        subject={moveTarget?.asset.filename ?? ''}
        excludeProjectId={moveTarget?.asset.project_id}
        onConfirm={async (targetProjectId) => {
          if (!moveTarget) return;
          try {
            await assetsApi.move(moveTarget.asset.id, targetProjectId);
            toast.success('Asset moved', `${moveTarget.asset.filename} now lives in its new project`);
            moveTarget.refresh();
          } catch (err) {
            toast.error('Move failed', err instanceof Error ? err.message : 'Could not move asset');
          }
        }}
      />

      <AlertDialog.Root open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[120] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#0b0b0b] p-6 ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:dialogIn_180ms_ease-out]">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-500/12 ring-1 ring-inset ring-red-500/25">
                <Trash2 className="h-5 w-5 text-red-400" />
              </div>
              <div className="min-w-0 flex-1">
                <AlertDialog.Title className="text-base font-semibold text-white">Delete permanently?</AlertDialog.Title>
                <AlertDialog.Description className="mt-1 text-sm leading-relaxed text-gray-400">
                  <span className="font-medium text-gray-200">{deleteTarget?.asset.filename}</span> will be removed
                  from storage for good — this can't be undone.
                </AlertDialog.Description>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,color,background-color,box-shadow] duration-150 hover:bg-white/5 hover:text-white hover:ring-white/20 active:scale-[0.96]">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={async () => {
                    if (!deleteTarget) return;
                    try {
                      await assetsApi.delete(deleteTarget.asset.id);
                      toast.success('Asset deleted', `${deleteTarget.asset.filename} was removed`);
                      deleteTarget.refresh();
                    } catch (err) {
                      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete asset');
                    }
                  }}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-red-500/90 px-4 text-sm font-medium text-white transition-[transform,background-color] duration-150 hover:bg-red-500 active:scale-[0.96]"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete permanently
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

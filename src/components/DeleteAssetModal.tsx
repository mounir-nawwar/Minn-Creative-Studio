import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { Archive, Trash2 } from 'lucide-react';
import { Asset } from '../types/project.types';

interface DeleteAssetModalProps {
  asset: Asset | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  retentionDays: number;
}

export default function DeleteAssetModal({ asset, isOpen, onClose, onConfirm, retentionDays }: DeleteAssetModalProps) {
  return (
    <AlertDialog.Root open={isOpen && !!asset} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-[110] bg-black/70 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[110] w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#0b0b0b] p-6 ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:dialogIn_180ms_ease-out]">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0097A7]/12 ring-1 ring-inset ring-[#0097A7]/25">
              <Archive className="h-5 w-5 text-[#0097A7]" />
            </div>
            <div className="min-w-0 flex-1">
              <AlertDialog.Title className="text-base font-semibold text-white">Move to recycle bin?</AlertDialog.Title>
              <AlertDialog.Description className="mt-1 text-sm leading-relaxed text-gray-400">
                <span className="font-medium text-gray-200">{asset?.name}</span> ({asset?.type}) will be kept for{' '}
                <span className="tabular-nums text-[#0097A7]">{retentionDays} days</span> and can be restored.
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
                onClick={onConfirm}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0097A7] px-4 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_16px_-6px_rgba(0,151,167,0.7)] transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96]"
              >
                <Trash2 className="h-4 w-4" />
                Move to bin
              </button>
            </AlertDialog.Action>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

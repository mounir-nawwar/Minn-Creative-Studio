import * as Dialog from '@radix-ui/react-dialog';
import { Library, X } from 'lucide-react';
import LibraryGrid from './LibraryGrid';
import type { LibraryAsset } from './LibraryGrid';

interface LibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  renderCardActions?: (asset: LibraryAsset, refresh: () => void) => React.ReactNode;
}

/** Full-screen global asset library, opened from the picker header or the toolbar */
export default function LibraryDialog({ open, onOpenChange, renderCardActions }: LibraryDialogProps) {
  return (
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
          <LibraryGrid renderCardActions={renderCardActions} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

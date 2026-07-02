import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { FolderInput, X, Loader2, ChevronRight } from 'lucide-react';
import { projectsApi } from '../../lib/api';

interface MoveToProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Short label for what's being moved (e.g. filename or chat title) */
  subject: string;
  /** Exclude this project from the target list (usually the current home) */
  excludeProjectId?: string;
  onConfirm: (targetProjectId: string) => Promise<void>;
}

/** Pick a client project to re-home a playground asset or chat into */
export default function MoveToProjectDialog({
  open,
  onOpenChange,
  subject,
  excludeProjectId,
  onConfirm,
}: MoveToProjectDialogProps) {
  const [projects, setProjects] = useState<{ id: string; name: string; description?: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [movingTo, setMovingTo] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    projectsApi.list()
      .then((list) =>
        setProjects(
          list
            .filter((p) => p.id !== excludeProjectId && p.settings?.status !== 'archived')
            .map((p) => ({ id: p.id, name: p.name, description: p.description })),
        ),
      )
      .catch((err) => console.error('Failed to load projects:', err))
      .finally(() => setLoading(false));
  }, [open, excludeProjectId]);

  const handlePick = async (projectId: string) => {
    setMovingTo(projectId);
    try {
      await onConfirm(projectId);
      onOpenChange(false);
    } finally {
      setMovingTo(null);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[120] bg-black/70 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[120] flex max-h-[70vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-[#0b0b0b] ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:dialogIn_180ms_ease-out]">
          <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <FolderInput className="h-4 w-4 text-[#0097A7]" />
              <div>
                <Dialog.Title className="text-[14px] font-semibold leading-none text-white">Move to project</Dialog.Title>
                <Dialog.Description className="mt-1 max-w-[280px] truncate text-[11px] leading-none text-gray-500">
                  {subject}
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

          <div className="custom-scrollbar flex-1 space-y-1 overflow-y-auto p-2.5">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#0097A7]/20 border-t-[#0097A7]" />
              </div>
            ) : projects.length === 0 ? (
              <p className="py-10 text-center text-xs text-gray-600">No projects to move into yet.</p>
            ) : (
              projects.map((p) => (
                <button
                  key={p.id}
                  disabled={movingTo !== null}
                  onClick={() => handlePick(p.id)}
                  className="group flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-colors duration-150 hover:bg-white/[0.05] disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-white">{p.name}</p>
                    {p.description && <p className="truncate text-[11px] text-gray-500">{p.description}</p>}
                  </div>
                  {movingTo === p.id
                    ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0097A7]" />
                    : <ChevronRight className="h-4 w-4 shrink-0 text-gray-600 transition-colors group-hover:text-[#0097A7]" />}
                </button>
              ))
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

import { useState, useEffect, useCallback } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { BookMarked, ChevronDown, Plus, Trash2, X, Loader2 } from 'lucide-react';
import { presetsApi } from '../../lib/api';
import type { ChatPreset } from '../../lib/api';
import { toast } from '../../store/useToastStore';

interface PresetsMenuProps {
  /** Currently applied preset id (cleared when the instruction is hand-edited) */
  presetId?: string;
  /** Current system instruction — saved when creating a new preset */
  systemInstruction: string;
  onApply: (preset: ChatPreset) => void;
}

/** Preset picker + save/delete management for the system instruction */
export default function PresetsMenu({ presetId, systemInstruction, onApply }: PresetsMenuProps) {
  const [presets, setPresets] = useState<ChatPreset[]>([]);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<ChatPreset | null>(null);

  const fetchPresets = useCallback(() => {
    presetsApi.list()
      .then(setPresets)
      .catch((err) => console.error('Failed to load presets:', err));
  }, []);

  useEffect(() => { fetchPresets(); }, [fetchPresets]);

  const activePreset = presets.find((p) => p.id === presetId);

  const handleSave = async () => {
    if (!saveName.trim() || !systemInstruction.trim()) return;
    setSaving(true);
    try {
      const created = await presetsApi.create({ name: saveName.trim(), systemInstruction });
      setSaveName('');
      setShowSave(false);
      fetchPresets();
      onApply(created);
      toast.success('Preset saved', created.name);
    } catch (err) {
      toast.error('Save failed', err instanceof Error ? err.message : 'Could not save preset');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!presetToDelete) return;
    try {
      await presetsApi.delete(presetToDelete.id);
      fetchPresets();
      toast.success('Preset deleted', presetToDelete.name);
    } catch (err) {
      toast.error('Delete failed', err instanceof Error ? err.message : 'Could not delete preset');
    } finally {
      setPresetToDelete(null);
    }
  };

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            className="inline-flex h-8 w-full items-center justify-between gap-2 rounded-lg bg-black/30 px-2.5 text-xs text-gray-300 ring-1 ring-white/10 transition-shadow duration-150 hover:ring-white/20 focus:outline-none data-[state=open]:ring-[#0097A7]/40"
          >
            <span className="flex min-w-0 items-center gap-1.5">
              <BookMarked className="h-3 w-3 shrink-0 text-[#0097A7]" />
              <span className="truncate">{activePreset?.name ?? 'Presets'}</span>
            </span>
            <ChevronDown className="h-3 w-3 shrink-0 text-gray-500" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-[200] max-h-64 w-60 overflow-y-auto rounded-xl bg-[#0d0d0d] p-1.5 ring-1 ring-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:menuIn_140ms_cubic-bezier(0.2,0,0,1)]"
          >
            {presets.map((preset) => (
              <DropdownMenu.Item
                key={preset.id}
                onSelect={() => onApply(preset)}
                className={`group flex h-9 cursor-pointer select-none items-center justify-between gap-2 rounded-lg px-2.5 text-[12.5px] outline-none transition-colors duration-100 data-[highlighted]:bg-white/5 ${
                  preset.id === presetId ? 'text-[#0097A7]' : 'text-gray-300 data-[highlighted]:text-white'
                }`}
              >
                <span className="truncate">{preset.name}</span>
                <button
                  aria-label="Delete preset"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPresetToDelete(preset); }}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-600 opacity-0 transition-[opacity,color] duration-150 hover:text-red-400 group-data-[highlighted]:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-white/10" />
            <DropdownMenu.Item
              onSelect={() => { setSaveName(''); setShowSave(true); }}
              className="flex h-9 cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 text-[12.5px] text-[#0097A7] outline-none transition-colors duration-100 data-[highlighted]:bg-[#0097A7]/10"
            >
              <Plus className="h-3.5 w-3.5" />
              Save current as preset…
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* Save as preset */}
      <Dialog.Root open={showSave} onOpenChange={setShowSave}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[210] bg-black/70 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[210] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#0b0b0b] ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:dialogIn_180ms_ease-out]">
            <div className="flex items-center justify-between border-b border-white/5 px-5 py-4">
              <Dialog.Title className="text-[14px] font-semibold text-white">Save preset</Dialog.Title>
              <Dialog.Close asChild>
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-[transform,color,background-color] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.96]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <div className="space-y-4 p-5">
              <label className="block space-y-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">Preset name</span>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder='e.g. "TikTok script writer"'
                  className="w-full rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 ring-1 ring-white/10 transition-shadow duration-150 focus:outline-none focus:ring-[1.5px] focus:ring-[#0097A7]/60"
                  autoFocus
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                />
              </label>
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <button className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.96]">
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  onClick={handleSave}
                  disabled={!saveName.trim() || saving}
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0097A7] px-4 text-sm font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save preset'}
                </button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete confirmation */}
      <AlertDialog.Root open={!!presetToDelete} onOpenChange={(o) => { if (!o) setPresetToDelete(null); }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-[210] bg-black/70 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
          <AlertDialog.Content className="fixed left-1/2 top-1/2 z-[210] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-[#0b0b0b] p-5 ring-1 ring-white/10 shadow-[0_24px_80px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:dialogIn_180ms_ease-out]">
            <AlertDialog.Title className="text-[14px] font-semibold text-white">Delete preset?</AlertDialog.Title>
            <AlertDialog.Description className="mt-2 text-[12.5px] leading-relaxed text-gray-500">
              "{presetToDelete?.name}" will be removed for both accounts. This can't be undone.
            </AlertDialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertDialog.Cancel asChild>
                <button className="inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-gray-300 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.96]">
                  Cancel
                </button>
              </AlertDialog.Cancel>
              <AlertDialog.Action asChild>
                <button
                  onClick={handleDelete}
                  className="inline-flex h-9 items-center rounded-lg bg-red-500/90 px-4 text-sm font-medium text-white transition-[transform,background-color] duration-150 hover:bg-red-500 active:scale-[0.96]"
                >
                  Delete
                </button>
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </>
  );
}

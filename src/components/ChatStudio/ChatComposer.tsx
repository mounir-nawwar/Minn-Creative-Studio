import { useState, useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Paperclip, Send, X, Library, Upload, Loader2 } from 'lucide-react';
import LibraryGrid from '../Library/LibraryGrid';
import type { LibraryAsset } from '../Library/LibraryGrid';
import { useProjectStore } from '../../store/useProjectStore';
import { useAssets } from '../../hooks/useAssets';
import { toast } from '../../store/useToastStore';
import type { MessageAttachment } from '../../lib/api';
import type { GenerationMode } from '../../lib/models';

interface ChatComposerProps {
  mode: GenerationMode;
  disabled: boolean;
  onSend: (text: string, attachments: MessageAttachment[]) => void;
}

const PLACEHOLDER: Record<GenerationMode, string> = {
  text: 'Ask anything, or request a prompt…',
  image: 'Describe the image you want…',
  video: 'Describe the video you want…',
  audio: 'Describe the music, or write the words to speak…',
};

/** Composer bar: attachments + prompt textarea + send */
export default function ChatComposer({ mode, disabled, onSend }: ChatComposerProps) {
  const currentProject = useProjectStore((s) => s.currentProject);
  const { uploadAsset } = useAssets();
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-grow the textarea up to ~6 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [text]);

  const handleAssetSelect = (asset: LibraryAsset) => {
    setShowPicker(false);
    if (attachments.some((a) => a.assetId === asset.id)) return;
    const type: MessageAttachment['type'] =
      asset.type === 'video' ? 'video' : asset.type === 'audio' ? 'audio' : 'image';
    setAttachments((prev) => [...prev, { assetId: asset.id, url: asset.url, type, name: asset.filename }]);
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadAsset(file);
        const type: MessageAttachment['type'] =
          result.type === 'video' ? 'video' : result.type === 'audio' ? 'audio' : 'image';
        setAttachments((prev) => [...prev, { assetId: result.id, url: result.url, type, name: result.name }]);
      }
    } catch (err) {
      toast.error('Upload failed', err instanceof Error ? err.message : 'Could not upload the file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = () => {
    if (!text.trim() || disabled) return;
    const toSend = text;
    const toAttach = [...attachments];
    setText('');
    setAttachments([]);
    onSend(toSend, toAttach);
  };

  return (
    <div className="shrink-0 border-t border-white/5 bg-[#0a0a0a] px-6 py-4">
      <div className="mx-auto w-full max-w-3xl">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((att, i) => (
              <div key={i} className="group/att relative">
                <div className="h-11 w-11 overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
                  {att.type === 'image'
                    ? <img src={att.url} className="h-full w-full object-cover" alt={att.name || 'Attachment'} />
                    : <div className="flex h-full w-full items-center justify-center"><Library className="h-3.5 w-3.5 text-gray-500" /></div>}
                </div>
                <button
                  onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                  className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/80 text-white opacity-0 transition-opacity group-hover/att:opacity-100"
                  aria-label="Remove attachment"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl bg-[#161617] px-3 py-2.5 ring-1 ring-white/[0.08] transition-shadow duration-150 focus-within:ring-[#0097A7]/40">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            className="hidden"
            onChange={(e) => handleFileUpload(e.target.files)}
          />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                disabled={isUploading}
                className="mb-1 shrink-0 text-gray-500 transition-colors hover:text-gray-300 disabled:opacity-50"
                title="Attach"
              >
                {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                side="top"
                align="start"
                sideOffset={8}
                className="z-[100] w-52 rounded-xl bg-[#0d0d0d] p-1.5 ring-1 ring-white/10 shadow-[0_16px_40px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:menuIn_140ms_cubic-bezier(0.2,0,0,1)]"
              >
                <DropdownMenu.Item
                  onSelect={() => fileInputRef.current?.click()}
                  className="flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-gray-300 outline-none transition-colors duration-100 data-[highlighted]:bg-white/5 data-[highlighted]:text-white"
                >
                  <Upload className="h-3.5 w-3.5 text-[#0097A7]" />
                  Upload from device
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => setShowPicker(true)}
                  className="flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-gray-300 outline-none transition-colors duration-100 data-[highlighted]:bg-white/5 data-[highlighted]:text-white"
                >
                  <Library className="h-3.5 w-3.5 text-[#0097A7]" />
                  From Library
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <textarea
            ref={textareaRef}
            rows={1}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={PLACEHOLDER[mode]}
            className="max-h-36 flex-1 resize-none bg-transparent py-1 text-[13px] leading-relaxed text-white placeholder:text-gray-600 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!text.trim() || disabled}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#0097A7] text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96] disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-1.5 px-1 text-[10.5px] text-gray-700">Enter to send · Shift+Enter for a new line</p>
      </div>

      {/* Asset picker */}
      <Dialog.Root open={showPicker} onOpenChange={setShowPicker}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] flex h-[580px] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-[#161617] ring-1 ring-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:dialogIn_180ms_ease-out]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Library className="h-4 w-4 text-[#0097A7]" />
                <Dialog.Title className="text-[13px] font-semibold text-white">Attach asset</Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-[transform,color,background-color] duration-150 hover:bg-white/[0.06] hover:text-white active:scale-[0.96]"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <LibraryGrid
                isPicker
                onSelect={handleAssetSelect}
                initialFilters={currentProject ? { projectId: currentProject.id } : undefined}
              />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

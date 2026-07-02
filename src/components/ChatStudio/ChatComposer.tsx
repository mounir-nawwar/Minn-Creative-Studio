import { useState, useRef, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Paperclip, Send, X, Library } from 'lucide-react';
import AssetGrid from '../AssetGrid';
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
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<MessageAttachment[]>([]);
  const [showPicker, setShowPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-grow the textarea up to ~6 lines
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [text]);

  const handleAssetSelect = (asset: any) => {
    setShowPicker(false);
    if (attachments.some((a) => a.assetId === asset.id)) return;
    const type: MessageAttachment['type'] =
      asset.type === 'video' ? 'video' : asset.type === 'audio' ? 'audio' : 'image';
    setAttachments((prev) => [...prev, { assetId: asset.id, url: asset.url, type, name: asset.name || asset.filename }]);
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
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="mb-1 shrink-0 text-gray-500 transition-colors hover:text-gray-300"
            title="Attach asset"
          >
            <Paperclip className="h-4 w-4" />
          </button>
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
              <AssetGrid isPicker onAssetClick={handleAssetSelect} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

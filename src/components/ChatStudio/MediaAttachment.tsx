import { Loader2, ImageIcon, Film, Music } from 'lucide-react';
import { useStore } from '../../store/useStore';
import VideoPreview from '../VideoPreview';
import AudioPreview from '../AudioPreview';
import type { MessageAttachment as Attachment } from '../../lib/api';
import type { PendingGeneration } from './useChatStudio';

/** One generated/attached media item inside a chat message */
export function MediaAttachment({ att }: { att: Attachment }) {
  const setExpandedAsset = useStore((s) => s.setExpandedAsset);

  if (att.type === 'image') {
    return (
      <button
        type="button"
        onClick={() => setExpandedAsset(att.url, 'image')}
        className="group block overflow-hidden rounded-xl ring-1 ring-inset ring-white/10 transition-shadow duration-150 hover:ring-[#0097A7]/50"
      >
        <img src={att.url} alt={att.name || 'Generated image'} className="block max-h-[360px] w-auto max-w-full object-contain" loading="lazy" />
      </button>
    );
  }

  if (att.type === 'video') {
    return (
      <div className="w-full max-w-[480px] cursor-pointer" onClick={() => setExpandedAsset(att.url, 'video')}>
        <VideoPreview url={att.url} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-[380px]">
      <AudioPreview url={att.url} />
    </div>
  );
}

const PENDING_META: Record<string, { Icon: typeof ImageIcon; label: string }> = {
  image: { Icon: ImageIcon, label: 'Generating image' },
  video: { Icon: Film, label: 'Generating video' },
  audio: { Icon: Music, label: 'Generating audio' },
  text: { Icon: ImageIcon, label: 'Thinking' },
};

/** Local-only in-flight bubble (long-running video/audio show an elapsed timer) */
export function PendingBubble({ pending }: { pending: PendingGeneration }) {
  const meta = PENDING_META[pending.mode] ?? PENDING_META.text;

  if (pending.mode === 'text') {
    return (
      <div className="flex items-center gap-1 px-1 py-2">
        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" />
        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:0.15s]" />
        <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:0.3s]" />
      </div>
    );
  }

  const { Icon, label } = meta;
  return (
    <div className="inline-flex items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0097A7]/15">
        <Icon className="h-4 w-4 text-[#0097A7]" />
      </div>
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-gray-200">
          {label}
          {pending.elapsed && <span className="ml-2 tabular-nums text-gray-500">{pending.elapsed}</span>}
        </p>
        <p className="max-w-[320px] truncate text-[11px] text-gray-500">{pending.prompt}</p>
      </div>
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0097A7]" />
    </div>
  );
}

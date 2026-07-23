import { Loader2, ImageIcon, Film, Music, Trash2, LayoutGrid } from 'lucide-react';
import { useStore } from '../../store/useStore';
import { useProjectStore } from '../../store/useProjectStore';
import { toast } from '../../store/useToastStore';
import VideoPreview from '../VideoPreview';
import AudioPreview from '../AudioPreview';
import type { MessageAttachment as Attachment } from '../../lib/api';
import type { PendingGeneration } from './useChatStudio';

interface MediaAttachmentProps {
  att: Attachment;
  /** Deletes the message this attachment belongs to — shown as an overlay on the media itself */
  onDelete?: () => void;
}

/** Hover-reveal action overlay, positioned directly on the media */
function MediaOverlay({ onDelete, att }: { onDelete?: () => void; att: Attachment }) {
  const setPendingNodeType = useStore((s) => s.setPendingNodeType);
  const setStudioMode = useProjectStore((s) => s.setStudioMode);

  const handleSendToCanvas = (e: React.MouseEvent) => {
    e.stopPropagation();
    const type = att.type === 'video' ? 'videoUpload' : 'imageUpload';
    setPendingNodeType(type, { type, label: att.name || 'From Chat Studio', output: att.url, config: { url: att.url } });
    setStudioMode('canvas');
    toast.success('Sent to Canvas', 'Click anywhere on the canvas grid to place the node');
  };

  return (
    <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
      <button
        type="button"
        onClick={handleSendToCanvas}
        aria-label="Send to Canvas"
        title="Send to Canvas — place this node on your React Flow workspace"
        className="inline-flex h-6 items-center gap-1 rounded-md bg-black/70 px-2 text-[10px] font-medium text-white backdrop-blur-sm transition-[transform,background-color] duration-150 hover:bg-[#0097A7] active:scale-[0.96]"
      >
        <LayoutGrid className="h-3 w-3" />
        <span>Canvas</span>
      </button>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          aria-label="Delete"
          title="Delete — frees this out of the conversation's context"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-gray-300 backdrop-blur-sm transition-[transform,color,background-color] duration-150 hover:bg-red-500/80 hover:text-white active:scale-[0.96]"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

/** One generated/attached media item inside a chat message */
export function MediaAttachment({ att, onDelete }: MediaAttachmentProps) {
  const setExpandedAsset = useStore((s) => s.setExpandedAsset);

  if (att.type === 'image') {
    return (
      <div className="group relative inline-block">
        <button
          type="button"
          onClick={() => setExpandedAsset(att.url, 'image')}
          className="block overflow-hidden rounded-xl ring-1 ring-inset ring-white/10 transition-shadow duration-150 hover:ring-[#0097A7]/50"
        >
          <img src={att.url} alt={att.name || 'Generated image'} className="block max-h-[360px] w-auto max-w-full object-contain" loading="lazy" />
        </button>
        <MediaOverlay onDelete={onDelete} att={att} />
      </div>
    );
  }

  if (att.type === 'video') {
    return (
      <div className="group relative w-full max-w-[480px] cursor-pointer" onClick={() => setExpandedAsset(att.url, 'video')}>
        <VideoPreview url={att.url} />
        <MediaOverlay onDelete={onDelete} att={att} />
      </div>
    );
  }

  return (
    <div className="group relative w-full max-w-[380px]">
      <AudioPreview url={att.url} />
      <MediaOverlay onDelete={onDelete} att={att} />
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

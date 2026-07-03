import { Trash2 } from 'lucide-react';
import { renderMarkdown } from '../../lib/markdown';
import { findModel } from '../../lib/models';
import { MediaAttachment } from './MediaAttachment';
import type { ChatMessage } from '../../lib/api';

interface MessageBubbleProps {
  message: ChatMessage;
  onDelete: (messageId: string) => void;
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Delete message"
      title="Delete — frees this out of the conversation's context"
      className="mb-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-600 opacity-0 transition-[opacity,color] duration-150 hover:text-red-400 group-hover:opacity-100"
    >
      <Trash2 className="h-3 w-3" />
    </button>
  );
}

/** One message row in the Chat Studio thread */
export default function MessageBubble({ message, onDelete }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const attachments = message.attachments ?? [];
  const modelLabel = attachments.find((a) => a.model)?.model;

  if (isUser) {
    return (
      <div className="group flex min-w-0 items-end justify-end gap-1.5">
        <DeleteButton onClick={() => onDelete(message.id)} />
        <div className="min-w-0 max-w-[75%] space-y-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {attachments.map((att, i) => (
                <div key={i} className="max-w-[200px]">
                  <MediaAttachment att={att} onDelete={() => onDelete(message.id)} />
                </div>
              ))}
            </div>
          )}
          <div className="rounded-t-2xl rounded-bl-2xl rounded-br-[4px] bg-[#0097A7] px-4 py-2.5 text-[13px] leading-relaxed text-white">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex min-w-0 items-end justify-start gap-1.5">
      <div className="min-w-0 max-w-[85%] space-y-2">
        <div className="text-[13px] leading-relaxed text-gray-200">
          {renderMarkdown(message.content)}
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((att, i) => (
              <MediaAttachment key={i} att={att} onDelete={() => onDelete(message.id)} />
            ))}
          </div>
        )}
        {modelLabel && (
          <p className="text-[10px] uppercase tracking-wide text-gray-600">
            {findModel(modelLabel)?.label ?? modelLabel}
          </p>
        )}
      </div>
      <DeleteButton onClick={() => onDelete(message.id)} />
    </div>
  );
}

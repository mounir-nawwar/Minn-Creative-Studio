import { renderMarkdown } from '../../lib/markdown';
import { findModel } from '../../lib/models';
import { MediaAttachment } from './MediaAttachment';
import type { ChatMessage } from '../../lib/api';

/** One message row in the Chat Studio thread */
export default function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user';
  const attachments = message.attachments ?? [];
  const modelLabel = attachments.find((a) => a.model)?.model;

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] space-y-2">
          {attachments.length > 0 && (
            <div className="flex flex-wrap justify-end gap-2">
              {attachments.map((att, i) => (
                <div key={i} className="max-w-[200px]">
                  <MediaAttachment att={att} />
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
    <div className="flex justify-start">
      <div className="max-w-[85%] space-y-2">
        <div className="text-[13px] leading-relaxed text-gray-200">
          {renderMarkdown(message.content)}
        </div>
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((att, i) => (
              <MediaAttachment key={i} att={att} />
            ))}
          </div>
        )}
        {modelLabel && (
          <p className="text-[10px] uppercase tracking-wide text-gray-600">
            {findModel(modelLabel)?.label ?? modelLabel}
          </p>
        )}
      </div>
    </div>
  );
}

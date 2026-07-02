import { useEffect, useRef } from 'react';
import { Sparkles } from 'lucide-react';
import MessageBubble from './MessageBubble';
import { PendingBubble } from './MediaAttachment';
import type { ChatMessage } from '../../lib/api';
import type { PendingGeneration } from './useChatStudio';

interface ChatThreadProps {
  messages: ChatMessage[];
  pending: PendingGeneration | null;
  hasActiveChat: boolean;
  onStartChat: () => void;
}

/** Scrolling conversation column with autoscroll and the in-flight bubble */
export default function ChatThread({ messages, pending, hasActiveChat, onStartChat }: ChatThreadProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, pending]);

  if (!hasActiveChat) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0097A7]/10">
          <Sparkles className="h-7 w-7 text-[#0097A7]" />
        </div>
        <div className="space-y-1">
          <p className="text-[15px] font-semibold text-white">Create with a conversation</p>
          <p className="max-w-sm text-[12.5px] leading-relaxed text-gray-500">
            Pick a mode and model on the right, then describe what you want.
            Text, images, video, and audio all land right here in the thread.
          </p>
        </div>
        <button
          onClick={onStartChat}
          className="mt-1 inline-flex h-10 items-center rounded-lg bg-[#0097A7] px-5 text-[13px] font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96]"
        >
          Start new session
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl space-y-5 px-6 py-6">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {pending && (
          <div className="flex justify-start">
            <PendingBubble pending={pending} />
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  );
}

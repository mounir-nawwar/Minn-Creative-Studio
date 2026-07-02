import { Plus, Trash2, MessageSquare, FolderInput } from 'lucide-react';
import type { Chat } from '../../lib/api';

interface ChatHistoryRailProps {
  chats: Chat[];
  activeChatId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onMove: (chat: Chat) => void;
}

/** Left rail listing this project's chat sessions */
export default function ChatHistoryRail({ chats, activeChatId, onSelect, onNew, onDelete, onMove }: ChatHistoryRailProps) {
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-white/5 bg-[#0a0a0a]">
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Sessions</span>
        <button
          onClick={onNew}
          title="New session"
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-[transform,color,background-color] duration-150 hover:bg-white/[0.06] hover:text-white active:scale-[0.96]"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
        {chats.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <MessageSquare className="h-5 w-5 text-gray-700" />
            <p className="text-[11.5px] leading-relaxed text-gray-600">No sessions yet.<br />Start one to begin creating.</p>
          </div>
        )}
        {chats.map((chat) => (
          <div
            key={chat.id}
            onClick={() => onSelect(chat.id)}
            className={`group flex cursor-pointer items-start justify-between gap-2 rounded-lg px-3 py-2 transition-colors duration-150 ${
              activeChatId === chat.id ? 'bg-[#0097A7]/12 ring-1 ring-inset ring-[#0097A7]/30' : 'hover:bg-white/[0.04]'
            }`}
          >
            <div className="min-w-0">
              <p className={`truncate text-[12.5px] font-medium ${activeChatId === chat.id ? 'text-[#0097A7]' : 'text-gray-300'}`}>
                {chat.title}
              </p>
              {chat.last_message && (
                <p className="truncate text-[11px] text-gray-600">{chat.last_message}</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                onClick={(e) => { e.stopPropagation(); onMove(chat); }}
                aria-label="Move session to a project"
                title="Move to project"
                className="mt-0.5 p-1 text-gray-600 opacity-0 transition-[opacity,color] duration-150 hover:text-[#0097A7] group-hover:opacity-100"
              >
                <FolderInput className="h-3 w-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(chat.id); }}
                aria-label="Delete session"
                className="mt-0.5 p-1 text-gray-600 opacity-0 transition-[opacity,color] duration-150 hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}

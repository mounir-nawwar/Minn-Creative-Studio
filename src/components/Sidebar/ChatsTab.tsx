import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'motion/react';
import { Plus, MessageSquare, History, Trash2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useStore } from '../../store/useStore';
import { chatsApi, auth, Chat } from '../../lib/api';
import { Skeleton } from '../Skeleton';

export default function ChatsTab() {
  const { currentProject } = useProjectStore();
  const { setChatOpen, setActiveChatId, activeChatId } = useStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const fetchChats = useCallback(async () => {
    const user = auth.getCurrentUser();
    if (!currentProject || !user) { setChats([]); setIsLoading(false); return; }
    try {
      const allChats = await chatsApi.list();
      const projectChats = allChats.filter((chat) => chat.project_id === currentProject.id);
      projectChats.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setChats(projectChats);
    } catch (err) {
      console.error('Error fetching chats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (!currentProject || !user) { setChats([]); setIsLoading(false); return; }
    setIsLoading(true);
    fetchChats();
    pollingRef.current = setInterval(fetchChats, 5000);
    return () => { if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } };
  }, [fetchChats]);

  const createNewChat = async () => {
    if (!currentProject || !auth.getCurrentUser()) return;
    try {
      const newChat = await chatsApi.create({ title: 'New Creative Session', projectId: currentProject.id });
      setActiveChatId(newChat.id);
      setChatOpen(true);
      fetchChats();
    } catch (err) {
      console.error('Error creating chat:', err);
    }
  };

  const deleteChat = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete this chat?')) return;
    try {
      await chatsApi.delete(id);
      fetchChats();
    } catch (err) {
      console.error('Error deleting chat:', err);
    }
  };

  return (
    <motion.div
      key="chats"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="p-3">
        <button
          onClick={createNewChat}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0097A7]/10 text-[13px] font-medium text-[#0097A7] ring-1 ring-[#0097A7]/20 transition-[transform,background-color] duration-150 hover:bg-[#0097A7]/15 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          New chat
        </button>
      </div>

      <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto px-3 pb-4">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] p-3 ring-1 ring-white/10">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : chats.length === 0 ? (
          <div className="space-y-3 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] ring-1 ring-white/10">
              <MessageSquare className="h-5 w-5 text-gray-600" />
            </div>
            <p className="text-xs text-gray-500">No chats yet</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => { setActiveChatId(chat.id); setChatOpen(true); }}
              className={`group relative cursor-pointer rounded-xl bg-white/[0.03] p-3 ring-1 transition-[background-color,box-shadow] duration-150 ${
                activeChatId === chat.id ? 'bg-[#0097A7]/[0.06] ring-[#0097A7]/50' : 'ring-white/10 hover:ring-[#0097A7]/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-black/40 ring-1 ring-inset ring-white/10">
                  <History className="h-5 w-5 text-gray-700" />
                </div>
                <div className="min-w-0 flex-1 pr-6">
                  <h4 className="truncate text-[13px] font-medium text-white transition-colors group-hover:text-[#0097A7]">{chat.title}</h4>
                  <p className="mt-0.5 truncate text-[11px] text-gray-500">{chat.last_message || 'No messages yet'}</p>
                </div>
              </div>
              <button
                onClick={(e) => deleteChat(e, chat.id)}
                className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-600 opacity-0 transition-[opacity,color] duration-150 hover:text-red-400 group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

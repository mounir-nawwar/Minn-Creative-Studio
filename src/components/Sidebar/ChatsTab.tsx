import React, { useState, useEffect, useCallback, useRef } from 'react';
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
    if (!currentProject || !user) {
      setChats([]);
      setIsLoading(false);
      return;
    }

    try {
      const allChats = await chatsApi.list();
      // Filter by current project ID
      const projectChats = allChats.filter(
        chat => chat.project_id === currentProject.id
      );
      // Sort by created_at descending
      projectChats.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setChats(projectChats);
    } catch (err) {
      console.error('Error fetching chats:', err);
    } finally {
      setIsLoading(false);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    const user = auth.getCurrentUser();
    if (!currentProject || !user) {
      setChats([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    fetchChats();

    // Poll every 5 seconds
    pollingRef.current = setInterval(fetchChats, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchChats]);

  const createNewChat = async () => {
    const user = auth.getCurrentUser();
    if (!currentProject || !user) return;

    try {
      const newChat = await chatsApi.create({
        title: 'New Creative Session',
        projectId: currentProject.id,
      });
      setActiveChatId(newChat.id);
      setChatOpen(true);
      // Refresh chats list
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
      // Refresh chats list
      fetchChats();
    } catch (err) {
      console.error('Error deleting chat:', err);
    }
  };

  return (
    <motion.div
      key="chats"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="flex-1 flex flex-col overflow-hidden"
    >
      <div className="p-4">
        <button
          onClick={createNewChat}
          className="w-full py-4 bg-[#0097A7]/10 hover:bg-[#0097A7]/20 text-[#0097A7] rounded-2xl flex items-center justify-center gap-3 transition-all border border-[#0097A7]/20 group"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
          <span className="text-[10px] font-black uppercase tracking-widest">New Chat</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 custom-scrollbar">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#111111] border border-white/5 rounded-2xl p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            </div>
          ))
        ) : chats.length === 0 ? (
          <div className="py-20 text-center space-y-4">
            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center mx-auto">
              <MessageSquare className="w-6 h-6 text-gray-700" />
            </div>
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">No chats yet</p>
          </div>
        ) : (
          chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => { setActiveChatId(chat.id); setChatOpen(true); }}
              className={`group relative bg-[#111111] border border-white/5 hover:border-[#0097A7]/30 rounded-2xl p-4 cursor-pointer transition-all ${activeChatId === chat.id ? 'border-[#0097A7]/50 bg-[#0097A7]/5' : ''}`}
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-black rounded-xl border border-white/5 flex items-center justify-center">
                  <History className="w-5 h-5 text-gray-800" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[11px] font-black text-white uppercase truncate group-hover:text-[#0097A7] transition-colors">{chat.title}</h4>
                  <p className="text-[9px] text-gray-600 truncate mt-0.5">{chat.last_message || 'No messages yet'}</p>
                </div>
              </div>
              <button
                onClick={(e) => deleteChat(e, chat.id)}
                className="absolute top-2 right-2 p-1.5 opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}

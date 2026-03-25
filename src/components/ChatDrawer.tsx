import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Plus, 
  History, 
  Sparkles, 
  User as UserIcon, 
  Bot, 
  Loader2,
  ChevronRight,
  Trash2,
  Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  db, 
  auth, 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  doc, 
  deleteDoc,
  updateDoc,
  limit
} from '../firebase';
import { GoogleGenAI } from "@google/genai";
import { useProjectStore } from '../store/useProjectStore';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: any;
}

interface Chat {
  id: string;
  title: string;
  projectId: string;
  createdAt: any;
  lastMessage?: string;
}

export default function ChatDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { currentProject } = useProjectStore();

  const user = auth.currentUser;

  // Fetch Chats for current project
  useEffect(() => {
    if (!user || !currentProject) return;
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      where('projectId', '==', currentProject.id),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat)));
    });
  }, [user, currentProject]);

  // Fetch Messages
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    const q = query(
      collection(db, `chats/${activeChatId}/messages`),
      orderBy('createdAt', 'asc')
    );
    return onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message)));
    });
  }, [activeChatId]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createNewChat = async () => {
    if (!user || !currentProject) return;
    const newChat = await addDoc(collection(db, 'chats'), {
      title: 'New Creative Session',
      projectId: currentProject.id,
      userId: user.uid,
      createdAt: serverTimestamp(),
    });
    setActiveChatId(newChat.id);
  };

  const deleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (activeChatId === chatId) setActiveChatId(null);
    await deleteDoc(doc(db, 'chats', chatId));
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || !user || !currentProject) return;

    let chatId = activeChatId;
    if (!chatId) {
      const newChat = await addDoc(collection(db, 'chats'), {
        title: inputText.slice(0, 30) + '...',
        projectId: currentProject.id,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      chatId = newChat.id;
      setActiveChatId(chatId);

      // Update project updatedAt
      const { doc, updateDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'projects', currentProject.id), {
        updatedAt: serverTimestamp()
      });
    }

    const userMsg = inputText;
    setInputText('');
    
    // Save User Message
    await addDoc(collection(db, `chats/${chatId}/messages`), {
      chatId,
      role: 'user',
      text: userMsg,
      createdAt: serverTimestamp(),
    });

    // Update Chat Title if it's the first message
    if (messages.length === 0) {
      await updateDoc(doc(db, 'chats', chatId), {
        title: userMsg.slice(0, 40) + (userMsg.length > 40 ? '...' : '')
      });
    }

    setIsTyping(true);

    try {
      const projectContext = `
        Current Project: ${currentProject.name}
        Type: ${currentProject.type}
        Description: ${currentProject.description}
        Brand: ${currentProject.clientName || 'N/A'}
        Industry: ${currentProject.clientIndustry || 'N/A'}
        AI Instructions: ${currentProject.aiInstructions || 'N/A'}
        Style Keywords: ${currentProject.styleKeywords || 'N/A'}
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'user', parts: [{ text: `You are a creative assistant for MINN STUDIO. 
          You are currently working on the following project:
          ${projectContext}
          
          Your goal is to help the user with image and video generation ideas, prompt engineering, and creative direction specific to this project's goals and brand identity.
          Be concise, professional, and inspiring.
          
          User request: ${userMsg}` }] }
        ],
        config: {
          systemInstruction: "You are a creative director assistant. Help with prompts, visual ideas, and technical advice for AI video/image generation within the context of the current project."
        }
      });

      const modelText = response.text || "I'm sorry, I couldn't generate a response.";

      // Save Model Message
      await addDoc(collection(db, `chats/${chatId}/messages`), {
        chatId,
        role: 'model',
        text: modelText,
        createdAt: serverTimestamp(),
      });

      // Update Last Message
      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: modelText.slice(0, 50) + '...'
      });

    } catch (err) {
      console.error("Gemini Error:", err);
    } finally {
      setIsTyping(false);
    }
  };

  if (!currentProject) return null;

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-6 bottom-6 w-14 h-14 bg-[#0097A7] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group"
      >
        <MessageSquare className="w-6 h-6 group-hover:rotate-12 transition-transform" />
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-black animate-pulse" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
            />

            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-[400px] bg-[#0a0a0a] border-l border-white/10 z-[70] flex flex-col shadow-[-20px_0_50px_rgba(0,0,0,0.5)]"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#111111]">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#0097A7]/20 rounded-xl">
                    <Sparkles className="w-5 h-5 text-[#0097A7]" />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-white uppercase tracking-widest">Creative Assistant</h2>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Project: {currentProject.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-2 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 flex overflow-hidden">
                {/* Sidebar (Chat History) */}
                <div className="w-16 hover:w-64 transition-all duration-300 border-r border-white/5 bg-[#0a0a0a] flex flex-col group/sidebar overflow-hidden">
                  <div className="p-3">
                    <button 
                      onClick={createNewChat}
                      className="w-full aspect-square group-hover/sidebar:aspect-auto group-hover/sidebar:py-3 bg-[#0097A7]/10 hover:bg-[#0097A7]/20 text-[#0097A7] rounded-xl flex items-center justify-center gap-3 transition-all"
                    >
                      <Plus className="w-5 h-5" />
                      <span className="hidden group-hover/sidebar:inline text-xs font-bold uppercase tracking-widest">New Chat</span>
                    </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto px-3 space-y-2">
                    {chats.map(chat => (
                      <div
                        key={chat.id}
                        onClick={() => setActiveChatId(chat.id)}
                        className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-[#0097A7]/20 text-[#0097A7]' : 'hover:bg-white/5 text-gray-500 hover:text-gray-300'}`}
                      >
                        <History className="w-5 h-5 flex-shrink-0" />
                        <span className="hidden group-hover/sidebar:inline text-[11px] font-bold truncate pr-6">{chat.title}</span>
                        <button 
                          onClick={(e) => deleteChat(e, chat.id)}
                          className="absolute right-2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chat Area */}
                <div className="flex-1 flex flex-col bg-[#0d0d0d]">
                  {!activeChatId ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6">
                      <div className="w-20 h-20 bg-[#0097A7]/10 rounded-3xl flex items-center justify-center animate-pulse">
                        <Bot className="w-10 h-10 text-[#0097A7]" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-lg font-bold text-white">Project Assistant</h3>
                        <p className="text-xs text-gray-500 leading-relaxed">Ask me for prompt ideas, camera directions, or help with your creative workflow for <span className="text-[#0097A7] font-bold">{currentProject.name}</span>.</p>
                      </div>
                      <button 
                        onClick={createNewChat}
                        className="px-6 py-3 bg-[#0097A7] text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:scale-105 transition-all"
                      >
                        Start New Session
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Messages */}
                      <div className="flex-1 overflow-y-auto p-6 space-y-6">
                        {messages.map((msg) => (
                          <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-[#0097A7] text-white' : 'bg-white/10 text-[#0097A7]'}`}>
                              {msg.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                            </div>
                            <div className={`max-w-[85%] p-4 rounded-2xl text-[12px] leading-relaxed ${msg.role === 'user' ? 'bg-[#0097A7]/10 text-white border border-[#0097A7]/20' : 'bg-white/5 text-gray-300 border border-white/5'}`}>
                              {msg.text}
                            </div>
                          </div>
                        ))}
                        {isTyping && (
                          <div className="flex gap-4">
                            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center">
                              <Loader2 className="w-4 h-4 text-[#0097A7] animate-spin" />
                            </div>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                              <div className="flex gap-1">
                                <div className="w-1.5 h-1.5 bg-[#0097A7] rounded-full animate-bounce" />
                                <div className="w-1.5 h-1.5 bg-[#0097A7] rounded-full animate-bounce [animation-delay:0.2s]" />
                                <div className="w-1.5 h-1.5 bg-[#0097A7] rounded-full animate-bounce [animation-delay:0.4s]" />
                              </div>
                            </div>
                          </div>
                        )}
                        <div ref={messagesEndRef} />
                      </div>

                      {/* Input */}
                      <div className="p-6 bg-[#111111] border-t border-white/5">
                        <form onSubmit={handleSendMessage} className="relative">
                          <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="Describe your creative vision..."
                            className="w-full bg-black border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-[13px] text-white focus:outline-none focus:border-[#0097A7] transition-all placeholder:text-gray-700"
                          />
                          <button
                            type="submit"
                            disabled={!inputText.trim() || isTyping}
                            className="absolute right-2 top-2 bottom-2 w-10 bg-[#0097A7] text-white rounded-xl flex items-center justify-center disabled:opacity-50 hover:scale-105 transition-all"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </form>
                        <p className="text-[9px] text-gray-600 text-center mt-3 uppercase font-bold tracking-widest">Gemini can make mistakes. Verify important info.</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

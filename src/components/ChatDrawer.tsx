import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  Send,
  X,
  Plus,
  History,
  Sparkles,
  Bot,
  Loader2,
  Trash2,
  Library,
  Copy,
  Check,
  Paperclip
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import AssetGrid from './AssetGrid';
import { useChat } from '../hooks/useChat';

function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="bg-white/10 px-1 rounded text-[11px] font-mono text-[#0097A7]">{part.slice(1, -1)}</code>;
    return part;
  });
}

function CodeCanvas({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mt-2 mb-1 rounded-xl overflow-hidden border border-white/10 bg-[#1c1c1e]">
      <div className="flex items-center justify-between px-3 py-2 bg-[#111111] border-b border-white/10">
        <span className="text-[10px] font-bold uppercase tracking-widest text-[#0097A7]">{label || 'Prompt'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all text-[11px] font-medium"
        >
          {copied
            ? <><Check className="w-3 h-3 text-green-400" /><span className="text-green-400">Copied</span></>
            : <><Copy className="w-3 h-3" /><span>Copy</span></>
          }
        </button>
      </div>
      <pre className="p-3 text-[12px] leading-relaxed text-gray-200 whitespace-pre-wrap font-sans overflow-x-auto">
        {code.trim()}
      </pre>
    </div>
  );
}

function renderMarkdown(text: string): React.ReactNode {
  const segments = text.split(/(```[\w]*\n[\s\S]*?```)/g);
  return (
    <div className="space-y-0.5">
      {segments.map((seg, si) => {
        const fenceMatch = seg.match(/^```([\w]*)\n([\s\S]*?)```$/);
        if (fenceMatch) {
          const lang = fenceMatch[1];
          const code = fenceMatch[2];
          const label = lang === 'prompt' ? 'Prompt' : lang ? lang : 'Prompt';
          return <CodeCanvas key={si} code={code} label={label} />;
        }
        const lines = seg.split('\n');
        return lines.map((line, i) => {
          if (line.startsWith('### ')) return <p key={`${si}-${i}`} className="font-bold text-[13px] text-white mt-2 mb-0.5">{parseInline(line.slice(4))}</p>;
          if (line.startsWith('## '))  return <p key={`${si}-${i}`} className="font-bold text-[14px] text-white mt-2 mb-0.5">{parseInline(line.slice(3))}</p>;
          if (line.startsWith('# '))   return <p key={`${si}-${i}`} className="font-bold text-[15px] text-white mt-2 mb-0.5">{parseInline(line.slice(2))}</p>;
          if (line.startsWith('- ') || line.startsWith('* '))
            return (
              <p key={`${si}-${i}`} className="flex gap-2 items-start">
                <span className="text-[#0097A7] mt-0.5 leading-none">•</span>
                <span>{parseInline(line.slice(2))}</span>
              </p>
            );
          if (/^\d+\. /.test(line)) return <p key={`${si}-${i}`}>{parseInline(line)}</p>;
          if (line.trim() === '') return <div key={`${si}-${i}`} className="h-2" />;
          return <p key={`${si}-${i}`}>{parseInline(line)}</p>;
        });
      })}
    </div>
  );
}

export default function ChatDrawer() {
  const { isChatOpen: isOpen, setChatOpen: setIsOpen, activeChatId, setActiveChatId } = useStore();
  const { currentProject } = useProjectStore();
  const { chats, messages, isTyping, createNewChat, deleteChat, sendMessage } = useChat();

  const [inputText, setInputText] = useState('');
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleAssetSelect = (asset: any) => {
    if (selectedAssets.find(a => a.id === asset.id)) return;
    setSelectedAssets(prev => [...prev, asset]);
    setShowAssetPicker(false);
  };

  const removeSelectedAsset = (assetId: string) => {
    setSelectedAssets(prev => prev.filter(a => a.id !== assetId));
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isTyping) return;
    const textToSend = inputText;
    const assetsToSend = [...selectedAssets];
    setInputText('');
    setSelectedAssets([]);
    await sendMessage(textToSend, assetsToSend);
  };

  if (!currentProject) return null;

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed right-6 bottom-6 w-13 h-13 bg-[#0097A7] text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-50"
        style={{ width: 52, height: 52 }}
      >
        <MessageSquare className="w-5 h-5" />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60] bg-black/30 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              style={{ transformOrigin: 'bottom center' }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] w-[70vw] max-w-[860px] h-[620px] bg-[#161617] rounded-3xl shadow-[0_32px_80px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden border border-white/[0.06]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 bg-[#0097A7]/15 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-[#0097A7]" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-white leading-none">Creative Assistant</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 leading-none">{currentProject.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => { createNewChat(); setShowHistory(false); }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-all"
                    title="New chat"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setShowHistory(h => !h)}
                    className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${showHistory ? 'text-[#0097A7] bg-[#0097A7]/10' : 'text-gray-500 hover:text-white hover:bg-white/8'}`}
                    title="Chat history"
                  >
                    <History className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* History Panel */}
              <AnimatePresence>
                {showHistory && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden border-b border-white/[0.06]"
                  >
                    <div className="max-h-48 overflow-y-auto p-2 space-y-0.5">
                      {chats.length === 0 && (
                        <p className="text-[12px] text-gray-600 text-center py-4">No previous chats</p>
                      )}
                      {chats.map(chat => (
                        <div
                          key={chat.id}
                          onClick={() => { setActiveChatId(chat.id); setShowHistory(false); }}
                          className={`group flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${activeChatId === chat.id ? 'bg-[#0097A7]/15 text-[#0097A7]' : 'hover:bg-white/5 text-gray-400 hover:text-gray-200'}`}
                        >
                          <span className="text-[12px] truncate">{chat.title}</span>
                          <button
                            onClick={(e) => deleteChat(e, chat.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all flex-shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat Area */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {!activeChatId ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-4">
                    <div className="w-14 h-14 bg-[#0097A7]/10 rounded-2xl flex items-center justify-center">
                      <Bot className="w-7 h-7 text-[#0097A7]" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[14px] font-semibold text-white">Project Assistant</p>
                      <p className="text-[12px] text-gray-500 leading-relaxed">Ask for prompt ideas, camera directions,<br/>or creative help for <span className="text-[#0097A7]">{currentProject.name}</span>.</p>
                    </div>
                    <button
                      onClick={createNewChat}
                      className="mt-1 px-5 py-2.5 bg-[#0097A7] text-white text-[12px] font-semibold rounded-xl hover:bg-[#00b3c6] active:scale-95 transition-all"
                    >
                      Start New Chat
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`relative max-w-[78%] px-4 py-2.5 text-[13px] leading-relaxed ${
                            msg.role === 'user'
                              ? 'bg-[#0097A7] text-white rounded-t-2xl rounded-bl-2xl rounded-br-[3px]'
                              : 'bg-[#2c2c2e] text-gray-200 rounded-t-2xl rounded-br-2xl rounded-bl-[3px]'
                          }`}>
                            {msg.role === 'user'
                              ? <svg className="absolute -right-[7px] bottom-0" width="8" height="10" viewBox="0 0 8 10"><path d="M0 0 L0 10 L8 10 Z" fill="#0097A7"/></svg>
                              : <svg className="absolute -left-[7px] bottom-0" width="8" height="10" viewBox="0 0 8 10"><path d="M8 0 L8 10 L0 10 Z" fill="#2c2c2e"/></svg>
                            }
                            {msg.role === 'user' ? msg.content : renderMarkdown(msg.content)}
                          </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="relative bg-[#2c2c2e] px-4 py-3 rounded-t-2xl rounded-br-2xl rounded-bl-[3px]">
                            <svg className="absolute -left-[7px] bottom-0" width="8" height="10" viewBox="0 0 8 10"><path d="M8 0 L8 10 L0 10 Z" fill="#2c2c2e"/></svg>
                            <div className="flex gap-1 items-center">
                              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" />
                              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.15s]" />
                              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:0.3s]" />
                            </div>
                          </div>
                        </div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="px-3 pb-3 pt-2 border-t border-white/[0.06]">
                      <AnimatePresence>
                        {selectedAssets.length > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex flex-wrap gap-2 mb-2"
                          >
                            {selectedAssets.map(asset => (
                              <div key={asset.id} className="relative group/asset">
                                <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 bg-black">
                                  {asset.type === 'image'
                                    ? <img src={asset.thumbnailUrl || asset.url} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full flex items-center justify-center"><Library className="w-3.5 h-3.5 text-gray-500" /></div>
                                  }
                                </div>
                                <button
                                  onClick={() => removeSelectedAsset(asset.id)}
                                  className="absolute -top-1 -right-1 w-4 h-4 bg-black/80 text-white rounded-full flex items-center justify-center opacity-0 group-hover/asset:opacity-100 transition-opacity"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <form onSubmit={handleSubmit} className="flex items-center gap-2 bg-[#2c2c2e] rounded-2xl px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setShowAssetPicker(true)}
                          className="text-gray-500 hover:text-gray-300 transition-colors flex-shrink-0"
                        >
                          <Paperclip className="w-4 h-4" />
                        </button>
                        <input
                          type="text"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          placeholder="Ask anything..."
                          className="flex-1 bg-transparent text-[13px] text-white placeholder:text-gray-600 focus:outline-none"
                        />
                        <button
                          type="submit"
                          disabled={!inputText.trim() || isTyping}
                          className="w-7 h-7 bg-[#0097A7] text-white rounded-xl flex items-center justify-center disabled:opacity-40 hover:bg-[#00b3c6] active:scale-90 transition-all flex-shrink-0"
                        >
                          <Send className="w-3.5 h-3.5" />
                        </button>
                      </form>
                    </div>
                  </>
                )}
              </div>
            </motion.div>

            {/* Asset Picker Modal */}
            <AnimatePresence>
              {showAssetPicker && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-8">
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setShowAssetPicker(false)}
                    className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                  />
                  <motion.div
                    initial={{ opacity: 0, scale: 0.96, y: 12 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96, y: 12 }}
                    className="relative w-full max-w-2xl h-[580px] bg-[#161617] border border-white/[0.06] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
                  >
                    <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Library className="w-4 h-4 text-[#0097A7]" />
                        <span className="text-[13px] font-semibold text-white">Link Asset</span>
                      </div>
                      <button
                        onClick={() => setShowAssetPicker(false)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:text-white hover:bg-white/8 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden flex flex-col">
                      <AssetGrid isPicker onAssetClick={handleAssetSelect} />
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

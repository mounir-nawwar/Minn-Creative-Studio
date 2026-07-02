import React, { useState, useEffect, useRef } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { MessageSquare, Send, X, Plus, History, Sparkles, Bot, Trash2, Library, Paperclip } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import AssetGrid from './AssetGrid';
import { useChat } from '../hooks/useChat';
import { renderMarkdown } from '../lib/markdown';

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
    if (selectedAssets.find((a) => a.id === asset.id)) return;
    setSelectedAssets((prev) => [...prev, asset]);
    setShowAssetPicker(false);
  };

  const removeSelectedAsset = (assetId: string) => setSelectedAssets((prev) => prev.filter((a) => a.id !== assetId));

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

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

  const iconBtn = 'inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-[transform,color,background-color] duration-150 hover:bg-white/[0.06] hover:text-white active:scale-[0.96]';

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      {/* Floating trigger */}
      <Dialog.Trigger asChild>
        <button
          aria-label="Open creative assistant"
          className="fixed bottom-6 right-6 z-50 inline-flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#0097A7] text-white shadow-[0_8px_24px_-6px_rgba(0,151,167,0.7)] transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96]"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed bottom-24 left-1/2 z-[70] flex h-[620px] w-[70vw] max-w-[860px] -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-[#161617] shadow-[0_32px_80px_rgba(0,0,0,0.6)] ring-1 ring-white/[0.08] focus:outline-none data-[state=open]:[animation:overlayIn_180ms_ease-out]"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0097A7]/15">
                <Sparkles className="h-3.5 w-3.5 text-[#0097A7]" />
              </div>
              <div>
                <Dialog.Title className="text-[13px] font-semibold leading-none text-white">Creative Assistant</Dialog.Title>
                <Dialog.Description className="mt-1 text-[11px] leading-none text-gray-500">{currentProject.name}</Dialog.Description>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { createNewChat(); setShowHistory(false); }} className={iconBtn} title="New chat">
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={() => setShowHistory((h) => !h)}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-[transform,color,background-color] duration-150 active:scale-[0.96] ${showHistory ? 'bg-[#0097A7]/10 text-[#0097A7]' : 'text-gray-500 hover:bg-white/[0.06] hover:text-white'}`}
                title="Chat history"
              >
                <History className="h-4 w-4" />
              </button>
              <Dialog.Close asChild>
                <button className={iconBtn} aria-label="Close"><X className="h-4 w-4" /></button>
              </Dialog.Close>
            </div>
          </div>

          {/* History */}
          <AnimatePresence initial={false}>
            {showHistory && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                className="overflow-hidden border-b border-white/[0.06]"
              >
                <div className="max-h-48 space-y-0.5 overflow-y-auto p-2">
                  {chats.length === 0 && <p className="py-4 text-center text-[12px] text-gray-600">No previous chats</p>}
                  {chats.map((chat) => (
                    <div
                      key={chat.id}
                      onClick={() => { setActiveChatId(chat.id); setShowHistory(false); }}
                      className={`group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors duration-150 ${activeChatId === chat.id ? 'bg-[#0097A7]/15 text-[#0097A7]' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
                    >
                      <span className="truncate text-[12px]">{chat.title}</span>
                      <button
                        onClick={(e) => deleteChat(e, chat.id)}
                        className="shrink-0 p-1 text-gray-600 opacity-0 transition-[opacity,color] duration-150 hover:text-red-400 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {!activeChatId ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#0097A7]/10">
                  <Bot className="h-7 w-7 text-[#0097A7]" />
                </div>
                <div className="space-y-1">
                  <p className="text-[14px] font-semibold text-white">Project Assistant</p>
                  <p className="text-[12px] leading-relaxed text-gray-500">
                    Ask for prompt ideas, camera directions,<br />or creative help for <span className="text-[#0097A7]">{currentProject.name}</span>.
                  </p>
                </div>
                <button
                  onClick={createNewChat}
                  className="mt-1 inline-flex h-10 items-center rounded-lg bg-[#0097A7] px-5 text-[13px] font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96]"
                >
                  Start new chat
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`relative max-w-[78%] px-4 py-2.5 text-[13px] leading-relaxed ${
                        msg.role === 'user'
                          ? 'rounded-t-2xl rounded-bl-2xl rounded-br-[3px] bg-[#0097A7] text-white'
                          : 'rounded-t-2xl rounded-br-2xl rounded-bl-[3px] bg-[#2c2c2e] text-gray-200'
                      }`}>
                        {msg.role === 'user'
                          ? <svg className="absolute -right-[7px] bottom-0" width="8" height="10" viewBox="0 0 8 10"><path d="M0 0 L0 10 L8 10 Z" fill="#0097A7" /></svg>
                          : <svg className="absolute -left-[7px] bottom-0" width="8" height="10" viewBox="0 0 8 10"><path d="M8 0 L8 10 L0 10 Z" fill="#2c2c2e" /></svg>}
                        {msg.role === 'user' ? msg.content : renderMarkdown(msg.content)}
                      </div>
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex justify-start">
                      <div className="relative rounded-t-2xl rounded-br-2xl rounded-bl-[3px] bg-[#2c2c2e] px-4 py-3">
                        <svg className="absolute -left-[7px] bottom-0" width="8" height="10" viewBox="0 0 8 10"><path d="M8 0 L8 10 L0 10 Z" fill="#2c2c2e" /></svg>
                        <div className="flex items-center gap-1">
                          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500" />
                          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:0.15s]" />
                          <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-500 [animation-delay:0.3s]" />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="border-t border-white/[0.06] px-3 pb-3 pt-2">
                  <AnimatePresence initial={false}>
                    {selectedAssets.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
                        className="mb-2 flex flex-wrap gap-2"
                      >
                        {selectedAssets.map((asset) => (
                          <div key={asset.id} className="group/asset relative">
                            <div className="h-10 w-10 overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
                              {asset.type === 'image'
                                ? <img src={asset.thumbnailUrl || asset.url} className="h-full w-full object-cover" />
                                : <div className="flex h-full w-full items-center justify-center"><Library className="h-3.5 w-3.5 text-gray-500" /></div>}
                            </div>
                            <button
                              onClick={() => removeSelectedAsset(asset.id)}
                              className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/80 text-white opacity-0 transition-opacity group-hover/asset:opacity-100"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <form onSubmit={handleSubmit} className="flex items-center gap-2 rounded-xl bg-[#2c2c2e] px-3 py-2 ring-1 ring-white/[0.06] transition-shadow duration-150 focus-within:ring-[#0097A7]/40">
                    <button type="button" onClick={() => setShowAssetPicker(true)} className="shrink-0 text-gray-500 transition-colors hover:text-gray-300" title="Attach asset">
                      <Paperclip className="h-4 w-4" />
                    </button>
                    <input
                      type="text"
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder="Ask anything…"
                      className="flex-1 bg-transparent text-[13px] text-white placeholder:text-gray-600 focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!inputText.trim() || isTyping}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#0097A7] text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96] disabled:opacity-40"
                    >
                      <Send className="h-3.5 w-3.5" />
                    </button>
                  </form>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>

      {/* Asset picker */}
      <Dialog.Root open={showAssetPicker} onOpenChange={setShowAssetPicker}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[100] flex h-[580px] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-[#161617] ring-1 ring-white/[0.08] shadow-[0_24px_80px_rgba(0,0,0,0.7)] focus:outline-none data-[state=open]:[animation:dialogIn_180ms_ease-out]">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Library className="h-4 w-4 text-[#0097A7]" />
                <Dialog.Title className="text-[13px] font-semibold text-white">Link asset</Dialog.Title>
              </div>
              <Dialog.Close asChild>
                <button className={iconBtn} aria-label="Close"><X className="h-4 w-4" /></button>
              </Dialog.Close>
            </div>
            <div className="flex flex-1 flex-col overflow-hidden">
              <AssetGrid isPicker onAssetClick={handleAssetSelect} />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </Dialog.Root>
  );
}

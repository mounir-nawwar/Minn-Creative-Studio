import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectStore, isPlaygroundProject } from '../../store/useProjectStore';
import { useStore } from '../../store/useStore';
import { buildProjectContext } from '../../lib/projectContext';
import { toast } from '../../store/useToastStore';
import { chatsApi, Chat, ChatMessage, MessageAttachment } from '../../lib/api';
import { generateText } from '../../services/geminiService';
import { DEFAULT_MODEL_FOR_MODE, findModel } from '../../lib/models';
import type { GenerationMode } from '../../lib/models';

export type { Chat, ChatMessage, MessageAttachment };

const POLL_INTERVAL = 4000;

export const CREATIVE_DIRECTOR_INSTRUCTION =
  'You are a creative director assistant for AI video/image generation. You specialize in writing detailed generative prompts for Midjourney, Stable Diffusion, Sora, Runway, Kling, and similar tools. When asked for prompts, write complete, rich, detailed prompts with specific visual descriptions. Help with visual ideas, camera directions, lighting setups, style references, color palettes, and technical advice. Wrap any prompt in a fenced code block (triple backticks) so it renders as a copyable block.\n\nIMPORTANT: Match your response length to what was asked. Casual messages get short natural replies. Only go detailed when the user explicitly asks for prompts, ideas, or guidance. Never volunteer unsolicited project analysis or example prompts.';

export interface GenerationSettings {
  mode: GenerationMode;
  model: string;
  params: Record<string, unknown>;
  systemInstruction: string;
  presetId?: string;
}

export interface PendingGeneration {
  mode: GenerationMode;
  prompt: string;
  elapsed?: string;
}

function defaultSettings(): GenerationSettings {
  const model = DEFAULT_MODEL_FOR_MODE.text;
  return {
    mode: 'text',
    model,
    params: { ...(findModel(model)?.defaults ?? {}) },
    systemInstruction: CREATIVE_DIRECTOR_INSTRUCTION,
  };
}

/** Server list wins; keep local messages the server hasn't returned yet */
function mergeMessages(server: ChatMessage[], local: ChatMessage[]): ChatMessage[] {
  const seen = new Set(server.map((m) => m.id));
  const extras = local.filter((m) => !seen.has(m.id));
  return [...server, ...extras];
}

export function useChatStudio() {
  const { currentProject } = useProjectStore();
  const { activeChatId, setActiveChatId } = useStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState<PendingGeneration | null>(null);
  const [settings, setSettingsState] = useState<GenerationSettings>(defaultSettings);

  const isGenerating = pending !== null;
  // Poll snapshots must not clobber optimistic messages while a generation is in flight
  const generatingRef = useRef(false);
  useEffect(() => { generatingRef.current = isGenerating; }, [isGenerating]);

  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const isPlayground = isPlaygroundProject(currentProject);

  const setSettings = useCallback((update: Partial<GenerationSettings>) => {
    setSettingsState((prev) => {
      let next = { ...prev, ...update };
      // Switching mode resets the model + params to that mode's defaults
      if (update.mode && update.mode !== prev.mode) {
        const model = DEFAULT_MODEL_FOR_MODE[update.mode];
        next = { ...next, model, params: { ...(findModel(model)?.defaults ?? {}) } };
      } else if (update.model && update.model !== prev.model) {
        next = { ...next, params: { ...(findModel(update.model)?.defaults ?? {}) } };
      }
      return next;
    });
  }, []);

  const fetchChats = useCallback(async () => {
    if (!currentProject) return;
    try {
      const allChats = await chatsApi.list();
      setChats(allChats.filter((c) => c.project_id === currentProject.id));
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    }
  }, [currentProject?.id]);

  const fetchMessages = useCallback(async () => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    // Skip reconcile mid-generation so in-flight bubbles never flicker away
    if (generatingRef.current) return;
    try {
      const chat = await chatsApi.get(activeChatId);
      setMessages((prev) => mergeMessages(chat.messages || [], prev));
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, [activeChatId]);

  useEffect(() => {
    if (!currentProject) {
      setChats([]);
      return;
    }
    fetchChats();
    const interval = setInterval(fetchChats, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchChats, currentProject]);

  useEffect(() => {
    setMessages([]);
    if (!activeChatId) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchMessages, activeChatId]);

  const appendMessage = useCallback((message: ChatMessage) => {
    setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
  }, []);

  const createNewChat = useCallback(async () => {
    if (!currentProject) return;
    try {
      const newChat = await chatsApi.create({ title: 'New session', projectId: currentProject.id });
      setActiveChatId(newChat.id);
      await fetchChats();
    } catch (error) {
      console.error('Failed to create chat:', error);
      toast.error('Chat Error', 'Failed to create new chat');
    }
  }, [currentProject, setActiveChatId, fetchChats]);

  const deleteChat = useCallback(async (chatId: string) => {
    if (activeChatId === chatId) setActiveChatId(null);
    try {
      await chatsApi.delete(chatId);
      await fetchChats();
    } catch (error) {
      console.error('Failed to delete chat:', error);
      toast.error('Chat Error', 'Failed to delete chat');
    }
  }, [activeChatId, setActiveChatId, fetchChats]);

  /** Ensure a chat exists, post the user message, and retitle new chats */
  const prepareUserMessage = useCallback(async (text: string, attachments: MessageAttachment[]) => {
    let chatId = activeChatId;
    if (!chatId) {
      const title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
      const newChat = await chatsApi.create({ title, projectId: currentProject!.id });
      chatId = newChat.id;
      setActiveChatId(chatId);
      void fetchChats();
    } else if (messagesRef.current.length === 0) {
      const title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
      void chatsApi.update(chatId, { title });
    }
    const userMessage = await chatsApi.addMessage(chatId, 'user', text, attachments);
    appendMessage(userMessage);
    return chatId;
  }, [activeChatId, currentProject, setActiveChatId, fetchChats, appendMessage]);

  const runTextGeneration = useCallback(async (chatId: string, text: string, attachments: MessageAttachment[]) => {
    const imageUrls = attachments.filter((a) => a.type === 'image').map((a) => a.url);
    const modelText = await generateText({
      prompt: text,
      model: settings.model,
      systemInstruction: settings.systemInstruction || CREATIVE_DIRECTOR_INSTRUCTION,
      imageUrls,
      // The playground sentinel carries no real brand identity — don't inject it
      projectContext: isPlayground ? undefined : buildProjectContext(currentProject!),
      maxOutputTokens: 8192,
      projectId: currentProject!.id,
    });
    const assistantMessage = await chatsApi.addMessage(chatId, 'assistant', modelText);
    appendMessage(assistantMessage);
  }, [settings.model, settings.systemInstruction, isPlayground, currentProject, appendMessage]);

  const sendMessage = useCallback(async (text: string, attachments: MessageAttachment[] = []) => {
    if (!text.trim() || !currentProject || generatingRef.current) return;

    try {
      const chatId = await prepareUserMessage(text, attachments);
      setPending({ mode: settings.mode, prompt: text });
      generatingRef.current = true;

      try {
        await runTextGeneration(chatId, text, attachments);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Generation failed';
        toast.error('Generation Error', errorMessage);
      } finally {
        setPending(null);
        generatingRef.current = false;
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Chat Error', 'Failed to send message');
      setPending(null);
      generatingRef.current = false;
    }
  }, [currentProject, settings.mode, prepareUserMessage, runTextGeneration]);

  return {
    chats,
    messages,
    pending,
    isGenerating,
    settings,
    setSettings,
    activeChatId,
    setActiveChatId,
    createNewChat,
    deleteChat,
    sendMessage,
  };
}

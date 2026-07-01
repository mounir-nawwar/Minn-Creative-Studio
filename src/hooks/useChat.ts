import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useStore } from '../store/useStore';
import { buildProjectContext } from '../lib/projectContext';
import { toast } from '../store/useToastStore';
import { chatsApi, Chat, ChatMessage } from '../lib/api';
import { generateText } from '../services/geminiService';

export type { Chat, ChatMessage };

export interface SendAsset {
  id: string;
  url: string;
  name: string;
  type: string;
}

// Polling interval in milliseconds
const POLL_INTERVAL = 4000; // 4 seconds

export function useChat() {
  const { currentProject } = useProjectStore();
  const { activeChatId, setActiveChatId } = useStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const messagesPollingRef = useRef<NodeJS.Timeout | null>(null);

  // Poll chats for current project
  const fetchChats = useCallback(async () => {
    if (!currentProject) return;
    try {
      const allChats = await chatsApi.list();
      // Filter chats by current project
      const projectChats = allChats.filter(c => c.project_id === currentProject.id);
      setChats(projectChats);
    } catch (error) {
      console.error('Failed to fetch chats:', error);
    }
  }, [currentProject?.id]);

  // Poll messages for active chat
  const fetchMessages = useCallback(async () => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }
    try {
      const chat = await chatsApi.get(activeChatId);
      setMessages(chat.messages || []);
    } catch (error) {
      console.error('Failed to fetch messages:', error);
    }
  }, [activeChatId]);

  // Start polling for chats
  useEffect(() => {
    if (!currentProject) {
      setChats([]);
      return;
    }

    fetchChats();
    pollingRef.current = setInterval(fetchChats, POLL_INTERVAL);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [fetchChats]);

  // Start polling for messages
  useEffect(() => {
    if (!activeChatId) {
      setMessages([]);
      return;
    }

    fetchMessages();
    messagesPollingRef.current = setInterval(fetchMessages, POLL_INTERVAL);

    return () => {
      if (messagesPollingRef.current) {
        clearInterval(messagesPollingRef.current);
        messagesPollingRef.current = null;
      }
    };
  }, [fetchMessages]);

  const createNewChat = async () => {
    if (!currentProject) return;
    try {
      const newChat = await chatsApi.create({
        title: 'New Creative Session',
        projectId: currentProject.id
      });
      setActiveChatId(newChat.id);
      // Refresh chats list
      await fetchChats();
    } catch (error) {
      console.error('Failed to create chat:', error);
      toast.error('Chat Error', 'Failed to create new chat');
    }
  };

  const deleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (activeChatId === chatId) setActiveChatId(null);
    try {
      await chatsApi.delete(chatId);
      // Refresh chats list
      await fetchChats();
    } catch (error) {
      console.error('Failed to delete chat:', error);
      toast.error('Chat Error', 'Failed to delete chat');
    }
  };

  const sendMessage = async (text: string, assets: SendAsset[]) => {
    if (!text.trim() || !currentProject) return;

    let chatId = activeChatId;

    try {
      // Create new chat if needed
      if (!chatId) {
        const newChat = await chatsApi.create({
          title: text.slice(0, 30) + '...',
          projectId: currentProject.id
        });
        chatId = newChat.id;
        setActiveChatId(chatId);
        await fetchChats();
      }

      // Add user message
      await chatsApi.addMessage(chatId, 'user', text);

      // Update chat title if first message
      if (messages.length === 0) {
        const title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
        await chatsApi.update(chatId, { title });
      }

      // Refresh messages immediately
      await fetchMessages();

      // Generate AI response
      setIsTyping(true);
      try {
        const projectContext = buildProjectContext(currentProject);

        const imageUrls = assets.filter(a => a.type === 'image').map(a => a.url);

        const modelText = await generateText({
          prompt: text,
          model: "gemini-3-flash-preview",
          systemInstruction: "You are a creative director assistant for AI video/image generation. You specialize in writing detailed generative prompts for Midjourney, Stable Diffusion, Sora, Runway, Kling, and similar tools. When asked for prompts, write complete, rich, detailed prompts with specific visual descriptions. Help with visual ideas, camera directions, lighting setups, style references, color palettes, and technical advice. Wrap any prompt in a fenced code block (triple backticks) so it renders as a copyable block.\n\nIMPORTANT: Match your response length to what was asked. Casual messages get short natural replies. Only go detailed when the user explicitly asks for prompts, ideas, or guidance. Never volunteer unsolicited project analysis or example prompts.",
          imageUrls,
          projectContext,
          maxOutputTokens: 8192,
          projectId: currentProject?.id,
        });

        // Add assistant message
        await chatsApi.addMessage(chatId, 'assistant', modelText);

        // Refresh messages
        await fetchMessages();

      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
        toast.error('Chat Error', errorMessage);
      } finally {
        setIsTyping(false);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Chat Error', 'Failed to send message');
      setIsTyping(false);
    }
  };

  return { chats, messages, isTyping, createNewChat, deleteChat, sendMessage };
}

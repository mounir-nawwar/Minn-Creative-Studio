import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useProjectStore } from '../store/useProjectStore';
import { useStore } from '../store/useStore';
import { buildProjectContext } from '../lib/projectContext';
import { toast } from '../store/useToastStore';
import { chatsApi, Chat, ChatMessage } from '../lib/api';
import { DEFAULT_TEXT_MODEL } from '../lib/models';
import { useChatsQuery } from './queries/useChatsQuery';
import { useChatMessagesQuery } from './queries/useChatMessagesQuery';
import { queryKeys } from './queries/keys';
import { generateText } from '../services/geminiService';

export type { Chat, ChatMessage };

export interface SendAsset {
  id: string;
  url: string;
  name: string;
  type: string;
}

export function useChat() {
  const { currentProject } = useProjectStore();
  const { activeChatId, setActiveChatId } = useStore();
  const queryClient = useQueryClient();
  const [isTyping, setIsTyping] = useState(false);

  // Shared, visibility-gated queries (dedup with ChatsTab / ChatStudio).
  const { data: chatsData } = useChatsQuery(currentProject?.id);
  const chats = chatsData ?? [];
  const messagesQuery = useChatMessagesQuery(activeChatId);
  const messages: ChatMessage[] = messagesQuery.data?.messages ?? [];

  const invalidateChats = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.chats(currentProject?.id) });
  const invalidateMessages = (chatId: string | null) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.chat(chatId) });

  const createNewChat = async () => {
    if (!currentProject) return;
    try {
      const newChat = await chatsApi.create({
        title: 'New Creative Session',
        projectId: currentProject.id
      });
      setActiveChatId(newChat.id);
      await invalidateChats();
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
      await invalidateChats();
    } catch (error) {
      console.error('Failed to delete chat:', error);
      toast.error('Chat Error', 'Failed to delete chat');
    }
  };

  const sendMessage = async (text: string, assets: SendAsset[]) => {
    if (!text.trim() || !currentProject) return;

    // Capture history before any mutation — everything the model should
    // remember is exactly what's in state right now, prior to this new turn.
    const history = messages.map((m) => ({ role: m.role, content: m.content }));

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
        await invalidateChats();
      }

      // Add user message
      await chatsApi.addMessage(chatId, 'user', text);

      // Update chat title if first message
      if (messages.length === 0) {
        const title = text.slice(0, 40) + (text.length > 40 ? '...' : '');
        await chatsApi.update(chatId, { title });
      }

      // Refresh messages immediately
      await invalidateMessages(chatId);

      // Generate AI response
      setIsTyping(true);
      try {
        const projectContext = buildProjectContext(currentProject);

        const imageUrls = assets.filter(a => a.type === 'image').map(a => a.url);

        const modelText = await generateText({
          prompt: text,
          model: DEFAULT_TEXT_MODEL,
          systemInstruction: "You are a creative director assistant for AI video/image generation. You specialize in writing detailed generative prompts for Midjourney, Stable Diffusion, Sora, Runway, Kling, and similar tools. When asked for prompts, write complete, rich, detailed prompts with specific visual descriptions. Help with visual ideas, camera directions, lighting setups, style references, color palettes, and technical advice. Wrap any prompt in a fenced code block (triple backticks) so it renders as a copyable block.\n\nIMPORTANT: Match your response length to what was asked. Casual messages get short natural replies. Only go detailed when the user explicitly asks for prompts, ideas, or guidance. Never volunteer unsolicited project analysis or example prompts.",
          imageUrls,
          projectContext,
          maxOutputTokens: 8192,
          projectId: currentProject?.id,
          history,
        });

        // Add assistant message
        await chatsApi.addMessage(chatId, 'assistant', modelText);

        // Refresh messages
        await invalidateMessages(chatId);

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

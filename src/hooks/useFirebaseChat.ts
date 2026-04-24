import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { useStore } from '../store/useStore';
import { toast } from '../store/useToastStore';
import {
  db, auth, collection, addDoc, query, where, orderBy, onSnapshot,
  serverTimestamp, doc, deleteDoc, updateDoc, handleFirestoreError, OperationType
} from '../firebase';
import { generateText } from '../services/geminiService';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  createdAt: unknown;
}

export interface FirebaseChat {
  id: string;
  title: string;
  projectId: string;
  createdAt: unknown;
  lastMessage?: string;
}

export interface SendAsset {
  id: string;
  url: string;
  name: string;
  type: string;
}

export function useFirebaseChat() {
  const { currentProject } = useProjectStore();
  const { activeChatId, setActiveChatId } = useStore();
  const [chats, setChats] = useState<FirebaseChat[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    if (!user || !currentProject) return;
    const q = query(
      collection(db, 'chats'),
      where('projectId', '==', currentProject.id),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as FirebaseChat)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
    });
  }, [user?.uid, currentProject?.id]);

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
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${activeChatId}/messages`);
    });
  }, [activeChatId]);

  const createNewChat = async () => {
    if (!user || !currentProject) return;
    try {
      const newChat = await addDoc(collection(db, 'chats'), {
        title: 'New Creative Session',
        projectId: currentProject.id,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      setActiveChatId(newChat.id);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'chats');
    }
  };

  const deleteChat = async (e: React.MouseEvent, chatId: string) => {
    e.stopPropagation();
    if (activeChatId === chatId) setActiveChatId(null);
    try {
      await deleteDoc(doc(db, 'chats', chatId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `chats/${chatId}`);
    }
  };

  const sendMessage = async (text: string, assets: SendAsset[]) => {
    if (!text.trim() || !user || !currentProject) return;

    let chatId = activeChatId;
    if (!chatId) {
      const newChat = await addDoc(collection(db, 'chats'), {
        title: text.slice(0, 30) + '...',
        projectId: currentProject.id,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      chatId = newChat.id;
      setActiveChatId(chatId);
      await updateDoc(doc(db, 'projects', currentProject.id), {
        updatedAt: serverTimestamp()
      });
    }

    await addDoc(collection(db, `chats/${chatId}/messages`), {
      chatId,
      role: 'user',
      text,
      assets: assets.map(a => ({ id: a.id, url: a.url, name: a.name, type: a.type })),
      createdAt: serverTimestamp(),
    });

    if (messages.length === 0) {
      await updateDoc(doc(db, 'chats', chatId), {
        title: text.slice(0, 40) + (text.length > 40 ? '...' : '')
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

      await addDoc(collection(db, `chats/${chatId}/messages`), {
        chatId,
        role: 'model',
        text: modelText,
        createdAt: serverTimestamp(),
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: modelText.slice(0, 50) + '...'
      });

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get response';
      toast.error('Chat Error', errorMessage);
    } finally {
      setIsTyping(false);
    }
  };

  return { chats, messages, isTyping, createNewChat, deleteChat, sendMessage };
}

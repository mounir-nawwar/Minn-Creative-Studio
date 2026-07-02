/**
 * Chats API Routes
 * Handles chat and message CRUD operations
 */

import express from 'express';
import { chats, messages, projects, generateId } from '../services/database.ts';
import { authMiddleware } from '../services/auth.ts';

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

/**
 * GET /api/chats
 * Get all chats for the authenticated user
 */
router.get('/', (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const chatList = chats.findByUserId(userId);
    res.json(chatList);
  } catch (error: any) {
    console.error('Error fetching chats:', error);
    res.status(500).json({ error: 'Failed to fetch chats' });
  }
});

/**
 * GET /api/chats/:id
 * Get a single chat with messages
 */
router.get('/:id', (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const chat = chats.findById(id);
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    if (chat.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const chatMessages = messages.findByChatId(id);
    
    res.json({
      ...chat,
      messages: chatMessages
    });
  } catch (error: any) {
    console.error('Error fetching chat:', error);
    res.status(500).json({ error: 'Failed to fetch chat' });
  }
});

/**
 * GET /api/chats/:id/messages
 * Get messages for a chat
 */
router.get('/:id/messages', (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const chat = chats.findById(id);
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    if (chat.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const chatMessages = messages.findByChatId(id);
    res.json(chatMessages);
  } catch (error: any) {
    console.error('Error fetching messages:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

/**
 * POST /api/chats
 * Create a new chat
 */
router.post('/', (req: any, res: any) => {
  try {
    const userId = req.user.id;
    const { title, projectId } = req.body;

    // Validate projectId if provided.
    // Shared workspace: any authenticated user may attach chats to any project.
    if (projectId) {
      const project = projects.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
    }
    
    const id = generateId();
    const chat = chats.create(id, userId, title || 'New Chat', projectId);
    
    res.status(201).json(chat);
  } catch (error: any) {
    console.error('Error creating chat:', error);
    res.status(500).json({ error: 'Failed to create chat' });
  }
});

/**
 * POST /api/chats/:id/messages
 * Add a message to a chat
 */
router.post('/:id/messages', (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { role, content, attachments } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'Role and content are required' });
    }

    if (role !== 'user' && role !== 'assistant') {
      return res.status(400).json({ error: 'Role must be "user" or "assistant"' });
    }

    const MAX_ATTACHMENTS = 10;
    const VALID_ATTACHMENT_TYPES = ['image', 'video', 'audio'];
    let validAttachments: any[] = [];
    if (attachments !== undefined) {
      if (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS) {
        return res.status(400).json({ error: `Attachments must be an array of at most ${MAX_ATTACHMENTS}` });
      }
      const allValid = attachments.every(
        (a: any) => a && typeof a.url === 'string' && a.url.length > 0 && VALID_ATTACHMENT_TYPES.includes(a.type)
      );
      if (!allValid) {
        return res.status(400).json({ error: 'Each attachment needs a url and a type of image, video, or audio' });
      }
      validAttachments = attachments.map((a: any) => ({
        assetId: typeof a.assetId === 'string' ? a.assetId : undefined,
        url: a.url,
        type: a.type,
        name: typeof a.name === 'string' ? a.name : undefined,
        model: typeof a.model === 'string' ? a.model : undefined,
      }));
    }

    const chat = chats.findById(id);

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }

    if (chat.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messageId = generateId();
    const message = messages.create(messageId, id, role, content, validAttachments);

    res.status(201).json(message);
  } catch (error: any) {
    console.error('Error adding message:', error);
    res.status(500).json({ error: 'Failed to add message' });
  }
});

/**
 * PUT /api/chats/:id
 * Update chat title
 */
router.put('/:id', (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title } = req.body;
    
    const chat = chats.findById(id);
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    if (chat.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    chats.update(id, { title });
    const updated = chats.findById(id);
    
    res.json(updated);
  } catch (error: any) {
    console.error('Error updating chat:', error);
    res.status(500).json({ error: 'Failed to update chat' });
  }
});

/**
 * DELETE /api/chats/:id
 * Delete a chat and all its messages
 */
router.delete('/:id', (req: any, res: any) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    const chat = chats.findById(id);
    
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    
    if (chat.user_id !== userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Delete messages first
    messages.deleteByChatId(id);
    
    // Delete chat
    chats.delete(id);
    
    res.json({ success: true, message: 'Chat deleted' });
  } catch (error: any) {
    console.error('Error deleting chat:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

export default router;

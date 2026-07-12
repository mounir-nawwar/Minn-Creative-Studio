/**
 * Chat Studio tools — the ONE per-user surface in the shared workspace.
 * Unlike projects/assets/workflows, chats belong to their creator, so every
 * tool here checks ownership against the session user and only lists the
 * caller's own sessions.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { chats, messages, projects, generateId, type MessageAttachment } from '../../services/database.ts';
import { auditLog } from '../audit.ts';
import type { ToolContext } from '../server.ts';
import { jsonResult, errorResult } from './util.ts';

const MAX_ATTACHMENTS = 10;

const attachmentSchema = z.object({
  url: z.string().min(1),
  type: z.enum(['image', 'video', 'audio']),
  assetId: z.string().optional(),
  name: z.string().optional(),
  model: z.string().optional(),
});

function ownChat(chatId: string, userId: string) {
  const chat = chats.findById(chatId);
  if (!chat || chat.user_id !== userId) return undefined; // hide others' chats entirely
  return chat;
}

export function registerChatTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'list_chats',
    {
      title: 'List my Chat Studio sessions',
      description:
        'Your own Chat Studio conversations (chats are per-user, unlike the shared projects/assets). ' +
        'Optionally filter by projectId.',
      inputSchema: { projectId: z.string().min(1).optional() },
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'list_chats', args, async () => {
        let rows = chats.findByUserId(ctx.user.id);
        if (args.projectId) rows = rows.filter((c: any) => c.project_id === args.projectId);
        return jsonResult(
          {
            chats: rows.map((c: any) => ({
              id: c.id,
              title: c.title,
              projectId: c.project_id,
              lastMessage: c.last_message,
              updatedAt: c.updated_at,
            })),
          },
          `${rows.length} chat(s)`
        );
      })
  );

  server.registerTool(
    'get_chat',
    {
      title: 'Read a Chat Studio session',
      description: 'Full message history of one of your chats, including media attachments.',
      inputSchema: { chatId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'get_chat', args, async () => {
        const chat = ownChat(args.chatId, ctx.user.id);
        if (!chat) return errorResult(`Chat not found: ${args.chatId}`);
        const messageRows = messages.findByChatId(args.chatId);
        return jsonResult({
          id: chat.id,
          title: chat.title,
          projectId: chat.project_id,
          messages: messageRows.map((m: any) => ({
            id: m.id,
            role: m.role,
            content: m.content,
            attachments: m.attachments,
            createdAt: m.created_at,
          })),
        });
      })
  );

  server.registerTool(
    'create_chat',
    {
      title: 'Create a Chat Studio session',
      description:
        "Start a new (empty) Chat Studio conversation, visible in the app's Chat Studio. Attach it to a project " +
        "or to 'playground'.",
      inputSchema: {
        projectId: z.string().min(1),
        title: z.string().min(1).max(120).optional(),
      },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'create_chat', args, async () => {
        if (!projects.findById(args.projectId)) return errorResult(`Project not found: ${args.projectId}`);
        const id = generateId();
        chats.create(id, ctx.user.id, args.title ?? 'New chat', args.projectId);
        return jsonResult({ chatId: id, title: args.title ?? 'New chat', projectId: args.projectId }, 'Chat created');
      })
  );

  server.registerTool(
    'post_chat_message',
    {
      title: 'Post a message into a Chat Studio session',
      description:
        'Append a message (optionally with media attachments by url) to one of your chats — useful for dropping ' +
        'generated results or notes where they can be seen in the app. Role \'assistant\' renders as the AI side.',
      inputSchema: {
        chatId: z.string().min(1),
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1),
        attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
      },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'post_chat_message', args, async () => {
        const chat = ownChat(args.chatId, ctx.user.id);
        if (!chat) return errorResult(`Chat not found: ${args.chatId}`);
        const id = generateId();
        messages.create(id, args.chatId, args.role, args.content, (args.attachments ?? []) as MessageAttachment[]);
        return jsonResult({ messageId: id, chatId: args.chatId }, 'Message posted');
      })
  );
}

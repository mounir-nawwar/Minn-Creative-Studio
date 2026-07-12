/**
 * Streamable HTTP session management for the /mcp endpoint.
 *
 * Stateful: each MCP `initialize` creates one transport + one McpServer bound
 * to the authenticated user; follow-up requests route by the `mcp-session-id`
 * header. JSON-response mode (no SSE) keeps every request short — Cloudflare's
 * ~100s proxied-response timeout never comes into play for Phase A tools.
 *
 * Load-bearing detail: the app's global express.json() has already consumed
 * the request stream, so every handleRequest call passes `req.body` as the
 * third argument. Dropping it makes requests hang.
 */

import crypto from 'crypto';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { SESSION_IDLE_MS } from './config.ts';
import { createMcpServer, type McpUser } from './server.ts';

interface McpSession {
  transport: StreamableHTTPServerTransport;
  userId: string;
  lastSeen: number;
}

const sessions = new Map<string, McpSession>();

function userFromAuth(req: Request): McpUser | undefined {
  const extra = req.auth?.extra as { userId?: string; username?: string; displayName?: string } | undefined;
  if (!extra?.userId || !extra.username) return undefined;
  return { id: extra.userId, username: extra.username, displayName: extra.displayName };
}

function jsonRpcError(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
}

export async function handleMcpPost(req: Request, res: Response): Promise<void> {
  try {
    const user = userFromAuth(req);
    if (!user) {
      jsonRpcError(res, 401, -32000, 'Unauthorized');
      return;
    }

    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) {
        jsonRpcError(res, 404, -32001, 'Session not found — reinitialize');
        return;
      }
      // Two-user shared instance: a session may only be driven by the user
      // whose token created it.
      if (session.userId !== user.id) {
        jsonRpcError(res, 403, -32003, 'Session belongs to a different user');
        return;
      }
      session.lastSeen = Date.now();
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    if (!isInitializeRequest(req.body)) {
      jsonRpcError(res, 400, -32000, 'Missing mcp-session-id — send an initialize request first');
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sid) => {
        sessions.set(sid, { transport, userId: user.id, lastSeen: Date.now() });
      },
    });
    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    await createMcpServer(user).connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error: unknown) {
    console.error('[MCP] POST /mcp failed:', error);
    if (!res.headersSent) {
      jsonRpcError(res, 500, -32603, 'Internal error');
    }
  }
}

/** JSON-response mode has no standalone SSE stream (revisited in Phase E). */
export function handleMcpGet(_req: Request, res: Response): void {
  res.setHeader('Allow', 'POST, DELETE');
  jsonRpcError(res, 405, -32000, 'SSE streaming is not enabled on this server');
}

export async function handleMcpDelete(req: Request, res: Response): Promise<void> {
  try {
    const user = userFromAuth(req);
    const sessionId = req.headers['mcp-session-id'] as string | undefined;
    const session = sessionId ? sessions.get(sessionId) : undefined;
    if (!session || !user) {
      jsonRpcError(res, 404, -32001, 'Session not found');
      return;
    }
    if (session.userId !== user.id) {
      jsonRpcError(res, 403, -32003, 'Session belongs to a different user');
      return;
    }
    await session.transport.handleRequest(req, res, req.body);
  } catch (error: unknown) {
    console.error('[MCP] DELETE /mcp failed:', error);
    if (!res.headersSent) {
      jsonRpcError(res, 500, -32603, 'Internal error');
    }
  }
}

/** Close sessions idle beyond SESSION_IDLE_MS (transport.onclose removes them). */
const sweeper = setInterval(() => {
  const cutoff = Date.now() - SESSION_IDLE_MS;
  for (const [sid, session] of sessions) {
    if (session.lastSeen < cutoff) {
      console.log(`[MCP] Closing idle session ${sid}`);
      void session.transport.close();
    }
  }
}, 60 * 1000);
sweeper.unref();

/** Test/inspection hook. */
export function activeSessionCount(): number {
  return sessions.size;
}

/**
 * Builds the McpServer instance for one authenticated session.
 * Tools close over the session's user, so per-call attribution needs no
 * extra plumbing — the audit wrapper reads `ctx.user` plus the per-request
 * sessionId the SDK hands each tool handler.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerProjectTools } from './tools/projects.ts';
import { registerWorkflowTools } from './tools/workflows.ts';
import { registerLibraryTools } from './tools/library.ts';
import { registerModelTools } from './tools/models.ts';

/** The identity a session acts as (derived from the verified access token). */
export interface McpUser {
  id: string;
  username: string;
  displayName?: string;
}

export interface ToolContext {
  user: McpUser;
}

export function createMcpServer(user: McpUser): McpServer {
  const server = new McpServer({
    name: 'minn-creative-studio',
    title: 'Minn Creative Studio',
    version: '1.0.0',
  });

  const ctx: ToolContext = { user };
  registerToolGroups(server, ctx);

  return server;
}

function registerToolGroups(server: McpServer, ctx: ToolContext): void {
  registerProjectTools(server, ctx);
  registerWorkflowTools(server, ctx);
  registerLibraryTools(server, ctx);
  registerModelTools(server, ctx);
}

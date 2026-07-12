/**
 * Builds the McpServer instance for one authenticated session.
 * Tools close over the session's user, so per-call attribution needs no
 * extra plumbing — the audit wrapper reads `ctx.user` plus the per-request
 * sessionId the SDK hands each tool handler.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

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

/** Phase A.5 fills this in with the read-only tool groups. */
function registerToolGroups(_server: McpServer, _ctx: ToolContext): void {
  // no tools yet — the endpoint itself lands first (Phase A.4)
}

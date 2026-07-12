/**
 * Shared helpers for MCP tool results.
 * Phase A returns payloads as pretty-printed JSON text content (no
 * outputSchema declared yet — the SDK rejects structuredContent without one).
 */

import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export function jsonResult(payload: unknown, summary?: string): CallToolResult {
  const text = JSON.stringify(payload, null, 2);
  return {
    content: [{ type: 'text', text: summary ? `${summary}\n\n${text}` : text }],
  };
}

export function errorResult(message: string): CallToolResult {
  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}

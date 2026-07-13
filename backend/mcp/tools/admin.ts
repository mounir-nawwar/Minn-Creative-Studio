/**
 * Operational tools: get_audit_log, get_connector_status.
 * Both users may read the audit trail — it's a two-person studio, and "what
 * did Claude do in here?" is a question either of them should be able to ask.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { users } from '../../services/database.ts';
import { auditLog } from '../audit.ts';
import { guard, spentTodayUsd, SCOPES } from '../guard.ts';
import type { ToolContext } from '../server.ts';
import { jsonResult } from './util.ts';

export function registerAdminTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'get_audit_log',
    {
      title: 'Read the connector audit log',
      description:
        'Every tool call made through the MCP connector: who ran what, with which params, ok/error, and duration. ' +
        'Filter by user, tool, status, or time. History is kept for 90 days.',
      inputSchema: {
        username: z.string().optional().describe("Filter by user (e.g. 'mounir.nawwar')"),
        tool: z.string().optional(),
        status: z.enum(['ok', 'error']).optional(),
        since: z.string().optional().describe("ISO date/time, e.g. '2026-07-01'"),
        limit: z.number().int().min(1).max(500).optional().describe('Default 50'),
      },
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'get_audit_log', args, async () => {
        let userId: string | undefined;
        if (args.username) {
          const match = users.getAll().find((u: any) => u.username === args.username);
          userId = match?.id ?? '__no_such_user__';
        }

        const rows = auditLog.query({
          userId,
          tool: args.tool,
          status: args.status,
          since: args.since,
          limit: args.limit,
        });
        const usernameById = new Map(users.getAll().map((u: any) => [u.id, u.username]));

        return jsonResult(
          {
            entries: rows.map((row) => ({
              tool: row.tool,
              user: usernameById.get(row.user_id as string) ?? row.user_id,
              status: row.status,
              error: row.error,
              durationMs: row.duration_ms,
              params: row.params,
              at: row.created_at,
            })),
          },
          `${rows.length} audit entr${rows.length === 1 ? 'y' : 'ies'}`
        );
      })
  );

  server.registerTool(
    'get_connector_status',
    {
      title: 'Connector status',
      description:
        "This connection's granted permissions, today's spend against the daily ceiling, and the tool limits in " +
        'force. Check this first if a tool refuses you.',
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'get_connector_status', args, async () => {
        const spent = spentTodayUsd(ctx.user.id);
        const limit = Number(process.env.MCP_DAILY_SPEND_LIMIT_USD) || 20;
        const maxRun = Number(process.env.MCP_MAX_RUN_COST_USD) || 5;
        return jsonResult({
          user: ctx.user.username,
          scopesAvailable: SCOPES,
          spendToday: { usedUsd: Number(spent.toFixed(4)), dailyLimitUsd: limit, remainingUsd: Number(Math.max(0, limit - spent).toFixed(4)) },
          limits: {
            toolCallsPerMinute: 120,
            generationCallsPerMinute: 10,
            maxWorkflowRunCostUsd: maxRun,
            concurrentJobsPerUser: 3,
          },
        });
      })
  );
}

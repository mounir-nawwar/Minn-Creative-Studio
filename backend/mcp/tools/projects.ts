/**
 * Read-only project tools: list_projects, get_project, get_usage_summary.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { projects, workflows, assets, usageLogs } from '../../services/database.ts';
import { guard } from '../guard.ts';
import type { ToolContext } from '../server.ts';
import { jsonResult, errorResult } from './util.ts';

function toProjectSummary(row: any, callerUserId: string) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    ownerUserId: row.user_id,
    ownerIsCaller: row.user_id === callerUserId,
    status: row.settings?.status ?? null,
    usage: row.usage ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function registerProjectTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description:
        'List every client project in the shared studio workspace (name, description, owner, usage totals). ' +
        "The hidden scratch project id 'playground' is not listed but can be passed to other tools directly.",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    (_args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'list_projects', {}, async () => {
        const rows = projects.findAll();
        return jsonResult(
          { projects: rows.map((row) => toProjectSummary(row, ctx.user.id)) },
          `${rows.length} project(s)`
        );
      })
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get project',
      description:
        'Fetch one project by id, including its brand settings (colors, style keywords, AI instructions), ' +
        'usage totals, and workflow/asset counts.',
      inputSchema: { projectId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'get_project', args, async () => {
        const row = projects.findById(args.projectId);
        if (!row) return errorResult(`Project not found: ${args.projectId}`);
        return jsonResult({
          ...toProjectSummary(row, ctx.user.id),
          settings: row.settings ?? null,
          workflowCount: workflows.findByProjectId(args.projectId).length,
          assetCount: assets.findByProjectId(args.projectId).length,
        });
      })
  );

  server.registerTool(
    'get_usage_summary',
    {
      title: 'Get usage summary',
      description:
        'Cost/usage report for a project: totals by generation type (image/video/audio/text) from the usage log, ' +
        'optionally windowed by ISO dates.',
      inputSchema: {
        projectId: z.string().min(1),
        startDate: z.string().datetime({ offset: true }).optional(),
        endDate: z.string().datetime({ offset: true }).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'get_usage_summary', args, async () => {
        const project = projects.findById(args.projectId);
        if (!project) return errorResult(`Project not found: ${args.projectId}`);

        const logs = usageLogs.getByProjectId(
          args.projectId,
          args.startDate ? new Date(args.startDate) : undefined,
          args.endDate ? new Date(args.endDate) : undefined
        );

        const byType: Record<string, { count: number; cost: number; tokens: number }> = {};
        let totalCost = 0;
        for (const log of logs) {
          const bucket = (byType[log.type] ??= { count: 0, cost: 0, tokens: 0 });
          bucket.count += 1;
          bucket.cost += log.cost ?? 0;
          bucket.tokens += log.token_count ?? 0;
          totalCost += log.cost ?? 0;
        }

        return jsonResult({
          projectId: args.projectId,
          entries: logs.length,
          totals: { cost: Number(totalCost.toFixed(4)), byType },
          projectUsage: project.usage ?? {},
        });
      })
  );
}

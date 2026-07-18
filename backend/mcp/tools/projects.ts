/**
 * Project tools: list_projects, get_project, get_usage_summary (read) and
 * create_project, update_project (write). Brand fields go into the same
 * `settings` JSON the app's project wizard writes, so a project Claude creates
 * is indistinguishable from one made in the UI — and buildProjectContext picks
 * it up automatically for every later generation.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { projects, workflows, assets, usageLogs, generateId, PLAYGROUND_PROJECT_ID } from '../../services/database.ts';
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

/** Brand-identity fields — mirrors the app's project wizard (toApiProject settings). */
const brandFields = {
  type: z.string().optional().describe("e.g. 'fashion', 'branding', 'product', 'content'"),
  subtype: z.string().optional(),
  clientName: z.string().optional(),
  clientIndustry: z.string().optional(),
  targetAudience: z.string().optional(),
  brandPersonality: z.array(z.string()).optional().describe("e.g. ['luxurious','minimalist']"),
  visualMood: z.array(z.string()).optional().describe("e.g. ['minimal','editorial','luxury']"),
  primaryColor: z.string().optional().describe('hex, e.g. #101010'),
  secondaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  fontStyle: z.string().optional(),
  styleKeywords: z.string().optional().describe('comma-separated'),
  negativeKeywords: z.string().optional().describe('comma-separated — things to avoid'),
  aiInstructions: z.string().optional().describe('freeform master brief injected into every generation'),
  platforms: z.array(z.string()).optional(),
};

/** Drop undefined keys so update_project merges cleanly onto existing settings. */
function pickBrandSettings(args: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(brandFields)) {
    if (args[key] !== undefined) out[key] = args[key];
  }
  return out;
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

  server.registerTool(
    'create_project',
    {
      title: 'Create a project',
      description:
        'Create a new client project with its brand identity (colors, style keywords, negative keywords, target ' +
        'audience, AI instructions). Everything except name is optional, but the more brand detail you set, the more ' +
        'on-brand every later generation into this project will be — the brand context is injected automatically. ' +
        'Returns the new projectId to pass to generation and graph tools.',
      inputSchema: {
        name: z.string().min(1).max(120),
        description: z.string().max(4000).optional(),
        ...brandFields,
      },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'create_project', args, async () => {
        const settings = { ...pickBrandSettings(args), status: 'active' };
        const id = generateId();
        projects.create(id, ctx.user.id, args.name, args.description, settings);
        return jsonResult(
          { projectId: id, name: args.name, settings },
          `Created project "${args.name}"`
        );
      })
  );

  server.registerTool(
    'update_project',
    {
      title: 'Update a project',
      description:
        "Change a project's name, description, or brand identity. Only the fields you pass are changed — brand " +
        'settings are merged onto the existing ones, so you can fill in colors or AI instructions on a project that ' +
        'was created bare. The playground cannot be edited.',
      inputSchema: {
        projectId: z.string().min(1),
        name: z.string().min(1).max(120).optional(),
        description: z.string().max(4000).optional(),
        ...brandFields,
      },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'update_project', args, async () => {
        if (args.projectId === PLAYGROUND_PROJECT_ID) {
          return errorResult('The playground is a shared scratch space and cannot be edited.');
        }
        const existing = projects.findById(args.projectId);
        if (!existing) return errorResult(`Project not found: ${args.projectId}`);

        const mergedSettings = { ...(existing.settings ?? {}), ...pickBrandSettings(args) };
        projects.update(args.projectId, {
          ...(args.name !== undefined && { name: args.name }),
          ...(args.description !== undefined && { description: args.description }),
          settings: mergedSettings,
        });
        const updated = projects.findById(args.projectId);
        return jsonResult(
          { projectId: args.projectId, ...toProjectSummary(updated, ctx.user.id), settings: updated.settings },
          'Project updated'
        );
      })
  );
}

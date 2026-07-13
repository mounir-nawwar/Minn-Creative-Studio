/**
 * Read-only workflow (canvas graph) tools: list_workflows, get_workflow.
 * Full graph JSON comes back from get_workflow; listings return counts only
 * because node data can embed large output payloads.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { projects, workflows } from '../../services/database.ts';
import { guard } from '../guard.ts';
import type { ToolContext } from '../server.ts';
import { jsonResult, errorResult } from './util.ts';

function toWorkflowSummary(row: any) {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    nodeCount: Array.isArray(row.nodes) ? row.nodes.length : 0,
    edgeCount: Array.isArray(row.edges) ? row.edges.length : 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function registerWorkflowTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'list_workflows',
    {
      title: 'List workflows',
      description:
        'List canvas workflows (node pipelines). Pass projectId to scope to one project ' +
        "(including 'playground'); omit it to list workflows across every client project.",
      inputSchema: { projectId: z.string().min(1).optional() },
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'list_workflows', args, async () => {
        if (args.projectId) {
          if (!projects.findById(args.projectId)) {
            return errorResult(`Project not found: ${args.projectId}`);
          }
          const rows = workflows.findByProjectId(args.projectId);
          return jsonResult({ workflows: rows.map(toWorkflowSummary) }, `${rows.length} workflow(s)`);
        }
        const all = projects.findAll().flatMap((project) => workflows.findByProjectId(project.id));
        return jsonResult({ workflows: all.map(toWorkflowSummary) }, `${all.length} workflow(s) across all projects`);
      })
  );

  server.registerTool(
    'get_workflow',
    {
      title: 'Get workflow',
      description:
        'Fetch one workflow with its full React Flow graph: nodes ({id, type, position, data.config, data.output}) ' +
        'and edges ({source, sourceHandle, target, targetHandle}). This is exactly what the Canvas renders.',
      inputSchema: { workflowId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'get_workflow', args, async () => {
        const row = workflows.findById(args.workflowId);
        if (!row) return errorResult(`Workflow not found: ${args.workflowId}`);
        return jsonResult({
          id: row.id,
          projectId: row.project_id,
          name: row.name,
          nodes: row.nodes,
          edges: row.edges,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        });
      })
  );
}

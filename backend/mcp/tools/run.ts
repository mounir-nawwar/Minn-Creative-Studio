/**
 * Pipeline execution tools: run_workflow, run_node, cancel_run.
 *
 * run_workflow starts a background run (workflows take minutes — far past
 * Cloudflare's window) and returns a jobId; poll it with check_job, which
 * reports per-node progress. Outputs are written into the workflow as each
 * node finishes, so the Canvas fills in live.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { workflows } from '../../services/database.ts';
import { runWorkflow, runSingleNode, planRun, supportedNodeTypes, type NodeRunResult } from '../../services/graphRunner.ts';
import { jobStore } from '../jobs.ts';
import { guard } from '../guard.ts';
import type { ToolContext } from '../server.ts';
import { jsonResult, errorResult } from './util.ts';

/** Fuse against a runaway plan (e.g. Claude queueing 40 Veo clips by accident). */
const DEFAULT_MAX_RUN_COST_USD = 5;

function maxRunCost(): number {
  const configured = Number(process.env.MCP_MAX_RUN_COST_USD);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_MAX_RUN_COST_USD;
}

/** In-memory cancel flags — a restart fails running jobs at boot anyway. */
const cancelled = new Set<string>();

export function registerRunTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'run_workflow',
    {
      title: 'Run a workflow',
      description:
        'Execute a canvas pipeline server-side: every node runs in dependency order and its result is written back ' +
        'into the graph (visible in the Canvas). Returns a jobId immediately — poll check_job for per-node progress. ' +
        'Estimated cost is checked first; expensive plans need confirmCost:true. Pixel-editing nodes (crop/blur/…) ' +
        'have no server executor and are reported as skipped.',
      inputSchema: {
        workflowId: z.string().min(1),
        targetNodeIds: z.array(z.string()).max(30).optional().describe('Run only these nodes and their ancestors (default: everything)'),
        confirmCost: z.boolean().optional().describe(`Required when the estimate exceeds $${maxRunCost()}`),
      },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'run_workflow', args, async () => {
        const workflow = workflows.findById(args.workflowId);
        if (!workflow) return errorResult(`Workflow not found: ${args.workflowId}`);
        if (jobStore.countRunningOfKind(ctx.user.id, 'workflow') > 0) {
          return errorResult('You already have a workflow run in flight — check_job it (or cancel_run) first.');
        }

        let plan;
        try {
          plan = planRun(workflow.nodes ?? [], workflow.edges ?? [], args.targetNodeIds);
        } catch (err: unknown) {
          return errorResult(err instanceof Error ? err.message : String(err));
        }
        if (!plan.order.length) return errorResult('Nothing to run — the workflow has no nodes.');

        const ceiling = maxRunCost();
        if (plan.estimatedCostUsd > ceiling && args.confirmCost !== true) {
          return errorResult(
            `This run is estimated at $${plan.estimatedCostUsd.toFixed(2)}, above the $${ceiling.toFixed(2)} ceiling. ` +
              'Re-run with confirmCost:true to proceed.'
          );
        }

        const jobId = jobStore.createJob({
          userId: ctx.user.id,
          projectId: workflow.project_id,
          kind: 'workflow',
          operationName: `workflow:${args.workflowId}`,
          params: { workflowId: args.workflowId, order: plan.order },
        });

        // Fire-and-forget: the tool call returns now; check_job reports progress.
        void (async () => {
          const results: NodeRunResult[] = [];
          try {
            await runWorkflow(
              {
                workflowId: args.workflowId,
                projectId: workflow.project_id,
                userId: ctx.user.id,
                isCancelled: () => cancelled.has(jobId),
                onProgress: (result, completed, total) => {
                  results.push(result);
                  jobStore.updateProgress(jobId, { completed, total, currentNode: result.nodeId, results });
                },
              },
              args.targetNodeIds
            );
            if (cancelled.has(jobId)) {
              jobStore.markError(jobId, 'Run cancelled');
            } else {
              jobStore.markDone(jobId, {
                results,
                summary: {
                  ok: results.filter((r) => r.status === 'ok').length,
                  skipped: results.filter((r) => r.status === 'skipped').length,
                  errors: results.filter((r) => r.status === 'error').length,
                },
              });
            }
          } catch (err: unknown) {
            jobStore.markError(jobId, err instanceof Error ? err.message : String(err));
          } finally {
            cancelled.delete(jobId);
          }
        })();

        return jsonResult(
          {
            jobId,
            status: 'running',
            plan: { order: plan.order, estimatedCostUsd: plan.estimatedCostUsd, unsupported: plan.unsupported },
            pollEverySeconds: 10,
          },
          `Running ${plan.order.length} node(s)`
        );
      })
  );

  server.registerTool(
    'run_node',
    {
      title: 'Run a single node',
      description:
        'Execute one node using whatever its upstream nodes already produced (no dependency resolution). ' +
        'Synchronous — do not use it for veo/imageToVideo, which take minutes; run those via run_workflow.',
      inputSchema: { workflowId: z.string().min(1), nodeId: z.string().min(1) },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'run_node', args, async () => {
        const workflow = workflows.findById(args.workflowId);
        if (!workflow) return errorResult(`Workflow not found: ${args.workflowId}`);
        const result = await runSingleNode(
          { workflowId: args.workflowId, projectId: workflow.project_id, userId: ctx.user.id },
          args.nodeId
        );
        if (result.status === 'error') return errorResult(`Node ${args.nodeId} failed: ${result.reason}`);
        return jsonResult(result, result.status === 'ok' ? 'Node ran' : 'Node skipped');
      })
  );

  server.registerTool(
    'cancel_run',
    {
      title: 'Cancel a workflow run',
      description: 'Stop a running workflow between nodes. Nodes already finished keep their outputs.',
      inputSchema: { jobId: z.string().min(1) },
    },
    (args, extra) =>
      guard({ userId: ctx.user.id, sessionId: extra.sessionId }, 'cancel_run', args, async () => {
        const job = jobStore.getJob(args.jobId);
        if (!job || job.kind !== 'workflow') return errorResult(`Workflow run not found: ${args.jobId}`);
        if (job.status !== 'running') return errorResult(`That run is already ${job.status}.`);
        cancelled.add(args.jobId);
        return jsonResult({ jobId: args.jobId, status: 'cancelling' }, 'Cancelling after the current node');
      })
  );

  void supportedNodeTypes;
}

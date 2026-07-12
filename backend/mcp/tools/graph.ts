/**
 * Graph tools — build and edit Canvas workflows through MCP.
 *
 * Writes go through the same `workflows` repo the canvas auto-save uses, in
 * the exact node/edge shape the canvas serializes, so anything built here IS
 * the graph the user sees (and can Run) in the Canvas UI.
 *
 * Validation strategy: single-item edits (add_node / connect_nodes) validate
 * the delta plus cycle safety, so a legacy graph with oddities never blocks a
 * small edit; set_workflow and validate_workflow run the full-graph report.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { projects, workflows, generateId } from '../../services/database.ts';
import { auditLog } from '../audit.ts';
import type { ToolContext } from '../server.ts';
import { jsonResult, errorResult } from './util.ts';
import {
  validateEdge,
  validateGraph,
  autoLayout,
  findCycle,
  knownNodeType,
  type GraphNode,
  type GraphEdge,
} from '../graph/validate.ts';
import { NODE_CATALOG, describeNodeType, listNodeTypes } from '../graph/nodeCatalog.ts';

const positionSchema = z.object({ x: z.number().finite(), y: z.number().finite() });

function loadWorkflow(workflowId: string) {
  return workflows.findById(workflowId) as
    | { id: string; project_id: string; name: string; nodes: GraphNode[]; edges: GraphEdge[]; updated_at: string }
    | undefined;
}

function saveGraph(workflowId: string, nodes: GraphNode[], edges: GraphEdge[]) {
  workflows.update(workflowId, { nodes, edges });
  const row = loadWorkflow(workflowId)!;
  return { updatedAt: row.updated_at, nodeCount: nodes.length, edgeCount: edges.length };
}

/** Same convention the canvas uses (`${type}-${Date.now()}`), collision-safe. */
function mintNodeId(type: string, existing: GraphNode[]): string {
  const taken = new Set(existing.map((n) => n.id));
  let id = `${type}-${Date.now()}`;
  let bump = 0;
  while (taken.has(id)) id = `${type}-${Date.now()}-${++bump}`;
  return id;
}

function mintEdgeId(edge: Omit<GraphEdge, 'id'>, existing: GraphEdge[]): string {
  const taken = new Set(existing.map((e) => e.id));
  const base = `e-${edge.source}-${edge.sourceHandle ?? 'out'}-${edge.target}-${edge.targetHandle ?? 'in'}`;
  let id = base;
  let bump = 0;
  while (taken.has(id)) id = `${base}-${++bump}`;
  return id;
}

/**
 * Canvas-shaped node data. For value nodes the catalog names the config key
 * that doubles as the node's output (e.g. prompt.prompt) — writing it into
 * data.output means downstream nodes can Run without a human pressing Run on
 * the value node first.
 */
function buildNodeData(type: string, config: Record<string, unknown> = {}, label?: string): GraphNode['data'] {
  const data: GraphNode['data'] = { label: label ?? type, type, config: { ...config } };
  const outputKey = NODE_CATALOG[type as keyof typeof NODE_CATALOG]?.outputFromConfig;
  if (outputKey && config[outputKey] !== undefined) data.output = config[outputKey];
  return data;
}

function nextFreePosition(nodes: GraphNode[]): { x: number; y: number } {
  if (!nodes.length) return { x: 80, y: 80 };
  const maxX = Math.max(...nodes.map((n) => n.position?.x ?? 0));
  return { x: maxX + 340, y: 80 };
}

export function registerGraphTools(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'describe_node_types',
    {
      title: 'Describe canvas node types',
      description:
        'The node-graph language: every node type with its input/output handles, connection rules, and known ' +
        'config fields. Call this BEFORE building workflows. Pass nodeType for one node, omit for the full list ' +
        '(names only) plus details for the most-used nodes.',
      inputSchema: { nodeType: z.string().optional() },
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'describe_node_types', args, async () => {
        if (args.nodeType) {
          const info = describeNodeType(args.nodeType);
          if (!info) return errorResult(`Unknown node type: ${args.nodeType}. Valid: ${listNodeTypes().join(', ')}`);
          return jsonResult(info);
        }
        return jsonResult({
          allNodeTypes: listNodeTypes(),
          documented: Object.keys(NODE_CATALOG).map((type) => describeNodeType(type)),
          conventions: {
            nodeShape: "{ id, type, position: {x,y}, data: { label, type, config, output? } }",
            edgeShape: '{ id, source, sourceHandle, target, targetHandle }',
            wiring:
              'Generators read inputs from edges: prompts via the prompt handle, reference images via reference, ' +
              'seeds via seed. Value nodes (prompt/seed/number/imageUpload) carry their value in config AND data.output.',
          },
        });
      })
  );

  server.registerTool(
    'create_workflow',
    {
      title: 'Create a workflow',
      description: "Create an empty canvas workflow in a project (or 'playground'). Add nodes with add_node or set_workflow.",
      inputSchema: { projectId: z.string().min(1), name: z.string().min(1).max(120) },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'create_workflow', args, async () => {
        if (!projects.findById(args.projectId)) return errorResult(`Project not found: ${args.projectId}`);
        const id = generateId();
        workflows.create(id, args.projectId, ctx.user.id, args.name, [], []);
        return jsonResult({ workflowId: id, projectId: args.projectId, name: args.name }, 'Workflow created');
      })
  );

  server.registerTool(
    'add_node',
    {
      title: 'Add a node',
      description:
        'Add one node to a workflow. Position is optional (placed to the right of existing nodes — run auto_layout ' +
        'when done). Config keys per node type come from describe_node_types.',
      inputSchema: {
        workflowId: z.string().min(1),
        nodeType: z.string().min(1),
        config: z.record(z.string(), z.unknown()).optional(),
        label: z.string().max(80).optional(),
        position: positionSchema.optional(),
      },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'add_node', args, async () => {
        const workflow = loadWorkflow(args.workflowId);
        if (!workflow) return errorResult(`Workflow not found: ${args.workflowId}`);
        if (!knownNodeType(args.nodeType)) {
          return errorResult(`Unknown node type: ${args.nodeType}. Valid: ${listNodeTypes().join(', ')}`);
        }
        const nodeId = mintNodeId(args.nodeType, workflow.nodes);
        const node: GraphNode = {
          id: nodeId,
          type: args.nodeType,
          position: args.position ?? nextFreePosition(workflow.nodes),
          data: buildNodeData(args.nodeType, args.config ?? {}, args.label),
        };
        const saved = saveGraph(args.workflowId, [...workflow.nodes, node], workflow.edges);
        return jsonResult({ nodeId, ...saved }, `Added ${args.nodeType} node`);
      })
  );

  server.registerTool(
    'update_node',
    {
      title: 'Update a node',
      description: "Shallow-merge config keys into a node (and/or move it, relabel it). Doesn't touch other keys.",
      inputSchema: {
        workflowId: z.string().min(1),
        nodeId: z.string().min(1),
        config: z.record(z.string(), z.unknown()).optional(),
        label: z.string().max(80).optional(),
        position: positionSchema.optional(),
      },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'update_node', args, async () => {
        const workflow = loadWorkflow(args.workflowId);
        if (!workflow) return errorResult(`Workflow not found: ${args.workflowId}`);
        const existing = workflow.nodes.find((n) => n.id === args.nodeId);
        if (!existing) return errorResult(`Node not found: ${args.nodeId}`);

        const mergedConfig = { ...(existing.data?.config ?? {}), ...(args.config ?? {}) };
        const outputKey = NODE_CATALOG[existing.type as keyof typeof NODE_CATALOG]?.outputFromConfig;
        const nodes = workflow.nodes.map((n) =>
          n.id === args.nodeId
            ? {
                ...n,
                position: args.position ?? n.position,
                data: {
                  ...n.data,
                  ...(args.label ? { label: args.label } : {}),
                  config: mergedConfig,
                  ...(outputKey && args.config && args.config[outputKey] !== undefined
                    ? { output: args.config[outputKey] }
                    : {}),
                },
              }
            : n
        );
        const saved = saveGraph(args.workflowId, nodes, workflow.edges);
        return jsonResult({ nodeId: args.nodeId, ...saved }, 'Node updated');
      })
  );

  server.registerTool(
    'remove_node',
    {
      title: 'Remove a node',
      description: 'Delete a node and every edge touching it.',
      inputSchema: { workflowId: z.string().min(1), nodeId: z.string().min(1) },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'remove_node', args, async () => {
        const workflow = loadWorkflow(args.workflowId);
        if (!workflow) return errorResult(`Workflow not found: ${args.workflowId}`);
        if (!workflow.nodes.some((n) => n.id === args.nodeId)) return errorResult(`Node not found: ${args.nodeId}`);
        const nodes = workflow.nodes.filter((n) => n.id !== args.nodeId);
        const edges = workflow.edges.filter((e) => e.source !== args.nodeId && e.target !== args.nodeId);
        const saved = saveGraph(args.workflowId, nodes, edges);
        return jsonResult({ nodeId: args.nodeId, ...saved }, 'Node removed');
      })
  );

  server.registerTool(
    'connect_nodes',
    {
      title: 'Connect two nodes',
      description:
        'Wire an output handle to an input handle. Validated exactly like the canvas (handle types, blocked pairs) ' +
        'plus duplicate and cycle protection. Handle ids per node come from describe_node_types. Multiple edges ' +
        'into the same reference handle are allowed (that is how multi-reference generation works).',
      inputSchema: {
        workflowId: z.string().min(1),
        sourceNodeId: z.string().min(1),
        sourceHandle: z.string().min(1),
        targetNodeId: z.string().min(1),
        targetHandle: z.string().min(1),
      },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'connect_nodes', args, async () => {
        const workflow = loadWorkflow(args.workflowId);
        if (!workflow) return errorResult(`Workflow not found: ${args.workflowId}`);

        const candidate: Omit<GraphEdge, 'id'> = {
          source: args.sourceNodeId,
          sourceHandle: args.sourceHandle,
          target: args.targetNodeId,
          targetHandle: args.targetHandle,
        };
        const duplicate = workflow.edges.some(
          (e) =>
            e.source === candidate.source &&
            e.sourceHandle === candidate.sourceHandle &&
            e.target === candidate.target &&
            e.targetHandle === candidate.targetHandle
        );
        if (duplicate) return errorResult('That exact connection already exists.');

        const edge: GraphEdge = { id: mintEdgeId(candidate, workflow.edges), ...candidate };
        const nodesById = new Map(workflow.nodes.map((n) => [n.id, n]));
        const verdict = validateEdge(edge, nodesById);
        if (!verdict.valid) return errorResult(verdict.message);

        const nextEdges = [...workflow.edges, edge];
        const cycle = findCycle(workflow.nodes, nextEdges);
        if (cycle.length) return errorResult(`That connection would create a cycle involving: ${cycle.join(', ')}`);

        const saved = saveGraph(args.workflowId, workflow.nodes, nextEdges);
        return jsonResult({ edgeId: edge.id, ...saved }, 'Connected');
      })
  );

  server.registerTool(
    'disconnect_nodes',
    {
      title: 'Remove an edge',
      description: 'Delete one edge by id (edge ids come from get_workflow or connect_nodes).',
      inputSchema: { workflowId: z.string().min(1), edgeId: z.string().min(1) },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'disconnect_nodes', args, async () => {
        const workflow = loadWorkflow(args.workflowId);
        if (!workflow) return errorResult(`Workflow not found: ${args.workflowId}`);
        if (!workflow.edges.some((e) => e.id === args.edgeId)) return errorResult(`Edge not found: ${args.edgeId}`);
        const saved = saveGraph(args.workflowId, workflow.nodes, workflow.edges.filter((e) => e.id !== args.edgeId));
        return jsonResult({ edgeId: args.edgeId, ...saved }, 'Disconnected');
      })
  );

  server.registerTool(
    'set_workflow',
    {
      title: 'Replace a whole workflow graph',
      description:
        'Write a complete pipeline in one call (nodes + edges). The whole graph is validated first — on any error ' +
        'nothing is saved and you get the full error list. Node data is normalized to canvas shape (label/type/' +
        'config, value nodes get data.output). Positions optional when autoLayout=true (default).',
      inputSchema: {
        workflowId: z.string().min(1),
        name: z.string().min(1).max(120).optional(),
        nodes: z.array(
          z.object({
            id: z.string().min(1),
            type: z.string().min(1),
            position: positionSchema.optional(),
            label: z.string().max(80).optional(),
            config: z.record(z.string(), z.unknown()).optional(),
          })
        ).max(60),
        edges: z.array(
          z.object({
            source: z.string().min(1),
            sourceHandle: z.string().min(1),
            target: z.string().min(1),
            targetHandle: z.string().min(1),
          })
        ).max(120),
        autoLayout: z.boolean().optional().describe('Default true — ignore/overwrite positions and lay out left-to-right'),
      },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'set_workflow', args, async () => {
        const workflow = loadWorkflow(args.workflowId);
        if (!workflow) return errorResult(`Workflow not found: ${args.workflowId}`);

        let nodes: GraphNode[] = args.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position ?? { x: 0, y: 0 },
          data: buildNodeData(n.type, n.config ?? {}, n.label),
        }));
        const edges: GraphEdge[] = args.edges.map((e) => ({ id: mintEdgeId(e, []), ...e }));

        const report = validateGraph(nodes, edges);
        if (!report.valid) {
          return errorResult(`Graph rejected — nothing saved:\n- ${report.errors.join('\n- ')}`);
        }
        if (args.autoLayout !== false) nodes = autoLayout(nodes, edges);

        if (args.name) workflows.update(args.workflowId, { name: args.name });
        const saved = saveGraph(args.workflowId, nodes, edges);
        return jsonResult(
          { ...saved, warnings: report.warnings, edgeIds: edges.map((e) => e.id) },
          `Graph saved (${nodes.length} nodes, ${edges.length} edges)`
        );
      })
  );

  server.registerTool(
    'validate_workflow',
    {
      title: 'Validate a workflow',
      description: 'Full dry-run report on an existing workflow: errors (would break) and warnings (probably unintended).',
      inputSchema: { workflowId: z.string().min(1) },
      annotations: { readOnlyHint: true },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'validate_workflow', args, async () => {
        const workflow = loadWorkflow(args.workflowId);
        if (!workflow) return errorResult(`Workflow not found: ${args.workflowId}`);
        return jsonResult(validateGraph(workflow.nodes, workflow.edges));
      })
  );

  server.registerTool(
    'auto_layout',
    {
      title: 'Auto-layout a workflow',
      description: 'Reposition all nodes left-to-right by dependency depth so the graph reads cleanly in the Canvas.',
      inputSchema: { workflowId: z.string().min(1) },
    },
    (args, extra) =>
      auditLog.wrap({ userId: ctx.user.id, sessionId: extra.sessionId }, 'auto_layout', args, async () => {
        const workflow = loadWorkflow(args.workflowId);
        if (!workflow) return errorResult(`Workflow not found: ${args.workflowId}`);
        const saved = saveGraph(args.workflowId, autoLayout(workflow.nodes, workflow.edges), workflow.edges);
        return jsonResult(saved, 'Laid out');
      })
  );
}

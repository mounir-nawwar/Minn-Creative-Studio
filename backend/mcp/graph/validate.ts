/**
 * Server-side graph validation for MCP-built workflows.
 *
 * Mirrors the canvas's connection validator (src/store/connection-validator.ts
 * `validateConnection`) against the SAME registries — NODE_HANDLES and
 * CONNECTION_VALIDATION_RULES are imported from the frontend source, so a
 * graph that passes here is a graph the canvas itself would allow. Adds
 * whole-graph checks the interactive canvas never needs: unique ids, dangling
 * edges, duplicates, and cycle detection.
 */

import { NODE_HANDLES } from '../../../src/types/nodeHandles.ts';
import { CONNECTION_VALIDATION_RULES } from '../../../src/types/validationRules.ts';
import type { NodeType } from '../../../src/types.ts';
import type { HandleDefinition } from '../../../src/types/handleTypes.ts';

export interface GraphNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: { label?: string; type?: string; config?: Record<string, unknown>; output?: unknown; outputs?: unknown[] } & Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  [key: string]: unknown;
}

export interface GraphValidationReport {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function knownNodeType(type: string): type is NodeType {
  return type !== 'default' && Object.prototype.hasOwnProperty.call(NODE_HANDLES, type);
}

export function handlesFor(type: string): { inputs: HandleDefinition[]; outputs: HandleDefinition[] } | null {
  return (NODE_HANDLES as Record<string, { inputs: HandleDefinition[]; outputs: HandleDefinition[] }>)[type] ?? null;
}

/**
 * Same semantics as the canvas validateConnection: handle resolution with
 * first-handle fallback, blocked pairs, allowedOutputs/allowedInputs, the
 * 'unknown' wildcard, then strict type equality.
 */
export function validateEdge(edge: GraphEdge, nodesById: Map<string, GraphNode>): { valid: boolean; message: string } {
  const sourceNode = nodesById.get(edge.source);
  const targetNode = nodesById.get(edge.target);
  if (!sourceNode || !targetNode) {
    return { valid: false, message: `Edge ${edge.id}: source or target node not found` };
  }
  if (sourceNode.id === targetNode.id) {
    return { valid: false, message: `Edge ${edge.id}: cannot connect node to itself` };
  }

  const sourceHandles = handlesFor(sourceNode.type);
  const targetHandles = handlesFor(targetNode.type);
  if (!sourceHandles || !targetHandles) {
    return { valid: false, message: `Edge ${edge.id}: unknown node type configuration` };
  }

  const sourceHandle = edge.sourceHandle
    ? sourceHandles.outputs.find((h) => h.id === edge.sourceHandle)
    : sourceHandles.outputs[0];
  const targetHandle = edge.targetHandle
    ? targetHandles.inputs.find((h) => h.id === edge.targetHandle)
    : targetHandles.inputs[0];

  if (!sourceHandle) {
    return {
      valid: false,
      message: sourceHandles.outputs.length > 0
        ? `Edge ${edge.id}: invalid source handle '${edge.sourceHandle}' on ${sourceNode.type} (valid: ${sourceHandles.outputs.map((h) => h.id).join(', ')})`
        : `Edge ${edge.id}: ${sourceNode.type} node has no output handles`,
    };
  }
  if (!targetHandle) {
    return {
      valid: false,
      message: targetHandles.inputs.length > 0
        ? `Edge ${edge.id}: invalid target handle '${edge.targetHandle}' on ${targetNode.type} (valid: ${targetHandles.inputs.map((h) => h.id).join(', ')})`
        : `Edge ${edge.id}: ${targetNode.type} node has no input handles`,
    };
  }

  const targetRules = CONNECTION_VALIDATION_RULES[targetNode.type];
  const blocked = targetRules?.blockedConnections?.find(
    (block) => block.from === sourceNode.type && block.to === targetNode.type
  );
  if (blocked) {
    return { valid: false, message: `Edge ${edge.id}: ${blocked.reason}` };
  }

  const sourceRules = CONNECTION_VALIDATION_RULES[sourceNode.type];
  if (sourceRules?.allowedOutputs?.length && !sourceRules.allowedOutputs.includes(sourceHandle.type)) {
    return { valid: false, message: `Edge ${edge.id}: ${sourceNode.type} node cannot output ${sourceHandle.type} type` };
  }
  if (targetRules?.allowedInputs?.length && !targetRules.allowedInputs.includes(targetHandle.type)) {
    return { valid: false, message: `Edge ${edge.id}: ${targetNode.type} node cannot accept ${targetHandle.type} type` };
  }

  if (sourceHandle.type === 'unknown' || targetHandle.type === 'unknown') return { valid: true, message: '' };
  if (sourceHandle.type === targetHandle.type) return { valid: true, message: '' };
  return {
    valid: false,
    message: `Edge ${edge.id}: type mismatch ${sourceHandle.type} → ${targetHandle.type} (${sourceNode.type}.${sourceHandle.id} → ${targetNode.type}.${targetHandle.id})`,
  };
}

/** Kahn's algorithm; returns node ids left un-sorted when a cycle exists. */
export function findCycle(nodes: GraphNode[], edges: GraphEdge[]): string[] {
  const indegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
  }
  const queue = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  let visited = 0;
  while (queue.length) {
    const id = queue.shift()!;
    visited++;
    for (const next of adjacency.get(id) ?? []) {
      const deg = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }
  if (visited === nodes.length) return [];
  return nodes.filter((n) => (indegree.get(n.id) ?? 0) > 0).map((n) => n.id);
}

/** Generators that are inert without a prompt feeding them (edge or config). */
const PROMPT_HUNGRY: Record<string, string> = {
  imagen: 'prompt',
  nanoBanana: 'prompt',
  veo: 'prompt',
  lyria: 'prompt',
  llm: 'text',
};

export function validateGraph(nodes: GraphNode[], edges: GraphEdge[]): GraphValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const seenNodeIds = new Set<string>();
  for (const node of nodes) {
    if (!node.id) errors.push('A node is missing an id');
    if (seenNodeIds.has(node.id)) errors.push(`Duplicate node id: ${node.id}`);
    seenNodeIds.add(node.id);

    if (!knownNodeType(node.type)) {
      errors.push(`Node ${node.id}: unknown node type '${node.type}'`);
      continue;
    }
    if (!Number.isFinite(node.position?.x) || !Number.isFinite(node.position?.y)) {
      errors.push(`Node ${node.id}: position.x/y must be finite numbers`);
    }
    if (node.data?.type && node.data.type !== node.type) {
      errors.push(`Node ${node.id}: data.type '${node.data.type}' must match node type '${node.type}'`);
    }
  }

  const nodesById = new Map(nodes.map((n) => [n.id, n]));
  const seenEdgeIds = new Set<string>();
  const seenConnections = new Set<string>();
  for (const edge of edges) {
    if (seenEdgeIds.has(edge.id)) errors.push(`Duplicate edge id: ${edge.id}`);
    seenEdgeIds.add(edge.id);

    const connectionKey = `${edge.source}|${edge.sourceHandle ?? ''}|${edge.target}|${edge.targetHandle ?? ''}`;
    if (seenConnections.has(connectionKey)) {
      errors.push(`Duplicate connection: ${edge.source}.${edge.sourceHandle} → ${edge.target}.${edge.targetHandle}`);
    }
    seenConnections.add(connectionKey);

    const result = validateEdge(edge, nodesById);
    if (!result.valid) errors.push(result.message);
  }

  const cycle = findCycle(nodes, edges);
  if (cycle.length) errors.push(`Graph contains a cycle involving: ${cycle.join(', ')}`);

  for (const node of nodes) {
    const promptHandle = PROMPT_HUNGRY[node.type];
    if (!promptHandle) continue;
    const hasPromptEdge = edges.some((e) => e.target === node.id && e.targetHandle === promptHandle);
    const hasConfigPrompt = typeof node.data?.config?.prompt === 'string' && node.data.config.prompt;
    if (!hasPromptEdge && !hasConfigPrompt) {
      warnings.push(`Node ${node.id} (${node.type}): no '${promptHandle}' input connected — wire a prompt/text node so Run has something to work with`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Deterministic left-to-right layout: columns by dependency depth
 * (longest path from any source), rows in stable node order.
 */
export function autoLayout(nodes: GraphNode[], edges: GraphEdge[]): GraphNode[] {
  const depth = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  }
  // Relax depths |V| times (graphs are small; cycles were rejected upstream)
  for (let i = 0; i < nodes.length; i++) {
    for (const edge of edges) {
      const proposed = (depth.get(edge.source) ?? 0) + 1;
      if (proposed > (depth.get(edge.target) ?? 0)) depth.set(edge.target, proposed);
    }
  }

  const COLUMN_WIDTH = 340;
  const ROW_HEIGHT = 240;
  const MARGIN = 80;
  const rowIndexByColumn = new Map<number, number>();

  return nodes.map((node) => {
    const column = depth.get(node.id) ?? 0;
    const row = rowIndexByColumn.get(column) ?? 0;
    rowIndexByColumn.set(column, row + 1);
    return {
      ...node,
      position: { x: MARGIN + column * COLUMN_WIDTH, y: MARGIN + row * ROW_HEIGHT },
    };
  });
}

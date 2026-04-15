import { z } from 'zod';

export interface ValidatedNode {
  id: string;
  type?: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface ValidatedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface ValidatedWorkflow {
  id?: string;
  name?: string;
  nodes: ValidatedNode[];
  edges: ValidatedEdge[];
  projectId?: string;
  userId?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  thumbnailUrl?: string | null;
}

function parsePosition(pos: unknown): { x: number; y: number } {
  if (typeof pos === 'object' && pos !== null) {
    const p = pos as Record<string, unknown>;
    const x = typeof p.x === 'number' ? p.x : typeof p.x === 'string' ? parseFloat(p.x) || 0 : 0;
    const y = typeof p.y === 'number' ? p.y : typeof p.y === 'string' ? parseFloat(p.y) || 0 : 0;
    return { x, y };
  }
  return { x: 0, y: 0 };
}

function parseNode(node: unknown): ValidatedNode | null {
  if (typeof node !== 'object' || node === null) return null;
  const n = node as Record<string, unknown>;
  
  const id = n.id != null ? String(n.id) : null;
  if (!id) return null;
  
  return {
    id,
    type: typeof n.type === 'string' ? n.type : undefined,
    position: parsePosition(n.position),
    data: typeof n.data === 'object' && n.data !== null ? n.data as Record<string, unknown> : {},
  };
}

function parseEdge(edge: unknown): ValidatedEdge | null {
  if (typeof edge !== 'object' || edge === null) return null;
  const e = edge as Record<string, unknown>;
  
  const id = e.id != null ? String(e.id) : null;
  const source = e.source != null ? String(e.source) : null;
  const target = e.target != null ? String(e.target) : null;
  
  if (!id || !source || !target) return null;
  
  return {
    id,
    source,
    target,
    sourceHandle: e.sourceHandle != null ? String(e.sourceHandle) : undefined,
    targetHandle: e.targetHandle != null ? String(e.targetHandle) : undefined,
  };
}

export function validateWorkflow(data: unknown): ValidatedWorkflow | null {
  if (typeof data !== 'object' || data === null) {
    console.error('[Workflow Validation] Invalid workflow data: not an object');
    return null;
  }
  
  const w = data as Record<string, unknown>;
  
  const nodes: ValidatedNode[] = [];
  if (Array.isArray(w.nodes)) {
    for (const node of w.nodes) {
      const parsed = parseNode(node);
      if (parsed) nodes.push(parsed);
    }
  }
  
  const edges: ValidatedEdge[] = [];
  if (Array.isArray(w.edges)) {
    for (const edge of w.edges) {
      const parsed = parseEdge(edge);
      if (parsed) edges.push(parsed);
    }
  }
  
  return {
    id: typeof w.id === 'string' ? w.id : undefined,
    name: typeof w.name === 'string' ? w.name : undefined,
    nodes,
    edges,
    projectId: typeof w.projectId === 'string' ? w.projectId : undefined,
    userId: typeof w.userId === 'string' ? w.userId : undefined,
    createdAt: w.createdAt,
    updatedAt: w.updatedAt,
    thumbnailUrl: w.thumbnailUrl != null ? String(w.thumbnailUrl) : undefined,
  };
}

export function validateNodes(nodes: unknown[]): ValidatedNode[] {
  const validated: ValidatedNode[] = [];
  for (const node of nodes) {
    const parsed = parseNode(node);
    if (parsed) validated.push(parsed);
  }
  return validated;
}

export function validateEdges(edges: unknown[]): ValidatedEdge[] {
  const validated: ValidatedEdge[] = [];
  for (const edge of edges) {
    const parsed = parseEdge(edge);
    if (parsed) validated.push(parsed);
  }
  return validated;
}

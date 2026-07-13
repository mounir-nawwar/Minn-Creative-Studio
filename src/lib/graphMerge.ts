import type { Edge, Node } from 'reactflow';
import type { WorkflowNodeData } from '../types';

/**
 * Merge a server graph into the canvas while the user is mid-edit
 * (see src/hooks/useWorkflowSync.ts).
 *
 * Bias: never lose work. Local edits win for the things a human is actively
 * manipulating (position, config, label); the server wins for generated
 * results (output/outputs/error), which only the backend produces; additions
 * from either side are kept. Deletions are deliberately NOT propagated while
 * dirty — dropping a node someone is editing is worse than briefly showing one
 * they deleted elsewhere (a clean reload reconciles it).
 *
 * Kept dependency-free so it stays unit-testable.
 */

export type CanvasNode = Node<WorkflowNodeData>;

export interface CanvasGraph {
  nodes: CanvasNode[];
  edges: Edge[];
}

function withRemoteResults(local: CanvasNode, remote: CanvasNode): CanvasNode {
  const sameOutput = local.data?.output === remote.data?.output;
  const sameError = (local.data?.error ?? null) === (remote.data?.error ?? null);
  if (sameOutput && sameError) return local;
  return {
    ...local,
    data: {
      ...local.data,
      output: remote.data?.output,
      outputs: remote.data?.outputs,
      error: remote.data?.error ?? null,
    },
  };
}

export function mergeGraphs(local: CanvasGraph, remote: CanvasGraph): CanvasGraph & { changed: boolean } {
  const localNodeIds = new Set(local.nodes.map((n) => n.id));
  const remoteById = new Map(remote.nodes.map((n) => [n.id, n]));

  const mergedNodes = local.nodes.map((node) => {
    const remoteNode = remoteById.get(node.id);
    return remoteNode ? withRemoteResults(node, remoteNode) : node;
  });
  const addedNodes = remote.nodes.filter((n) => !localNodeIds.has(n.id));

  const localEdgeIds = new Set(local.edges.map((e) => e.id));
  const addedEdges = remote.edges.filter((e) => !localEdgeIds.has(e.id));

  const changed =
    addedNodes.length > 0 ||
    addedEdges.length > 0 ||
    mergedNodes.some((node, i) => node !== local.nodes[i]);

  return {
    nodes: [...mergedNodes, ...addedNodes],
    edges: [...local.edges, ...addedEdges],
    changed,
  };
}

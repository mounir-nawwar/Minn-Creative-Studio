import { describe, test, expect } from 'vitest';
import type { Edge } from 'reactflow';
import { mergeGraphs, type CanvasNode } from './graphMerge';
import type { WorkflowNodeData } from '../types';

function node(id: string, data: Partial<WorkflowNodeData> = {}, x = 0): CanvasNode {
  return {
    id,
    type: 'imagen',
    position: { x, y: 0 },
    data: { label: id, type: 'imagen', config: {}, ...data } as WorkflowNodeData,
  };
}
const edge = (id: string, source: string, target: string): Edge => ({ id, source, target });

describe('mergeGraphs (live sync into a dirty canvas)', () => {
  test('takes generated results from the server without touching local edits', () => {
    const local = { nodes: [node('a', { config: { prompt: 'my in-progress edit' } }, 500)], edges: [] };
    const remote = { nodes: [node('a', { config: { prompt: 'stale' }, output: '/storage/generated.png' })], edges: [] };

    const merged = mergeGraphs(local, remote);
    expect(merged.changed).toBe(true);
    // server result adopted…
    expect(merged.nodes[0].data.output).toBe('/storage/generated.png');
    // …while the user's own position and config survive
    expect(merged.nodes[0].position.x).toBe(500);
    expect(merged.nodes[0].data.config?.prompt).toBe('my in-progress edit');
  });

  test('adds nodes and edges the server has and we do not', () => {
    const local = { nodes: [node('a')], edges: [] };
    const remote = { nodes: [node('a'), node('b')], edges: [edge('e1', 'a', 'b')] };

    const merged = mergeGraphs(local, remote);
    expect(merged.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(merged.edges.map((e) => e.id)).toEqual(['e1']);
    expect(merged.changed).toBe(true);
  });

  test('never drops local nodes or edges the server lacks', () => {
    const local = { nodes: [node('a'), node('local-only')], edges: [edge('e-local', 'a', 'local-only')] };
    const remote = { nodes: [node('a')], edges: [] };

    const merged = mergeGraphs(local, remote);
    expect(merged.nodes.map((n) => n.id)).toContain('local-only');
    expect(merged.edges.map((e) => e.id)).toContain('e-local');
  });

  test('reports no change when the graphs already agree', () => {
    const local = { nodes: [node('a')], edges: [edge('e1', 'a', 'a')] };
    const remote = { nodes: [node('a')], edges: [edge('e1', 'a', 'a')] };
    expect(mergeGraphs(local, remote).changed).toBe(false);
  });

  test('propagates a server-side node error onto the local node', () => {
    const local = { nodes: [node('a')], edges: [] };
    const remote = { nodes: [node('a', { error: 'Prompt blocked' })], edges: [] };

    const merged = mergeGraphs(local, remote);
    expect(merged.nodes[0].data.error).toBe('Prompt blocked');
    expect(merged.changed).toBe(true);
  });
});

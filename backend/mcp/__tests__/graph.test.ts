// @vitest-environment node
import { describe, test, expect } from 'vitest';
import { validateEdge, validateGraph, autoLayout, findCycle, type GraphNode, type GraphEdge } from '../graph/validate.ts';
import { NODE_CATALOG, describeNodeType, listNodeTypes } from '../graph/nodeCatalog.ts';

function node(id: string, type: string, config: Record<string, unknown> = {}): GraphNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label: type, type, config } };
}

function edge(source: string, sourceHandle: string, target: string, targetHandle: string): GraphEdge {
  return { id: `e-${source}-${sourceHandle}-${target}-${targetHandle}`, source, sourceHandle, target, targetHandle };
}

const byId = (nodes: GraphNode[]) => new Map(nodes.map((n) => [n.id, n]));

describe('graph validation (mirrors the canvas validator)', () => {
  test('prompt → imagen.prompt is valid', () => {
    const nodes = [node('p1', 'prompt'), node('g1', 'imagen')];
    const result = validateEdge(edge('p1', 'prompt', 'g1', 'prompt'), byId(nodes));
    expect(result.valid).toBe(true);
  });

  test('imagen output cannot feed a seed node (blocked pair)', () => {
    const nodes = [node('g1', 'imagen'), node('s1', 'seed')];
    const result = validateEdge(edge('g1', 'image', 's1', 'input'), byId(nodes));
    expect(result.valid).toBe(false);
    expect(result.message).toContain('cannot feed back to seed');
  });

  test('type mismatch prompt → imagen.reference is rejected', () => {
    const nodes = [node('p1', 'prompt'), node('g1', 'imagen')];
    const result = validateEdge(edge('p1', 'prompt', 'g1', 'reference'), byId(nodes));
    expect(result.valid).toBe(false);
    expect(result.message).toContain('type mismatch');
  });

  test('anything can flow into the output node (unknown wildcard)', () => {
    const nodes = [node('g1', 'imagen'), node('o1', 'output')];
    expect(validateEdge(edge('g1', 'image', 'o1', 'input'), byId(nodes)).valid).toBe(true);
  });

  test('bogus handle ids are rejected with the valid list', () => {
    const nodes = [node('p1', 'prompt'), node('g1', 'imagen')];
    const result = validateEdge(edge('p1', 'nope', 'g1', 'prompt'), byId(nodes));
    expect(result.valid).toBe(false);
    expect(result.message).toContain("invalid source handle 'nope'");
  });

  test('self-connections are rejected', () => {
    const nodes = [node('g1', 'imagen')];
    expect(validateEdge(edge('g1', 'image', 'g1', 'reference'), byId(nodes)).valid).toBe(false);
  });

  test('validateGraph catches unknown types, duplicates, dangling edges, cycles', () => {
    const nodes = [node('a', 'prompt'), node('a', 'prompt'), node('b', 'notARealNode'), node('c', 'llm'), node('d', 'promptEnhancer')];
    const edges = [
      edge('a', 'prompt', 'missing', 'text'),
      // llm.text(text) → promptEnhancer.prompt is a type mismatch AND part of a cycle back via prompt
      edge('c', 'text', 'd', 'prompt'),
      edge('d', 'prompt', 'c', 'text'),
    ];
    const report = validateGraph(nodes, edges);
    expect(report.valid).toBe(false);
    expect(report.errors.join('\n')).toContain('Duplicate node id: a');
    expect(report.errors.join('\n')).toContain("unknown node type 'notARealNode'");
    expect(report.errors.join('\n')).toContain('source or target node not found');
    expect(report.errors.join('\n')).toContain('cycle');
  });

  test('a sane pipeline validates with a warning for the unfed generator', () => {
    const nodes = [node('p1', 'prompt', { prompt: 'a cat' }), node('g1', 'imagen'), node('g2', 'veo'), node('o1', 'output')];
    const edges = [
      edge('p1', 'prompt', 'g1', 'prompt'),
      edge('g1', 'image', 'g2', 'startFrame'),
      edge('g2', 'video', 'o1', 'input'),
    ];
    const report = validateGraph(nodes, edges);
    expect(report.valid).toBe(true);
    // veo has no prompt edge → warning, not error
    expect(report.warnings.join('\n')).toContain('g2 (veo)');
  });

  test('duplicate exact connections are errors', () => {
    const nodes = [node('p1', 'prompt'), node('g1', 'imagen')];
    const edges = [edge('p1', 'prompt', 'g1', 'prompt'), { ...edge('p1', 'prompt', 'g1', 'prompt'), id: 'other-id' }];
    const report = validateGraph(nodes, edges);
    expect(report.errors.join('\n')).toContain('Duplicate connection');
  });
});

describe('auto layout', () => {
  test('columns follow dependency depth, rows are stable', () => {
    const nodes = [node('p1', 'prompt'), node('s1', 'seed'), node('g1', 'imagen'), node('o1', 'output')];
    const edges = [
      edge('p1', 'prompt', 'g1', 'prompt'),
      edge('s1', 'seed', 'g1', 'seed'),
      edge('g1', 'image', 'o1', 'input'),
    ];
    const laid = autoLayout(nodes, edges);
    const pos = Object.fromEntries(laid.map((n) => [n.id, n.position]));
    expect(pos.p1.x).toBe(pos.s1.x); // same column
    expect(pos.p1.y).not.toBe(pos.s1.y); // stacked
    expect(pos.g1.x).toBeGreaterThan(pos.p1.x);
    expect(pos.o1.x).toBeGreaterThan(pos.g1.x);
  });

  test('cycle detection finds the loop members', () => {
    const nodes = [node('a', 'llm'), node('b', 'llm')];
    const edges = [edge('a', 'text', 'b', 'text'), edge('b', 'text', 'a', 'text')];
    expect(findCycle(nodes, edges).sort()).toEqual(['a', 'b']);
  });
});

describe('node catalog', () => {
  test('every catalog entry is a real node type', () => {
    const known = new Set(listNodeTypes());
    for (const type of Object.keys(NODE_CATALOG)) {
      expect(known.has(type), `catalog entry '${type}' missing from NODE_HANDLES`).toBe(true);
    }
  });

  test('describeNodeType exposes handles for every known type', () => {
    for (const type of listNodeTypes()) {
      const info = describeNodeType(type);
      expect(info, type).toBeDefined();
      expect(Array.isArray(info!.inputs)).toBe(true);
      expect(Array.isArray(info!.outputs)).toBe(true);
    }
    expect(describeNodeType('notARealNode')).toBeUndefined();
  });
});

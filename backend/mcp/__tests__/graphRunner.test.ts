// @vitest-environment node
import { describe, test, expect } from 'vitest';
import { planRun, supportedNodeTypes } from '../../services/graphRunner.ts';
import type { GraphNode, GraphEdge } from '../graph/validate.ts';

function node(id: string, type: string, config: Record<string, unknown> = {}): GraphNode {
  return { id, type, position: { x: 0, y: 0 }, data: { label: type, type, config } };
}
function edge(source: string, sourceHandle: string, target: string, targetHandle: string): GraphEdge {
  return { id: `e-${source}-${target}-${targetHandle}`, source, sourceHandle, target, targetHandle };
}

describe('run planning', () => {
  const nodes = [
    node('p1', 'prompt', { prompt: 'a cat' }),
    node('s1', 'seed', { seed: 7 }),
    node('img', 'imagen', { model: 'gemini-3.1-flash-image', sampleCount: 2 }),
    node('desc', 'imageDescriber'),
    node('crop', 'crop'),
  ];
  const edges = [
    edge('p1', 'prompt', 'img', 'prompt'),
    edge('s1', 'seed', 'img', 'seed'),
    edge('img', 'image', 'desc', 'image'),
    edge('img', 'image', 'crop', 'image'),
  ];

  test('orders dependencies before dependents', () => {
    const plan = planRun(nodes, edges);
    const at = (id: string) => plan.order.indexOf(id);
    expect(at('p1')).toBeLessThan(at('img'));
    expect(at('s1')).toBeLessThan(at('img'));
    expect(at('img')).toBeLessThan(at('desc'));
    expect(plan.order).toHaveLength(5);
  });

  test('targetNodeIds narrows the plan to that node and its ancestors', () => {
    const plan = planRun(nodes, edges, ['desc']);
    expect(plan.order.sort()).toEqual(['desc', 'img', 'p1', 's1']);
    expect(plan.order).not.toContain('crop');
  });

  test('reports nodes with no server-side executor as unsupported', () => {
    const plan = planRun(nodes, edges);
    expect(plan.unsupported.map((u) => u.type)).toContain('crop');
    expect(plan.unsupported.map((u) => u.type)).not.toContain('imagen');
  });

  test('estimates cost from generator nodes and sample counts', () => {
    const plan = planRun(nodes, edges);
    // 2 gemini images at ~$0.10 each; value/describer nodes are free to estimate
    expect(plan.estimatedCostUsd).toBeGreaterThan(0.1);
    expect(plan.estimatedCostUsd).toBeLessThan(1);

    const cheap = planRun([node('p1', 'prompt'), node('o1', 'output')], []);
    expect(cheap.estimatedCostUsd).toBe(0);
  });

  test('video cost scales with sample count', () => {
    const one = planRun([node('v', 'veo', { model: 'veo-3.1-fast-generate-001', duration: 4 })], []);
    const three = planRun([node('v', 'veo', { model: 'veo-3.1-fast-generate-001', duration: 4, sampleCount: 3 })], []);
    expect(three.estimatedCostUsd).toBeCloseTo(one.estimatedCostUsd * 3, 4);
  });

  test('cycles are rejected before anything runs', () => {
    const cyclic = [node('a', 'llm'), node('b', 'llm')];
    const loop = [edge('a', 'text', 'b', 'text'), edge('b', 'text', 'a', 'text')];
    expect(() => planRun(cyclic, loop)).toThrow(/cycle/i);
  });

  test('the executor registry covers the generators and value nodes', () => {
    const supported = supportedNodeTypes();
    for (const type of ['prompt', 'seed', 'imagen', 'veo', 'lyria', 'llm', 'imageDescriber', 'output']) {
      expect(supported, type).toContain(type);
    }
  });
});

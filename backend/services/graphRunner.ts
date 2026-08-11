/**
 * Headless graph runner — executes a canvas workflow server-side.
 *
 * The app runs nodes in the browser (each component's handleRun reads its
 * upstream edges, calls the gemini proxy, and writes the result back into
 * node.data). This service does the same thing without a browser: topological
 * plan → per-node executor → immutable writeback into the workflow row, so the
 * Canvas shows exactly what a human clicking Run would have produced.
 *
 * Node coverage is deliberate, not exhaustive: value nodes, text/vision, and
 * the generators. Anything without an executor is reported as `skipped` (with
 * a reason) instead of silently doing nothing, and its dependents fail with a
 * clear message. Pixel-editing nodes (crop/blur/levels…) run on the browser
 * canvas today and are out of scope.
 */

import { runGeneration } from './generation.ts';
import { calculateCost, estimateImageCost } from '../config/pricing.ts';
import {
  DEFAULT_IMAGE_MODEL,
  DEFAULT_MUSIC_MODEL,
  DEFAULT_TEXT_MODEL,
  DEFAULT_VIDEO_MODEL,
  resolveImageModel,
} from '../../src/lib/models.ts';
import { workflows } from './database.ts';
import type { GraphNode, GraphEdge } from '../mcp/graph/validate.ts';
import { findCycle } from '../mcp/graph/validate.ts';
import { projectContextFor } from '../mcp/projectContext.ts';
import { imagePartFromUrl, imageBytesFromUrl } from '../mcp/media.ts';

const BLOCK_NONE_SAFETY = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

const VIDEO_POLL_INTERVAL_MS = 5000;
const VIDEO_MAX_POLLS = 120; // ~10 minutes, same ceiling as the app
const DEFAULT_AUDIO_MODEL = DEFAULT_MUSIC_MODEL;

export type NodeRunStatus = 'ok' | 'skipped' | 'error';

export interface NodeRunResult {
  nodeId: string;
  type: string;
  status: NodeRunStatus;
  output?: unknown;
  outputs?: unknown[];
  reason?: string;
}

export interface RunContext {
  workflowId: string;
  projectId: string;
  userId: string;
  /** Checked between nodes so a run can be cancelled mid-pipeline. */
  isCancelled?: () => boolean;
  /** Called after each node so callers can persist progress. */
  onProgress?: (result: NodeRunResult, completed: number, total: number) => void;
}

export interface RunPlan {
  order: string[];
  estimatedCostUsd: number;
  unsupported: { nodeId: string; type: string }[];
}

/** Inputs a node reads, keyed by its target handle id. Multi-edge handles (reference) collect arrays. */
type ResolvedInputs = Record<string, unknown> & { __references?: { url: string; role: string; strength: number }[] };

type NodeExecutor = (node: GraphNode, inputs: ResolvedInputs, ctx: RunContext) => Promise<{ output?: unknown; outputs?: unknown[] }>;

/* ------------------------------------------------------------------ *
 * Planning
 * ------------------------------------------------------------------ */

/** Kahn topological order. Assumes the graph is acyclic (checked by the caller). */
function topoSort(nodes: GraphNode[], edges: GraphEdge[]): string[] {
  const indegree = new Map<string, number>(nodes.map((n) => [n.id, 0]));
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (!indegree.has(edge.source) || !indegree.has(edge.target)) continue;
    indegree.set(edge.target, (indegree.get(edge.target) ?? 0) + 1);
    adjacency.set(edge.source, [...(adjacency.get(edge.source) ?? []), edge.target]);
  }
  const queue = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      const deg = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }
  return order;
}

/** Ancestors of the target nodes (inclusive) — everything that must run to produce them. */
function ancestorsOf(targetIds: string[], edges: GraphEdge[]): Set<string> {
  const incoming = new Map<string, string[]>();
  for (const edge of edges) {
    incoming.set(edge.target, [...(incoming.get(edge.target) ?? []), edge.source]);
  }
  const needed = new Set<string>();
  const stack = [...targetIds];
  while (stack.length) {
    const id = stack.pop()!;
    if (needed.has(id)) continue;
    needed.add(id);
    for (const parent of incoming.get(id) ?? []) stack.push(parent);
  }
  return needed;
}

/**
 * Rough pre-flight cost estimate — enough to catch "40 Veo clips" before it
 * happens. Text/vision spend is token-driven and unknowable up front; it is
 * cheap enough to ignore here (real cost is always tracked after the fact).
 */
function estimateNodeCost(node: GraphNode): number {
  const config = (node.data?.config ?? {}) as Record<string, any>;
  switch (node.type) {
    case 'imagen':
    case 'nanoBanana': {
      const model = resolveImageModel(config.model);
      const samples = Math.max(1, Number(config.sampleCount ?? 1));
      // Image output is billed by token, and the token count is fixed per
      // resolution — so the estimate is exact for the requested size.
      return (estimateImageCost(model, config.resolution) ?? 0) * samples;
    }
    case 'veo':
    case 'imageToVideo': {
      const model = config.model ?? DEFAULT_VIDEO_MODEL;
      const samples = Math.max(1, Number(config.sampleCount ?? 1));
      return (
        calculateCost(model, {}, {
          duration: config.duration,
          resolution: config.resolution,
          audio: config.audio,
        }) * samples
      );
    }
    case 'lyria':
      return calculateCost(config.model ?? DEFAULT_AUDIO_MODEL, {});
    default:
      return 0;
  }
}

export function planRun(nodes: GraphNode[], edges: GraphEdge[], targetNodeIds?: string[]): RunPlan {
  const cycle = findCycle(nodes, edges);
  if (cycle.length) throw new Error(`Cannot run: graph contains a cycle involving ${cycle.join(', ')}`);

  const scope = targetNodeIds?.length ? ancestorsOf(targetNodeIds, edges) : new Set(nodes.map((n) => n.id));
  const scoped = nodes.filter((n) => scope.has(n.id));
  const order = topoSort(scoped, edges.filter((e) => scope.has(e.source) && scope.has(e.target)));

  return {
    order,
    estimatedCostUsd: Number(scoped.reduce((sum, n) => sum + estimateNodeCost(n), 0).toFixed(4)),
    unsupported: scoped.filter((n) => !EXECUTORS[n.type]).map((n) => ({ nodeId: n.id, type: n.type })),
  };
}

/* ------------------------------------------------------------------ *
 * Executors — each mirrors the matching node component's handleRun
 * ------------------------------------------------------------------ */

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

/** Value nodes just surface what's already in their config (canvas parity). */
const passthrough =
  (configKey: string): NodeExecutor =>
  async (node) => ({ output: node.data?.config?.[configKey] ?? node.data?.output });

const EXECUTORS: Record<string, NodeExecutor> = {
  prompt: passthrough('prompt'),
  text: passthrough('text'),
  number: passthrough('value'),
  seed: passthrough('seed'),
  cfgScale: passthrough('value'),
  guidanceStrength: passthrough('value'),
  motionIntensity: passthrough('value'),
  imageUpload: passthrough('url'),
  videoUpload: passthrough('url'),
  listSelector: passthrough('text'),
  toggle: passthrough('value'),

  promptConcatenator: async (_node, inputs) => ({
    output: ['in1', 'in2', 'in3', 'in4']
      .map((handle) => textOf(inputs[handle]))
      .filter(Boolean)
      .join(' '),
  }),

  output: async (_node, inputs) => ({ output: inputs.input }),

  promptEnhancer: async (node, inputs, ctx) => {
    const prompt = textOf(inputs.prompt);
    if (!prompt) throw new Error('No prompt input connected');
    const data = await runGeneration({
      method: 'generateContent',
      params: {
        model: DEFAULT_TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: `Enhance this image-generation prompt with vivid, concrete detail. Return only the improved prompt.\n\n${prompt}` }] }],
        config: { systemInstruction: contextInstruction(ctx, node) },
        projectId: ctx.projectId,
      },
      userId: ctx.userId,
      via: 'mcp',
    });
    return { output: data.text };
  },

  llm: async (node, inputs, ctx) => {
    const text = textOf(inputs.text);
    if (!text) throw new Error('No text input connected');
    const parts: any[] = [{ text }];
    const image = textOf(inputs.image);
    if (image) parts.push(imagePartFromUrl(image));

    const systemInstruction = [
      (node.data?.config?.systemInstruction as string) || 'You are a helpful creative assistant.',
      contextInstruction(ctx, node),
    ]
      .filter(Boolean)
      .join('\n\n');

    const data = await runGeneration({
      method: 'generateContent',
      params: {
        model: DEFAULT_TEXT_MODEL,
        contents: [{ role: 'user', parts }],
        config: { systemInstruction },
        projectId: ctx.projectId,
      },
      userId: ctx.userId,
      via: 'mcp',
    });
    return { output: data.text };
  },

  imageDescriber: describeMedia('image'),
  vision: describeMedia('image'),
  videoDescriber: describeMedia('video'),

  imagen: generateImageNode,
  nanoBanana: generateImageNode,

  veo: generateVideoNode,
  imageToVideo: generateVideoNode,

  lyria: async (node, inputs, ctx) => {
    const config = (node.data?.config ?? {}) as Record<string, any>;
    const prompt = textOf(inputs.prompt) ?? textOf(config.prompt);
    if (!prompt) throw new Error('No prompt input connected');
    const model = config.model ?? DEFAULT_AUDIO_MODEL;
    if (String(model).includes('pro')) {
      throw new Error('Lyria Pro is long-running — use start_music_job instead of running it inside a workflow');
    }

    const data = await runGeneration({
      method: 'generateContent',
      params: {
        model,
        contents: [{ parts: [{ text: describeMusic(prompt, config) }] }],
        config: {
          responseModalities: ['AUDIO'],
          ...(config.negativePrompt && { negative_prompt: config.negativePrompt }),
          ...(config.seed !== undefined && { seed: config.seed }),
          ...(config.bpm !== undefined && { bpm: config.bpm }),
          ...(config.density !== undefined && { density: config.density }),
          ...(config.brightness !== undefined && { brightness: config.brightness }),
          ...(config.scale && { scale: config.scale }),
          safetySettings: BLOCK_NONE_SAFETY,
        },
        projectId: ctx.projectId,
      },
      userId: ctx.userId,
      via: 'mcp',
    });
    const inline = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
    if (!inline?.storageUrl) throw new Error('No audio generated');
    return { output: inline.storageUrl };
  },
};

function contextInstruction(ctx: RunContext, _node: GraphNode): string {
  const context = projectContextFor(ctx.projectId);
  return context ? `Project Context:\n${context}` : '';
}

function describeMusic(prompt: string, config: Record<string, any>): string {
  const traits = [config.genre, config.mood, config.instrumentation].filter(Boolean).join(', ');
  return traits ? `${prompt} (${traits})` : prompt;
}

function describeMedia(kind: 'image' | 'video'): NodeExecutor {
  return async (_node, inputs, ctx) => {
    const url = textOf(inputs[kind]);
    if (!url) throw new Error(`No ${kind} input connected`);
    const data = await runGeneration({
      method: 'generateContent',
      params: {
        model: DEFAULT_TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: `Describe this ${kind} in vivid detail.` }, imagePartFromUrl(url)] }],
        projectId: ctx.projectId,
      },
      userId: ctx.userId,
      via: 'mcp',
    });
    return { output: data.text };
  };
}

async function generateImageNode(node: GraphNode, inputs: ResolvedInputs, ctx: RunContext) {
  const config = (node.data?.config ?? {}) as Record<string, any>;
  const prompt = textOf(inputs.prompt) ?? textOf(config.prompt);
  if (!prompt) throw new Error('No prompt input connected');

  const model = config.model ?? DEFAULT_IMAGE_MODEL;
  const aspectRatio = config.aspectRatio ?? '1:1';
  const seed = inputs.seed !== undefined ? Number(inputs.seed) : config.seed;
  const context = projectContextFor(ctx.projectId);
  const fullPrompt = context
    ? `Project Context: ${context}\n\nTask: Generate an image based on this prompt: ${prompt}`
    : prompt;

  // The imagen-4 branch was removed — Imagen 404s on this Vertex project, so
  // every image node runs through the Gemini image path below.
  const parts: any[] = [];
  for (const ref of inputs.__references ?? []) parts.push(imagePartFromUrl(ref.url));
  parts.push({ text: fullPrompt });

  const samples = Math.max(1, Math.min(Number(config.sampleCount ?? 1), 4));
  const urls: string[] = [];
  for (let i = 0; i < samples; i++) {
    const data = await runGeneration({
      method: 'generateContent',
      params: {
        model,
        contents: [{ role: 'user', parts }],
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio, ...(config.resolution && { imageSize: config.resolution }) },
          ...(seed !== undefined && { seed: samples > 1 ? Number(seed) + i : Number(seed) }),
          ...(config.temperature !== undefined && { temperature: config.temperature }),
          safetySettings: BLOCK_NONE_SAFETY,
        },
        projectId: ctx.projectId,
      },
      userId: ctx.userId,
      via: 'mcp',
    });
    const inline = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData;
    if (inline?.storageUrl) urls.push(inline.storageUrl);
  }
  if (!urls.length) throw new Error('No image generated (the prompt may have been filtered)');
  return { output: urls[0], outputs: urls };
}

async function generateVideoNode(node: GraphNode, inputs: ResolvedInputs, ctx: RunContext) {
  const config = (node.data?.config ?? {}) as Record<string, any>;
  const prompt = textOf(inputs.prompt) ?? textOf(config.prompt) ?? 'Animate this sequence';
  const model = config.model ?? DEFAULT_VIDEO_MODEL;
  const context = projectContextFor(ctx.projectId);
  const fullPrompt = context
    ? `Project Context: ${context}\n\nTask: Generate a video based on this prompt: ${prompt}`
    : prompt;

  const videoConfig: any = {
    numberOfVideos: 1,
    sampleCount: 1,
    aspectRatio: config.aspectRatio ?? '16:9',
    resolution: config.resolution ?? '720p',
    duration: config.duration,
    ...(config.negativePrompt && { negativePrompt: config.negativePrompt }),
    ...(config.audio !== undefined && { audio: config.audio }),
  };
  const seed = inputs.seed !== undefined ? Number(inputs.seed) : config.seed;
  if (seed !== undefined) videoConfig.seed = Number(seed);

  const startUrl = textOf(inputs.startFrame) ?? textOf(inputs.start);
  const endUrl = textOf(inputs.endFrame) ?? textOf(inputs.end);
  const image = startUrl ? await imageBytesFromUrl(startUrl) : undefined;
  if (endUrl) videoConfig.lastFrame = await imageBytesFromUrl(endUrl);
  if (inputs.__references?.length) {
    videoConfig.referenceImages = await Promise.all(
      inputs.__references.map(async (ref) => ({
        image: await imageBytesFromUrl(ref.url),
        referenceType: 'ASSET',
      }))
    );
  }

  let operation = await runGeneration({
    method: 'generateVideos',
    params: { model, prompt: fullPrompt, image, config: videoConfig, projectId: ctx.projectId },
    userId: ctx.userId,
    via: 'mcp',
  });

  // Server-side LRO polling — the browser used to do this
  for (let poll = 0; !operation?.done; poll++) {
    if (poll >= VIDEO_MAX_POLLS) throw new Error('Video generation timed out after ~10 minutes');
    if (ctx.isCancelled?.()) throw new Error('Run cancelled');
    await new Promise((resolve) => setTimeout(resolve, VIDEO_POLL_INTERVAL_MS));
    operation = await runGeneration({
      method: 'getOperation',
      params: { operation: { name: operation?.name }, projectId: ctx.projectId, model, config: videoConfig },
      userId: ctx.userId,
      via: 'mcp',
    });
  }

  const generated: any[] = operation.response?.generatedVideos ?? [];
  const urls: string[] = [];
  for (const video of generated) {
    const uri = video.video?.uri;
    if (!uri) continue;
    const fetched = await runGeneration({
      method: 'fetchVideoFile',
      params: { url: uri, projectId: ctx.projectId },
      userId: ctx.userId,
      via: 'mcp',
    });
    if (fetched?.storageUrl) urls.push(fetched.storageUrl);
  }
  if (!urls.length) throw new Error('No video generated');
  return { output: urls[0], outputs: urls };
}

/* ------------------------------------------------------------------ *
 * Execution
 * ------------------------------------------------------------------ */

/** Reads a node's inputs from its incoming edges (upstream data.output). */
function resolveInputs(nodeId: string, edges: GraphEdge[], nodesById: Map<string, GraphNode>, config: Record<string, any>): ResolvedInputs {
  const inputs: ResolvedInputs = {};
  const references: { url: string; role: string; strength: number }[] = [];

  for (const edge of edges.filter((e) => e.target === nodeId)) {
    const source = nodesById.get(edge.source);
    if (!source) continue;
    const value = source.data?.output;
    if (value === undefined || value === null || value === '') continue;

    if (edge.targetHandle === 'reference' && typeof value === 'string') {
      references.push({
        url: value,
        role: config.referenceRoles?.[edge.id] ?? 'style',
        strength: Number(config.referenceStrength ?? 50),
      });
      continue;
    }
    if (edge.targetHandle) inputs[edge.targetHandle] = value;
  }

  if (references.length) inputs.__references = references;
  return inputs;
}

/**
 * Runs the plan. Persists after every node so partial progress is visible in
 * the Canvas (and, once Phase E lands, streams live).
 */
export async function runWorkflow(ctx: RunContext, targetNodeIds?: string[]): Promise<{ results: NodeRunResult[]; plan: RunPlan }> {
  const row = workflows.findById(ctx.workflowId);
  if (!row) throw new Error(`Workflow not found: ${ctx.workflowId}`);

  let nodes: GraphNode[] = row.nodes ?? [];
  const edges: GraphEdge[] = row.edges ?? [];
  const plan = planRun(nodes, edges, targetNodeIds);

  const results: NodeRunResult[] = [];
  const failed = new Set<string>();

  for (const [index, nodeId] of plan.order.entries()) {
    if (ctx.isCancelled?.()) break;

    const nodesById = new Map(nodes.map((n) => [n.id, n]));
    const node = nodesById.get(nodeId)!;
    const executor = EXECUTORS[node.type];

    const upstreamFailed = edges
      .filter((e) => e.target === nodeId)
      .map((e) => e.source)
      .filter((source) => failed.has(source));

    let result: NodeRunResult;

    if (upstreamFailed.length) {
      result = {
        nodeId, type: node.type, status: 'skipped',
        reason: `Upstream node(s) did not produce output: ${upstreamFailed.join(', ')}`,
      };
      failed.add(nodeId);
    } else if (!executor) {
      result = {
        nodeId, type: node.type, status: 'skipped',
        reason: `No server-side executor for '${node.type}' — this node still runs in the Canvas UI`,
      };
      failed.add(nodeId);
    } else {
      const config = (node.data?.config ?? {}) as Record<string, any>;
      const inputs = resolveInputs(nodeId, edges, nodesById, config);
      try {
        const produced = await executor(node, inputs, ctx);
        result = { nodeId, type: node.type, status: 'ok', output: produced.output, outputs: produced.outputs };
        nodes = nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                data: {
                  ...n.data,
                  output: produced.output,
                  ...(produced.outputs ? { outputs: produced.outputs } : {}),
                  error: null,
                  isRunning: false,
                },
              }
            : n
        );
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        result = { nodeId, type: node.type, status: 'error', reason: message };
        failed.add(nodeId);
        nodes = nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, error: message, isRunning: false } } : n
        );
      }
    }

    results.push(result);

    // Re-read before writing so a concurrent human edit isn't clobbered:
    // only this node's data is replayed onto the latest graph.
    const latest = workflows.findById(ctx.workflowId);
    if (latest) {
      const updatedNode = nodes.find((n) => n.id === nodeId);
      const merged = (latest.nodes as GraphNode[]).map((n) =>
        n.id === nodeId && updatedNode ? { ...n, data: { ...n.data, ...updatedNode.data } } : n
      );
      workflows.update(ctx.workflowId, { nodes: merged });
      nodes = merged;
    }

    ctx.onProgress?.(result, index + 1, plan.order.length);
  }

  return { results, plan };
}

/** Run one node using whatever its upstream nodes already produced. */
export async function runSingleNode(ctx: RunContext, nodeId: string): Promise<NodeRunResult> {
  const row = workflows.findById(ctx.workflowId);
  if (!row) throw new Error(`Workflow not found: ${ctx.workflowId}`);
  const nodes: GraphNode[] = row.nodes ?? [];
  const edges: GraphEdge[] = row.edges ?? [];
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) throw new Error(`Node not found: ${nodeId}`);

  const executor = EXECUTORS[node.type];
  if (!executor) {
    return {
      nodeId, type: node.type, status: 'skipped',
      reason: `No server-side executor for '${node.type}' — run it in the Canvas UI`,
    };
  }

  const config = (node.data?.config ?? {}) as Record<string, any>;
  const inputs = resolveInputs(nodeId, edges, new Map(nodes.map((n) => [n.id, n])), config);
  try {
    const produced = await executor(node, inputs, ctx);
    const merged = nodes.map((n) =>
      n.id === nodeId
        ? { ...n, data: { ...n.data, output: produced.output, ...(produced.outputs ? { outputs: produced.outputs } : {}), error: null, isRunning: false } }
        : n
    );
    workflows.update(ctx.workflowId, { nodes: merged });
    return { nodeId, type: node.type, status: 'ok', output: produced.output, outputs: produced.outputs };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const merged = nodes.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, error: message, isRunning: false } } : n));
    workflows.update(ctx.workflowId, { nodes: merged });
    return { nodeId, type: node.type, status: 'error', reason: message };
  }
}

export function supportedNodeTypes(): string[] {
  return Object.keys(EXECUTORS);
}

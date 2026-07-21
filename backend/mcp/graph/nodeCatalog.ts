/**
 * Node catalog — what Claude reads (via describe_node_types) to build graphs.
 *
 * Handles and connection legality come straight from the live registries
 * (NODE_HANDLES / CONNECTION_VALIDATION_RULES). What those can't express is
 * each node's `data.config` shape — that lives per component with no central
 * schema — so this catalog documents the fields for the most-used nodes,
 * verified against the components on 2026-07-12. Config is advisory and
 * open-ended by design (NodeConfig allows arbitrary keys); tools validate
 * graph structure strictly but pass config through.
 */

import { NODE_HANDLES } from '../../../src/types/nodeHandles.ts';
import { CONNECTION_VALIDATION_RULES } from '../../../src/types/validationRules.ts';
import type { NodeType } from '../../../src/types.ts';
import { handlesFor, knownNodeType } from './validate.ts';

export interface CatalogField {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum' | 'json';
  description?: string;
  values?: string[];
  default?: unknown;
}

export interface CatalogEntry {
  description: string;
  configFields: CatalogField[];
  /** Config key whose value should ALSO be written to data.output so downstream nodes can read it without a manual Run. */
  outputFromConfig?: string;
  notes?: string;
}

export const NODE_CATALOG: Partial<Record<NodeType, CatalogEntry>> = {
  prompt: {
    description: 'Holds a text prompt and feeds it to generators.',
    configFields: [{ name: 'prompt', type: 'string', description: 'The prompt text' }],
    outputFromConfig: 'prompt',
  },
  text: {
    description: 'Plain text value node.',
    configFields: [{ name: 'text', type: 'string' }],
    outputFromConfig: 'text',
  },
  number: {
    description: 'Numeric value node.',
    configFields: [{ name: 'value', type: 'number' }],
    outputFromConfig: 'value',
  },
  seed: {
    description: 'Seed value for reproducible generation.',
    configFields: [
      { name: 'seed', type: 'number' },
      { name: 'isRandom', type: 'boolean', default: false },
    ],
    outputFromConfig: 'seed',
  },
  cfgScale: {
    description: 'CFG scale parameter node (how strictly the model follows the prompt).',
    configFields: [{ name: 'value', type: 'number', default: 7 }],
    outputFromConfig: 'value',
  },
  guidanceStrength: {
    description: 'Guidance strength parameter node.',
    configFields: [{ name: 'value', type: 'number' }],
    outputFromConfig: 'value',
  },
  motionIntensity: {
    description: 'Motion intensity for video generation.',
    configFields: [{ name: 'value', type: 'number' }],
    outputFromConfig: 'value',
  },
  imageUpload: {
    description: 'An image source. Set config.url + output to a /storage Library url (find one with search_library, or upload_asset_from_url first).',
    configFields: [{ name: 'url', type: 'string', description: 'A /storage/... asset url' }],
    outputFromConfig: 'url',
  },
  videoUpload: {
    description: 'A video source. Same url pattern as imageUpload.',
    configFields: [{ name: 'url', type: 'string' }],
    outputFromConfig: 'url',
  },
  imagen: {
    description: 'THE image generation node (Imagen 4 or Gemini image models, chosen via config.model). Prompt comes from the prompt input edge; reference images from edges into the reference handle.',
    configFields: [
      { name: 'model', type: 'string', description: "Image model id — see list_models(mode='image'). Note: Imagen 4 ids may not be enabled on the GCP project; gemini-3.1-flash-image is the workhorse" },
      { name: 'aspectRatio', type: 'string', values: ['1:1', '3:4', '4:3', '9:16', '16:9'], default: '1:1' },
      { name: 'resolution', type: 'string', description: 'Gemini image models: 1K/2K/4K' },
      { name: 'sampleCount', type: 'number', default: 1 },
      { name: 'seed', type: 'number' },
      { name: 'temperature', type: 'number' },
      { name: 'referenceStrength', type: 'number', description: '0–1, how strongly references steer the output' },
      { name: 'referenceRoles', type: 'json', description: 'Map of edgeId → role (e.g. {"e-...": "person" }) for edges into the reference handle' },
    ],
  },
  nanoBanana: {
    description: 'Lightweight Gemini image node. Prefer the imagen node with a gemini model in config.model — it has the full parameter set and reference support.',
    configFields: [
      { name: 'model', type: 'string' },
      { name: 'aspectRatio', type: 'string' },
      { name: 'seed', type: 'number' },
    ],
  },
  veo: {
    description: 'Video generation (Veo 3.1). Prompt from the prompt edge; start/end frames and references from image edges into startFrame/endFrame/reference handles.',
    configFields: [
      { name: 'model', type: 'string', description: "Video model id — see list_models(mode='video')" },
      { name: 'aspectRatio', type: 'string', values: ['16:9', '9:16'], default: '16:9' },
      { name: 'resolution', type: 'string', values: ['720p', '1080p', '4K'], default: '720p' },
      { name: 'duration', type: 'number', values: ['4', '6', '8'] },
      { name: 'sampleCount', type: 'number', default: 1 },
      { name: 'style', type: 'string', description: 'Appended to the prompt as "... in X style"' },
      { name: 'negativePrompt', type: 'string' },
      { name: 'audio', type: 'boolean', description: 'Generate synced audio (costs more)' },
      { name: 'referenceStrength', type: 'number' },
      { name: 'referenceRoles', type: 'json' },
    ],
  },
  imageToVideo: {
    description: 'Animate a start image (optionally toward an end image) into video.',
    configFields: [
      { name: 'model', type: 'string' },
      { name: 'aspectRatio', type: 'string' },
      { name: 'resolution', type: 'string' },
      { name: 'duration', type: 'number' },
      { name: 'negativePrompt', type: 'string' },
    ],
  },
  lyria: {
    description: 'Music/audio generation (Lyria + TTS). The prompt input takes text; musical character via config.',
    configFields: [
      { name: 'model', type: 'string', description: "Audio model id — see list_models(mode='audio')" },
      { name: 'genre', type: 'string', default: 'Cinematic' },
      { name: 'mood', type: 'string', default: 'Epic' },
      { name: 'instrumentation', type: 'string', default: 'Orchestra, Piano' },
      { name: 'duration', type: 'number', default: 60 },
      { name: 'negativePrompt', type: 'string' },
      { name: 'seed', type: 'number' },
      { name: 'bpm', type: 'number', default: 120 },
      { name: 'density', type: 'number', default: 0.5 },
      { name: 'brightness', type: 'number', default: 0.5 },
      { name: 'scale', type: 'string', default: 'C Major' },
    ],
  },
  llm: {
    description: 'Text generation/transformation. Feed text via the text input edge, optionally an image for vision tasks.',
    configFields: [
      { name: 'systemInstruction', type: 'string', default: 'You are a helpful creative assistant.' },
    ],
  },
  promptEnhancer: {
    description: 'Rewrites/enriches an incoming prompt before it reaches a generator.',
    configFields: [],
  },
  promptConcatenator: {
    description: 'Joins up to 4 incoming prompts (in1..in4) into one.',
    configFields: [],
  },
  imageDescriber: {
    description: 'Describes an incoming image as text (vision).',
    configFields: [],
  },
  videoDescriber: {
    description: 'Describes an incoming video as text.',
    configFields: [],
  },
  output: {
    description: 'Terminal sink — marks a pipeline result. Connect any final output here.',
    configFields: [],
  },
  stickyNote: {
    description: 'Freeform annotation on the canvas (no handles).',
    configFields: [{ name: 'text', type: 'string' }],
  },
};

/** Everything describe_node_types returns for one node type. */
export function describeNodeType(type: string) {
  if (!knownNodeType(type)) return undefined;
  const handles = handlesFor(type)!;
  const rules = CONNECTION_VALIDATION_RULES[type];
  const catalog = NODE_CATALOG[type];
  return {
    type,
    description: catalog?.description ?? null,
    inputs: handles.inputs.map((h) => ({ id: h.id, type: h.type, label: h.label })),
    outputs: handles.outputs.map((h) => ({ id: h.id, type: h.type, label: h.label })),
    connectionRules: rules
      ? {
          allowedInputs: rules.allowedInputs,
          allowedOutputs: rules.allowedOutputs,
          blockedConnections: rules.blockedConnections?.map((b) => `${b.from} → ${b.to}: ${b.reason}`),
        }
      : null,
    configFields: catalog?.configFields ?? [],
    notes: catalog?.notes ?? (catalog ? undefined : 'No catalog entry — structure is known (handles above) but config fields are undocumented; set config keys cautiously.'),
  };
}

export function listNodeTypes(): string[] {
  return Object.keys(NODE_HANDLES).filter((t) => t !== 'default');
}

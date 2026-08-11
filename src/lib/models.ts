/**
 * Unified model registry for Chat Studio.
 *
 * Image models stay in src/nodes/imagenModels.ts (canvas nodes import from
 * there); this module re-exposes them alongside text/video/audio models so a
 * single picker can enumerate everything with capability flags.
 * Model ids must match backend/config/pricing.ts MODEL_PRICING keys.
 */
import { IMAGE_MODELS } from '../nodes/imagenModels';
import type { ImageModel } from '../nodes/imagenModels';
import { AUDIO_MODEL_RATES } from './pricing';

export type GenerationMode = 'text' | 'image' | 'video' | 'audio';

export interface StudioModelSupports {
  /** Selectable aspect ratios (image/video) */
  aspectRatio?: string[];
  /** Selectable output resolutions */
  resolution?: string[];
  /** Number-of-outputs control (capped at MAX_CHAT_SAMPLES in chat) */
  sampleCount?: boolean;
  seed?: boolean;
  negativePrompt?: boolean;
  referenceImages?: boolean;
  temperature?: boolean;
  /** System instruction / presets apply (text mode) */
  systemInstruction?: boolean;
  /** Web search + URL-reading tools (text mode) */
  grounding?: boolean;
  /** Video clip lengths in seconds */
  duration?: number[];
  /** Veo native audio toggle */
  audio?: boolean;
  /** TTS prebuilt voices */
  voice?: string[];
  /** Lyria music controls */
  bpm?: boolean;
  density?: boolean;
  brightness?: boolean;
  musicScale?: boolean;
}

export interface StudioModel {
  id: string;
  label: string;
  mode: GenerationMode;
  /** Short human hint shown under the picker */
  description?: string;
  /** Display-only price hint */
  priceHint?: string;
  supports: StudioModelSupports;
  defaults: Record<string, unknown>;
}

/** Keep chat image/video batches small — the proxy times out at ~58s per call */
export const MAX_CHAT_SAMPLES = 4;

export const TTS_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Aoede', 'Leda', 'Orus', 'Zephyr'];

/**
 * The models the studio runs.
 *
 * This block is the ONLY place a model id is written down (image ids live in the
 * canvas registry this module re-exports). Every consumer — chat, prompt
 * helpers, canvas nodes, the headless graph runner and the MCP tools — imports
 * one of these constants or a `resolve*Model()` helper, so switching a model is
 * a one-line edit here instead of a hunt through string literals.
 */
export const DEFAULT_TEXT_MODEL = 'gemini-3.6-flash';
export const DEFAULT_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const DEFAULT_VIDEO_MODEL = 'veo-3.1-fast-generate-001';
/** Highest-quality video — also the conservative assumption when pricing an untagged job. */
export const HQ_VIDEO_MODEL = 'veo-3.1-generate-001';
/** 30-second music clip (returns synchronously). */
export const DEFAULT_MUSIC_MODEL = 'lyria-3-clip-preview';
/** Full song — long-running, so it runs through the job tools, not inline. */
export const MUSIC_PRO_MODEL = 'lyria-3-pro-preview';
export const DEFAULT_TTS_MODEL = 'gemini-2.5-flash-preview-tts';

export const TEXT_MODELS: StudioModel[] = [
  {
    id: DEFAULT_TEXT_MODEL,
    label: 'Gemini 3.6 Flash',
    mode: 'text',
    description: 'Frontier reasoning at speed — the studio standard for every text task',
    supports: { temperature: true, systemInstruction: true, referenceImages: true, grounding: true },
    defaults: { maxOutputTokens: 8192 },
  },
];


/** Image models adapted from the canvas registry into StudioModel shape */
export const CHAT_IMAGE_MODELS: StudioModel[] = IMAGE_MODELS.map((m: ImageModel) => ({
  id: m.id,
  label: m.label,
  mode: 'image' as const,
  priceHint: m.price != null ? `$${m.price.toFixed(2)}/image` : undefined,
  supports: {
    aspectRatio: Array.isArray(m.supports.aspectRatio) ? m.supports.aspectRatio : undefined,
    resolution: Array.isArray(m.supports.resolution) ? m.supports.resolution : undefined,
    sampleCount: !!(m.supports.sampleCount || m.supports.candidateCount),
    seed: !!m.supports.seed,
    negativePrompt: !!m.supports.negativePrompt,
    referenceImages: !!m.supports.referenceImages,
    temperature: !!m.supports.temperature,
  },
  defaults: { aspectRatio: '1:1', sampleCount: 1 },
}));

export const VIDEO_MODELS: StudioModel[] = [
  {
    id: DEFAULT_VIDEO_MODEL,
    label: 'Veo 3.1 Fast',
    mode: 'video',
    description: 'Quicker, cheaper clips',
    supports: {
      aspectRatio: ['16:9', '9:16'],
      resolution: ['720p', '1080p'],
      duration: [4, 6, 8],
      negativePrompt: true,
      seed: true,
      audio: true,
      referenceImages: true,
    },
    defaults: { aspectRatio: '16:9', resolution: '720p', duration: 8, audio: true },
  },
  {
    id: HQ_VIDEO_MODEL,
    label: 'Veo 3.1',
    mode: 'video',
    description: 'Highest quality video',
    supports: {
      aspectRatio: ['16:9', '9:16'],
      resolution: ['720p', '1080p', '4K'],
      duration: [4, 6, 8],
      negativePrompt: true,
      seed: true,
      audio: true,
      referenceImages: true,
    },
    defaults: { aspectRatio: '16:9', resolution: '720p', duration: 8, audio: true },
  },
];

export const AUDIO_MODELS: StudioModel[] = [
  {
    id: DEFAULT_MUSIC_MODEL,
    label: 'Lyria 3 Clip',
    mode: 'audio',
    // Price comes from the rate table so the picker can't drift from billing.
    priceHint: `$${AUDIO_MODEL_RATES[DEFAULT_MUSIC_MODEL].perGeneration.toFixed(2)}/30s`,
    description: 'Short music clips, fast',
    supports: { negativePrompt: true, seed: true, bpm: true, density: true, brightness: true, musicScale: true },
    defaults: {},
  },
  {
    id: MUSIC_PRO_MODEL,
    label: 'Lyria 3 Pro',
    mode: 'audio',
    priceHint: `$${AUDIO_MODEL_RATES[MUSIC_PRO_MODEL].perGeneration.toFixed(2)}/song`,
    description: 'Full music generation (takes a few minutes)',
    supports: { negativePrompt: true, seed: true, bpm: true, density: true, brightness: true, musicScale: true, duration: [30, 60, 90, 120] },
    defaults: {},
  },
  {
    id: DEFAULT_TTS_MODEL,
    label: 'Speech (TTS)',
    mode: 'audio',
    description: 'Turn text into a spoken voice',
    supports: { voice: TTS_VOICES },
    defaults: { voice: 'Kore' },
  },
];

const ALL_MODELS: StudioModel[] = [...TEXT_MODELS, ...CHAT_IMAGE_MODELS, ...VIDEO_MODELS, ...AUDIO_MODELS];

export function modelsForMode(mode: GenerationMode): StudioModel[] {
  return ALL_MODELS.filter((m) => m.mode === mode);
}

export function findModel(id: string): StudioModel | undefined {
  return ALL_MODELS.find((m) => m.id === id);
}

/**
 * Coerce a stored/incoming model id to one the studio actually offers.
 *
 * Saved workflows persist `config.model` on their nodes, so graphs built before
 * a model change still carry retired ids (e.g. `gemini-3-flash-preview`, or any
 * `imagen-*` model). Resolving at the point of use upgrades them silently — no
 * data migration, and no path that keeps quietly calling a model we dropped.
 */
function resolveModel(models: StudioModel[], id: string | null | undefined, fallback: string): string {
  return models.some((m) => m.id === id) ? (id as string) : fallback;
}

export const resolveTextModel = (id?: string | null) => resolveModel(TEXT_MODELS, id, DEFAULT_TEXT_MODEL);
export const resolveImageModel = (id?: string | null) => resolveModel(CHAT_IMAGE_MODELS, id, DEFAULT_IMAGE_MODEL);
export const resolveVideoModel = (id?: string | null) => resolveModel(VIDEO_MODELS, id, DEFAULT_VIDEO_MODEL);
export const resolveAudioModel = (id?: string | null, fallback = DEFAULT_MUSIC_MODEL) =>
  resolveModel(AUDIO_MODELS, id, fallback);

/** Sensible starting model per mode */
export const DEFAULT_MODEL_FOR_MODE: Record<GenerationMode, string> = {
  text: DEFAULT_TEXT_MODEL,
  image: DEFAULT_IMAGE_MODEL,
  video: DEFAULT_VIDEO_MODEL,
  audio: DEFAULT_MUSIC_MODEL,
};

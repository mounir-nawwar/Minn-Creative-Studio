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

export const TEXT_MODELS: StudioModel[] = [
  {
    id: 'gemini-3.5-flash',
    label: 'Gemini 3.5 Flash',
    mode: 'text',
    description: 'Latest stable flash model — frontier-level reasoning at speed',
    supports: { temperature: true, systemInstruction: true, referenceImages: true },
    defaults: { maxOutputTokens: 8192 },
  },
  {
    id: 'gemini-3-flash-preview',
    label: 'Gemini 3 Flash (Preview)',
    mode: 'text',
    description: 'Fast everyday writing and prompt work',
    supports: { temperature: true, systemInstruction: true, referenceImages: true },
    defaults: { maxOutputTokens: 8192 },
  },
  {
    id: 'gemini-3.1-pro-preview',
    label: 'Gemini 3.1 Pro',
    mode: 'text',
    description: 'Deepest reasoning for complex briefs',
    supports: { temperature: true, systemInstruction: true, referenceImages: true },
    defaults: { maxOutputTokens: 8192 },
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    label: 'Gemini 3.1 Flash Lite',
    mode: 'text',
    description: 'Cheapest and quickest for simple tasks',
    supports: { temperature: true, systemInstruction: true, referenceImages: true },
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
    id: 'veo-3.1-fast-generate-001',
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
    id: 'veo-3.1-generate-001',
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
    id: 'lyria-3-clip-preview',
    label: 'Lyria 3 Clip',
    mode: 'audio',
    description: 'Short music clips, fast',
    supports: { negativePrompt: true, seed: true, bpm: true, density: true, brightness: true, musicScale: true },
    defaults: {},
  },
  {
    id: 'lyria-3-pro-preview',
    label: 'Lyria 3 Pro',
    mode: 'audio',
    description: 'Full music generation (takes a few minutes)',
    supports: { negativePrompt: true, seed: true, bpm: true, density: true, brightness: true, musicScale: true, duration: [30, 60, 90, 120] },
    defaults: {},
  },
  {
    id: 'gemini-2.5-flash-preview-tts',
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

/** Sensible starting model per mode */
export const DEFAULT_MODEL_FOR_MODE: Record<GenerationMode, string> = {
  text: 'gemini-3.5-flash',
  image: 'imagen-4.0-generate-001',
  video: 'veo-3.1-fast-generate-001',
  audio: 'lyria-3-clip-preview',
};

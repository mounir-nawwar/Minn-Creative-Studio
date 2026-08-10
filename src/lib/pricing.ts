/**
 * Single source of truth for Vertex model pricing.
 *
 * Lives in `src/lib/` (not `backend/`) so the frontend and the backend share one
 * table — the backend imports this the same way it imports `models.ts`, so keep
 * this file free of browser- and node-only imports.
 *
 * Rates are USD per 1M tokens unless stated otherwise, from Google's Vertex AI
 * pricing sheet. Token accounting below was verified live against the API on
 * 2026-08-10 (see IMAGE_OUTPUT_TOKENS).
 */

/** USD per 1M tokens, by billing bucket. */
export interface TokenRates {
  /** Text/image/video input. */
  input: number;
  /** Text output — includes reasoning ("response and reasoning"). */
  output: number;
  /** Image output tokens, when the model emits images. */
  imageOutput?: number;
  /** Audio input, when it differs from text input. */
  audioInput?: number;
  /** Cached input tokens (typically 10% of `input`). */
  cachedInput?: number;
  /** Rates that apply when prompt tokens exceed LONG_CONTEXT_THRESHOLD. */
  longContext?: { input: number; output: number };
}

/** Per-second video rates; audio-enabled generation is a different SKU, not an add-on. */
export interface VideoRates {
  /** USD/second WITH native audio (Google's headline rate). */
  withAudio: Record<string, number>;
  /** USD/second for silent video. */
  videoOnly: Record<string, number>;
}

/** Flat per-generation pricing (music). */
export interface FlatRates {
  perGeneration: number;
}

export const LONG_CONTEXT_THRESHOLD = 200_000;

/**
 * Image-output tokens by requested resolution — Google bills image output by
 * token count, and the count is fixed per resolution tier.
 *
 * VERIFIED LIVE: 512→747, 1K→1120, 2K→1680 measured from
 * candidatesTokensDetails[modality=IMAGE]; 4K→2520 from the pricing sheet.
 * These are only used for *estimates* shown in the UI — actual billing always
 * uses the token counts the API reports back.
 */
export const IMAGE_OUTPUT_TOKENS: Record<string, number> = {
  '512': 747,
  '768': 747,
  '1K': 1120,
  '2K': 1680,
  '4K': 2520,
};

/** Nano Banana Pro emits a flat 1120 tokens for 1K/2K and 2000 for 4K. */
export const IMAGE_OUTPUT_TOKENS_PRO: Record<string, number> = {
  '1K': 1120,
  '2K': 1120,
  '4K': 2000,
};

export const TEXT_MODEL_RATES: Record<string, TokenRates> = {
  'gemini-3.6-flash':      { input: 1.50, output: 7.50,  cachedInput: 0.15 },
  'gemini-3.5-flash':      { input: 1.50, output: 9.00,  cachedInput: 0.15 },
  'gemini-3.5-flash-lite': { input: 0.30, output: 2.50,  cachedInput: 0.03 },
  'gemini-3-flash-preview':{ input: 0.50, output: 3.00,  cachedInput: 0.05, audioInput: 1.00 },
  'gemini-3.1-flash-lite': { input: 0.25, output: 1.50,  cachedInput: 0.025, audioInput: 0.50 },
  'gemini-3.1-pro-preview':{
    input: 2.00, output: 12.00, cachedInput: 0.20,
    longContext: { input: 4.00, output: 18.00 },
  },
  'gemini-2.5-pro': {
    input: 1.25, output: 10.00, cachedInput: 0.13,
    longContext: { input: 2.50, output: 15.00 },
  },
  'gemini-2.5-flash-lite': { input: 0.10, output: 0.40, cachedInput: 0.01, audioInput: 0.30 },
};

export const IMAGE_MODEL_RATES: Record<string, TokenRates> = {
  // Nano Banana 2
  'gemini-3.1-flash-image':      { input: 0.50, output: 3.00,  imageOutput: 60.00,  cachedInput: 0.05 },
  // Nano Banana 2 Lite
  'gemini-3.1-flash-lite-image': { input: 0.25, output: 1.50,  imageOutput: 30.00,  cachedInput: 0.025 },
  // Nano Banana Pro
  'gemini-3-pro-image':          { input: 2.00, output: 12.00, imageOutput: 120.00, cachedInput: 0.20 },
  // Nano Banana 1 — NOTE: $30 image output, not $60 (this was mispriced 2x before)
  'gemini-2.5-flash-image':      { input: 0.30, output: 2.50,  imageOutput: 30.00 },
};

/**
 * Veo, USD per second. Google's headline rate already INCLUDES native audio —
 * silent video is a cheaper, separate rate. (The old table added an audio
 * surcharge on top of the audio-inclusive rate, double-charging every clip.)
 */
export const VIDEO_MODEL_RATES: Record<string, VideoRates> = {
  'veo-3.1-generate-001': {
    withAudio:  { '720p': 0.40, '1080p': 0.40, '4K': 0.60 },
    videoOnly:  { '720p': 0.20, '1080p': 0.20, '4K': 0.40 },
  },
  'veo-3.1-fast-generate-001': {
    withAudio:  { '720p': 0.10, '1080p': 0.12, '4K': 0.30 },
    videoOnly:  { '720p': 0.08, '1080p': 0.10, '4K': 0.25 },
  },
  'veo-3.1-lite-generate-001': {
    withAudio:  { '720p': 0.05, '1080p': 0.08 },
    videoOnly:  { '720p': 0.03, '1080p': 0.05 },
  },
};

/** Lyria — flat per generation; the API returns no usage metadata. */
export const AUDIO_MODEL_RATES: Record<string, FlatRates> = {
  'lyria-3-pro-preview':  { perGeneration: 0.08 },  // full song, up to 3 min
  'lyria-3-clip-preview': { perGeneration: 0.04 },  // 30s clip
  'lyria-002':            { perGeneration: 0.06 },  // Lyria 2, per 30s
};

/** TTS bills as normal Gemini tokens. */
export const TTS_MODEL_RATES: Record<string, TokenRates> = {
  'gemini-2.5-flash-preview-tts': { input: 0.50, output: 10.00 },
  'gemini-2.5-flash-tts':         { input: 0.50, output: 10.00 },
};

export function tokenRatesFor(model: string): TokenRates | undefined {
  return TEXT_MODEL_RATES[model] ?? IMAGE_MODEL_RATES[model] ?? TTS_MODEL_RATES[model];
}

export function isKnownModel(model: string): boolean {
  return !!(tokenRatesFor(model) || VIDEO_MODEL_RATES[model] || AUDIO_MODEL_RATES[model]);
}

/**
 * Rough cost of one generated image, for UI hints only. Real billing uses the
 * token counts Vertex reports; this just lets the picker show a ballpark
 * without duplicating rate numbers in component files.
 */
export function estimateImageCost(model: string, resolution = '1K'): number | null {
  const rates = IMAGE_MODEL_RATES[model];
  if (!rates?.imageOutput) return null;
  const table = model === 'gemini-3-pro-image' ? IMAGE_OUTPUT_TOKENS_PRO : IMAGE_OUTPUT_TOKENS;
  const tokens = table[resolution] ?? table['1K'];
  return (tokens / 1_000_000) * rates.imageOutput;
}

/** Cost of one video, from request params (Veo reports no usage metadata). */
export function estimateVideoCost(
  model: string,
  opts: { durationSeconds?: number; resolution?: string; audio?: boolean },
): number {
  const rates = VIDEO_MODEL_RATES[model];
  if (!rates) return 0;
  const table = opts.audio === false ? rates.videoOnly : rates.withAudio;
  const perSecond = table[opts.resolution ?? '720p'] ?? table['720p'];
  if (perSecond === undefined) return 0;
  return perSecond * (opts.durationSeconds ?? 8);
}

/**
 * Cost calculation for Vertex generations.
 *
 * Rate tables live in `src/lib/pricing.ts` so the frontend and backend share one
 * source of truth; this module turns a Vertex usage payload into dollars.
 *
 * How Vertex actually reports usage (verified live 2026-08-10):
 *   - `candidatesTokensDetails` splits output by modality, e.g. a Nano Banana 1
 *     response is `[{TEXT: 8}, {IMAGE: 1290}]`. Those buckets bill at different
 *     rates, so we must not apply one blended rate to `candidatesTokenCount`.
 *   - `thoughtsTokenCount` is reported SEPARATELY and is excluded from
 *     `candidatesTokenCount`, but Google bills it — their output SKU is
 *     "response and reasoning". A trivial 3-flash call measured out=1,
 *     thoughts=111, so ignoring it under-billed by ~100x.
 *   - Veo returns no usage at all, so video is priced from request params.
 */

import {
  AUDIO_MODEL_RATES,
  LONG_CONTEXT_THRESHOLD,
  VIDEO_MODEL_RATES,
  estimateVideoCost,
  isKnownModel,
  tokenRatesFor,
  type TokenRates,
} from '../../src/lib/pricing.ts';

export {
  AUDIO_MODEL_RATES,
  IMAGE_MODEL_RATES,
  TEXT_MODEL_RATES,
  VIDEO_MODEL_RATES,
  estimateImageCost,
  estimateVideoCost,
  isKnownModel,
} from '../../src/lib/pricing.ts';

export interface ModalityTokens {
  modality?: string;
  tokenCount?: number;
}

export interface UsageMetrics {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  /** Reasoning tokens — billed at the text-output rate, not included above. */
  thoughtsTokenCount?: number;
  /** Portion of promptTokenCount served from cache (billed ~10%). */
  cachedContentTokenCount?: number;
  promptTokensDetails?: ModalityTokens[];
  candidatesTokensDetails?: ModalityTokens[];
  /** Number of images produced — only used as a fallback when details are absent. */
  imageCount?: number;
}

export interface GenerationParams {
  resolution?: string;
  duration?: number;
  sampleCount?: number;
  numberOfImages?: number;
  audio?: boolean;
}

const perMillion = (tokens: number, rate: number) => (tokens / 1_000_000) * rate;

function sumModality(details: ModalityTokens[] | undefined, modality: string): number {
  if (!details) return 0;
  return details
    .filter((d) => (d.modality || '').toUpperCase() === modality)
    .reduce((sum, d) => sum + (d.tokenCount || 0), 0);
}

function inputCost(usage: UsageMetrics, rates: TokenRates, inputRate: number): number {
  const total = usage.promptTokenCount || 0;
  const cached = Math.min(usage.cachedContentTokenCount || 0, total);
  const audio = Math.min(sumModality(usage.promptTokensDetails, 'AUDIO'), total - cached);
  const standard = Math.max(total - cached - audio, 0);

  return (
    perMillion(cached, rates.cachedInput ?? inputRate * 0.1) +
    perMillion(audio, rates.audioInput ?? inputRate) +
    perMillion(standard, inputRate)
  );
}

function outputCost(usage: UsageMetrics, rates: TokenRates, outputRate: number): number {
  const details = usage.candidatesTokensDetails;
  const imageRate = rates.imageOutput ?? outputRate;

  let imageTokens = sumModality(details, 'IMAGE');
  let textTokens = sumModality(details, 'TEXT');

  // Older/!detailed responses: fall back to the flat candidate count, attributing
  // it to images only when the call actually produced images.
  if (!details || details.length === 0) {
    const candidates = usage.candidatesTokenCount || 0;
    if (usage.imageCount && usage.imageCount > 0 && rates.imageOutput) {
      imageTokens = candidates;
      textTokens = 0;
    } else {
      imageTokens = 0;
      textTokens = candidates;
    }
  }

  // Reasoning is billed at the text-output rate.
  const thoughts = usage.thoughtsTokenCount || 0;

  return perMillion(imageTokens, imageRate) + perMillion(textTokens + thoughts, outputRate);
}

export function calculateCost(model: string, usage: UsageMetrics, params?: GenerationParams): number {
  if (!model) return 0;

  // Video — no usage metadata, priced from the request.
  if (VIDEO_MODEL_RATES[model]) {
    return estimateVideoCost(model, {
      durationSeconds: params?.duration,
      resolution: params?.resolution,
      audio: params?.audio,
    });
  }

  // Music — flat per generation.
  const flat = AUDIO_MODEL_RATES[model];
  if (flat) return flat.perGeneration;

  const rates = tokenRatesFor(model);
  if (!rates) {
    // Loud on purpose: an unpriced model silently bills $0 and disappears from
    // every cost report, which is how spend goes unnoticed.
    console.warn(`[Pricing] UNPRICED MODEL "${model}" — billing $0. Add it to src/lib/pricing.ts.`);
    return 0;
  }

  // Above 200K prompt tokens, some models bill every token at long-context rates.
  const isLong = (usage.promptTokenCount || 0) > LONG_CONTEXT_THRESHOLD;
  const inRate = isLong && rates.longContext ? rates.longContext.input : rates.input;
  const outRate = isLong && rates.longContext ? rates.longContext.output : rates.output;

  const total = inputCost(usage, rates, inRate) + outputCost(usage, rates, outRate);

  const detail = (usage.candidatesTokensDetails || [])
    .map((d) => `${d.modality}:${d.tokenCount}`)
    .join(' ') || `candidates:${usage.candidatesTokenCount ?? 0}`;
  console.log(
    `[Pricing] ${model}: in=${usage.promptTokenCount ?? 0}` +
    (usage.cachedContentTokenCount ? ` (cached ${usage.cachedContentTokenCount})` : '') +
    ` out=[${detail}] thoughts=${usage.thoughtsTokenCount ?? 0}` +
    (isLong ? ' LONG-CONTEXT' : '') +
    ` → $${total.toFixed(6)}`,
  );

  return total;
}

export function categorizeCost(model: string): 'text' | 'image' | 'video' | 'audio' {
  if (model.includes('veo')) return 'video';
  if (model.includes('lyria') || model.includes('tts')) return 'audio';
  if (model.includes('image')) return 'image';
  return 'text';
}

/** Back-compat alias — older call sites imported this name. */
export const MODEL_PRICING = new Proxy({} as Record<string, unknown>, {
  get: (_t, key: string) => tokenRatesFor(key) ?? VIDEO_MODEL_RATES[key] ?? AUDIO_MODEL_RATES[key],
  has: (_t, key: string) => isKnownModel(key),
});

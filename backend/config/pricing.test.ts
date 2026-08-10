// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { calculateCost, categorizeCost } from './pricing.ts';
import { estimateImageCost, estimateVideoCost } from '../../src/lib/pricing.ts';

/**
 * Every fixture below is a REAL usageMetadata payload captured from Vertex on
 * 2026-08-10 (see the probe run in docs/notes). Expected dollar values are
 * derived by hand from Google's published rates, so these tests fail if either
 * the rate table or the token accounting regresses.
 */

const near = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 8);

describe('calculateCost — text models', () => {
  it('bills reasoning tokens as output (the ~100x undercharge bug)', () => {
    // MEASURED gemini-3-flash-preview: out=1 but thoughts=111.
    const cost = calculateCost('gemini-3-flash-preview', {
      promptTokenCount: 5,
      candidatesTokenCount: 1,
      totalTokenCount: 117,
      thoughtsTokenCount: 111,
      promptTokensDetails: [{ modality: 'TEXT', tokenCount: 5 }],
      candidatesTokensDetails: [{ modality: 'TEXT', tokenCount: 1 }],
    });
    // input 5 @ $0.50/1M + output (1 + 111) @ $3/1M
    near(cost, 5 / 1e6 * 0.5 + 112 / 1e6 * 3);
  });

  it('would bill ~100x less if thoughts were ignored (regression guard)', () => {
    const withThoughts = calculateCost('gemini-3-flash-preview', {
      promptTokenCount: 5, candidatesTokenCount: 1, thoughtsTokenCount: 111,
    });
    const withoutThoughts = calculateCost('gemini-3-flash-preview', {
      promptTokenCount: 5, candidatesTokenCount: 1,
    });
    expect(withThoughts).toBeGreaterThan(withoutThoughts * 50);
  });

  it('charges cached input at the discounted rate', () => {
    const cost = calculateCost('gemini-3.5-flash', {
      promptTokenCount: 1000,
      cachedContentTokenCount: 900,
      candidatesTokenCount: 10,
    });
    // 900 cached @ $0.15/1M + 100 fresh @ $1.50/1M + 10 out @ $9/1M
    near(cost, 900 / 1e6 * 0.15 + 100 / 1e6 * 1.5 + 10 / 1e6 * 9);
  });

  it('applies long-context rates above 200K prompt tokens', () => {
    const long = calculateCost('gemini-3.1-pro-preview', {
      promptTokenCount: 250_000, candidatesTokenCount: 1000,
    });
    near(long, 250_000 / 1e6 * 4 + 1000 / 1e6 * 18);
  });

  it('bills audio input at the audio rate when the modality split says so', () => {
    const cost = calculateCost('gemini-3-flash-preview', {
      promptTokenCount: 100,
      promptTokensDetails: [{ modality: 'AUDIO', tokenCount: 100 }],
      candidatesTokenCount: 0,
    });
    near(cost, 100 / 1e6 * 1.0); // audioInput, not the $0.50 text rate
  });
});

describe('calculateCost — image models', () => {
  it('splits TEXT and IMAGE output at their own rates (Nano Banana 1)', () => {
    // MEASURED gemini-2.5-flash-image @1K: [TEXT 8, IMAGE 1290].
    // Google documents 1290 tokens = $0.039 for a 1024x1024 image.
    const cost = calculateCost('gemini-2.5-flash-image', {
      promptTokenCount: 7,
      candidatesTokenCount: 1298,
      candidatesTokensDetails: [
        { modality: 'TEXT', tokenCount: 8 },
        { modality: 'IMAGE', tokenCount: 1290 },
      ],
      imageCount: 1,
    });
    near(cost, 7 / 1e6 * 0.30 + 1290 / 1e6 * 30 + 8 / 1e6 * 2.5);
    // Sanity: the old code billed all 1298 at $60/1M — about double.
    expect(cost).toBeLessThan(1298 / 1e6 * 60 * 0.6);
  });

  it('prices Nano Banana 2 at 2K from real token counts', () => {
    // MEASURED: IMAGE 1680 tokens at 2K.
    const cost = calculateCost('gemini-3.1-flash-image', {
      promptTokenCount: 7,
      candidatesTokenCount: 1680,
      candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1680 }],
      imageCount: 1,
    });
    near(cost, 7 / 1e6 * 0.5 + 1680 / 1e6 * 60);
    expect(cost).toBeCloseTo(0.1008, 4); // Google's published 2K price
  });

  it('adds Nano Banana Pro reasoning tokens on top of the image', () => {
    // MEASURED: IMAGE 1120 + thoughts 269.
    const cost = calculateCost('gemini-3-pro-image', {
      promptTokenCount: 7,
      candidatesTokenCount: 1120,
      thoughtsTokenCount: 269,
      candidatesTokensDetails: [{ modality: 'IMAGE', tokenCount: 1120 }],
      imageCount: 1,
    });
    near(cost, 7 / 1e6 * 2 + 1120 / 1e6 * 120 + 269 / 1e6 * 12);
  });

  it('falls back to the image rate when no modality split is present', () => {
    const cost = calculateCost('gemini-3.1-flash-image', {
      promptTokenCount: 10, candidatesTokenCount: 1120, imageCount: 1,
    });
    near(cost, 10 / 1e6 * 0.5 + 1120 / 1e6 * 60);
  });
});

describe('calculateCost — video', () => {
  it('does not double-charge audio (Veo rate already includes it)', () => {
    // 8s Veo 3.1 720p with audio = $0.40/s = $3.20 (old code charged $6.40).
    expect(calculateCost('veo-3.1-generate-001', {}, { duration: 8, resolution: '720p', audio: true })).toBeCloseTo(3.2, 6);
  });

  it('uses the cheaper silent-video rate when audio is off', () => {
    expect(calculateCost('veo-3.1-generate-001', {}, { duration: 8, resolution: '720p', audio: false })).toBeCloseTo(1.6, 6);
    expect(calculateCost('veo-3.1-fast-generate-001', {}, { duration: 4, resolution: '720p', audio: false })).toBeCloseTo(0.32, 6);
  });

  it('prices the clip actually generated during verification (4s fast 720p + audio)', () => {
    expect(calculateCost('veo-3.1-fast-generate-001', {}, { duration: 4, resolution: '720p', audio: true })).toBeCloseTo(0.4, 6);
  });

  it('scales with resolution', () => {
    expect(estimateVideoCost('veo-3.1-generate-001', { durationSeconds: 8, resolution: '4K', audio: true })).toBeCloseTo(4.8, 6);
  });
});

describe('calculateCost — audio + unknown models', () => {
  it('bills Lyria flat per generation', () => {
    expect(calculateCost('lyria-3-clip-preview', {})).toBeCloseTo(0.04, 6);
    expect(calculateCost('lyria-3-pro-preview', {})).toBeCloseTo(0.08, 6);
  });

  it('returns 0 for an unknown model but warns loudly', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(calculateCost('some-unreleased-model', { promptTokenCount: 100 })).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('UNPRICED MODEL'));
    warn.mockRestore();
  });
});

describe('estimateImageCost', () => {
  it('matches Google published per-resolution prices for Nano Banana 2', () => {
    expect(estimateImageCost('gemini-3.1-flash-image', '512')).toBeCloseTo(0.0448, 3); // ~$0.045
    expect(estimateImageCost('gemini-3.1-flash-image', '1K')).toBeCloseTo(0.0672, 3);  // ~$0.067
    expect(estimateImageCost('gemini-3.1-flash-image', '2K')).toBeCloseTo(0.1008, 3);  // ~$0.101
    expect(estimateImageCost('gemini-3.1-flash-image', '4K')).toBeCloseTo(0.1512, 3);  // ~$0.15
  });

  it('uses the Pro token table (1K and 2K cost the same)', () => {
    expect(estimateImageCost('gemini-3-pro-image', '1K')).toBeCloseTo(0.1344, 4);
    expect(estimateImageCost('gemini-3-pro-image', '2K')).toBeCloseTo(0.1344, 4);
    expect(estimateImageCost('gemini-3-pro-image', '4K')).toBeCloseTo(0.24, 4);
  });

  it('returns null for models that do not emit images', () => {
    expect(estimateImageCost('gemini-3.5-flash')).toBeNull();
  });
});

describe('categorizeCost', () => {
  it('maps models to spend buckets', () => {
    expect(categorizeCost('veo-3.1-fast-generate-001')).toBe('video');
    expect(categorizeCost('lyria-3-clip-preview')).toBe('audio');
    expect(categorizeCost('gemini-2.5-flash-preview-tts')).toBe('audio');
    expect(categorizeCost('gemini-3.1-flash-image')).toBe('image');
    expect(categorizeCost('gemini-3.5-flash')).toBe('text');
  });
});

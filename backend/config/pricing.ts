export const MODEL_PRICING: Record<string, any> = {
  // Imagen 4 (per image)
  'imagen-4.0-ultra-generate-001': { perImage: 0.06 },
  'imagen-4.0-generate-001': { perImage: 0.04 },
  'imagen-4.0-fast-generate-001': { perImage: 0.02 },
  'imagen-4-upscale': { perImage: 0.06 },
  'imagen-1-upscale': { perImage: 0.003 },

  // Nano Banana — token-billed only (image tokens are counted in candidatesTokenCount)
  'gemini-3.1-flash-image-preview': { input: 0.50, output: 3.00 },
  'gemini-2.5-flash-image':         { input: 0.50, output: 3.00 },
  'gemini-3-pro-image-preview':     { input: 2.00, output: 12.00 },

  // Veo 3.1 (per second)
  'veo-3.1-fast-generate-001': { '720p': 0.10, '1080p': 0.12, '4K': 0.30, withAudio: 0.10 },
  'veo-3.1-generate-001': { '720p': 0.40, '1080p': 0.40, '4K': 0.60, withAudio: 0.40 },

  // Lyria 3
  'lyria-3-pro-preview': { perSong: 0.08 },
  'lyria-3-clip-preview': { per30sClip: 0.04 },
  'gemini-2.5-flash-preview-tts': { per1kChars: 0.005 },

  // Gemini Text/Chat
  'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
  'gemini-3.1-pro-preview': { input: 2.00, output: 12.00 },
  'gemini-3.1-flash-lite-preview': { input: 0.25, output: 1.50 },
};

export interface UsageMetrics {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  imageCount?: number;
  videoSeconds?: number;
  audioSeconds?: number;
  characterCount?: number;
}

export interface GenerationParams {
  resolution?: string;
  duration?: number;
  sampleCount?: number;
  numberOfImages?: number;
  audio?: boolean;
}

export function calculateCost(model: string, usage: UsageMetrics, params?: GenerationParams): number {
  const pricing = MODEL_PRICING[model];
  if (!pricing) {
    console.log(`[Pricing] No pricing found for model: ${model}`);
    return 0;
  }

  // Per-image pricing (Imagen 4, Nano Banana for image generation)
  if (pricing.perImage !== undefined && (params?.numberOfImages || params?.sampleCount)) {
    const count = params?.numberOfImages || params?.sampleCount || 1;
    const cost = pricing.perImage * count;
    console.log(`[Pricing] ${model}: $${pricing.perImage} × ${count} images = $${cost.toFixed(4)}`);
    return cost;
  }

  // Token-based pricing for text generation
  if (pricing.input !== undefined && usage.promptTokenCount !== undefined) {
    const inputCost = (usage.promptTokenCount / 1_000_000) * pricing.input;
    const outputCost = ((usage.candidatesTokenCount || 0) / 1_000_000) * (pricing.output || 0);
    return inputCost + outputCost;
  }

  // Video pricing (per second)
  if (pricing['720p'] !== undefined && params?.duration) {
    const baseCost = pricing[params.resolution || '720p'] || pricing['720p'];
    const audioCost = params.audio ? (pricing.withAudio || 0) : 0;
    return (baseCost + audioCost) * params.duration;
  }

  // Lyria pricing
  if (pricing.perSong !== undefined) {
    return pricing.perSong;
  }

  if (pricing.per30sClip !== undefined) {
    return pricing.per30sClip;
  }

  // TTS pricing
  if (pricing.per1kChars !== undefined && usage.characterCount) {
    return (usage.characterCount / 1000) * pricing.per1kChars;
  }

  return 0;
}

export function categorizeCost(model: string): 'text' | 'image' | 'video' | 'audio' {
  if (model.includes('veo')) return 'video';
  if (model.includes('lyria') || model.includes('tts')) return 'audio';
  if (model.startsWith('imagen') || model.includes('image')) return 'image';
  return 'text';
}

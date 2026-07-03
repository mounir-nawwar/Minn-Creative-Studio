export const MODEL_PRICING: Record<string, any> = {
  // Imagen 4 (per image, flat rate)
  'imagen-4.0-ultra-generate-001': { perImage: 0.06 },
  'imagen-4.0-generate-001':       { perImage: 0.04 },
  'imagen-4.0-fast-generate-001':  { perImage: 0.02 },
  'imagen-4-upscale':              { perImage: 0.06 },
  'imagen-1-upscale':              { perImage: 0.003 },

  // Gemini image-generating models — token-billed
  // imageOutput is the per-1M-token rate for image output tokens (separate from text output)
  'gemini-3.1-flash-image-preview': { input: 0.50,  output: 3.00,  imageOutput: 60.00  },
  'gemini-2.5-flash-image':         { input: 0.50,  output: 3.00,  imageOutput: 60.00  },
  'gemini-3-pro-image-preview':     { input: 2.00,  output: 12.00, imageOutput: 120.00 },

  // Veo (per second of video generated)
  'veo-3.1-fast-generate-001': { '720p': 0.10, '1080p': 0.12, '4K': 0.30, withAudio: 0.10 },
  'veo-3.1-generate-001':      { '720p': 0.40, '1080p': 0.40, '4K': 0.60, withAudio: 0.40 },

  // Lyria 3 (flat per generation)
  'lyria-3-pro-preview':          { perSong: 0.08 },
  'lyria-3-clip-preview':         { per30sClip: 0.04 },

  // TTS (per 1K input characters)
  'gemini-2.5-flash-preview-tts': { per1kChars: 0.005 },

  // Gemini text/chat models
  'gemini-3.5-flash':             { input: 1.50,  output: 9.00  },
  'gemini-3-flash-preview':       { input: 0.50,  output: 3.00,  audioInput: 1.00  },
  'gemini-3.1-pro-preview':       { input: 2.00,  output: 12.00 },
  'gemini-3.1-flash-lite-preview':{ input: 0.25,  output: 1.50,  audioInput: 0.50  },
};

export interface UsageMetrics {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  imageCount?: number;    // number of images generated — used to select imageOutput rate
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

  // Flat per-image pricing (Imagen 4 family)
  if (pricing.perImage !== undefined) {
    const count = params?.numberOfImages || params?.sampleCount || 1;
    const cost = pricing.perImage * count;
    console.log(`[Pricing] ${model}: $${pricing.perImage} × ${count} images = $${cost.toFixed(4)}`);
    return cost;
  }

  // Token-based pricing (Gemini text + image-generating models)
  if (pricing.input !== undefined && usage.promptTokenCount !== undefined) {
    const inputCost = (usage.promptTokenCount / 1_000_000) * pricing.input;

    // Use imageOutput rate when images were generated; fall back to text output rate
    const outputRate = (usage.imageCount && usage.imageCount > 0 && pricing.imageOutput)
      ? pricing.imageOutput
      : (pricing.output || 0);
    const outputCost = ((usage.candidatesTokenCount || 0) / 1_000_000) * outputRate;

    const total = inputCost + outputCost;
    console.log(`[Pricing] ${model}: in=${usage.promptTokenCount} out=${usage.candidatesTokenCount} images=${usage.imageCount ?? 0} rate=$${outputRate}/1M → $${total.toFixed(6)}`);
    return total;
  }

  // Video pricing (per second × number of videos)
  if (pricing['720p'] !== undefined && params?.duration) {
    const baseCost = pricing[params.resolution || '720p'] || pricing['720p'];
    const audioCost = params.audio ? (pricing.withAudio || 0) : 0;
    return (baseCost + audioCost) * params.duration;
  }

  // Lyria flat pricing
  if (pricing.perSong !== undefined) return pricing.perSong;
  if (pricing.per30sClip !== undefined) return pricing.per30sClip;

  // TTS character-based pricing
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

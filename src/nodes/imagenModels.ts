export const ASPECT_RATIO_DESCRIPTIONS: Record<string, string> = {
  '1:1': '1:1 (Square)',
  '4:3': '4:3 (Standard)',
  '3:4': '3:4 (Vertical)',
  '3:2': '3:2 (Photo Landscape)',
  '2:3': '2:3 (Photo Portrait)',
  '5:4': '5:4 (Art Print)',
  '4:5': '4:5 (Instagram Grid)',
  '16:9': '16:9 (Widescreen)',
  '9:16': '9:16 (Stories / Reels)',
  '21:9': '21:9 (Cinematic)',
  '4:1': '4:1 (LinkedIn Banner)',
  '1:4': '1:4 (Tall Portrait)',
  '8:1': '8:1 (Panorama)',
  '1:8': '1:8 (Skyscraper)',
  '9:21': '9:21 (Mobile Ultrawide)',
};

export function getAspectRatioLabel(ar: string): string {
  return ASPECT_RATIO_DESCRIPTIONS[ar] || ar;
}

export interface ImageModelSupports {
  aspectRatio: string[] | false;
  resolution?: string[] | false;
  sampleCount?: boolean;
  seed?: boolean;
  personGeneration?: boolean;
  enhancePrompt?: boolean;
  addWatermark?: boolean;
  safetySetting?: boolean;
  referenceImages?: boolean;
  style?: boolean;
  negativePrompt?: boolean;
  temperature?: boolean;
  topP?: boolean;
  topK?: boolean;
  candidateCount?: boolean;
  mimeType?: boolean;
  grounding?: boolean;
  safetyFilters?: boolean;
  thinkingLevel?: boolean;
}

export interface ImageModel {
  id: string;
  label: string;
  price: number | null;
  family: string;
  supports: ImageModelSupports;
}

/**
 * Image models offered in the studio.
 *
 * The Imagen 4 family was removed: every `imagen-*` id returns 404 NOT_FOUND on
 * this Vertex project (verified across us-central1 / us-east4 / europe-west4 /
 * global, 11 id variants) because the Gemini Enterprise Agent Platform tier
 * ships a restricted catalogue without Imagen. Selecting one only produced
 * errors. Re-add here (and in backend/config/pricing.ts) if Imagen is ever
 * enabled on the project.
 */
export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'gemini-3.1-flash-image',
    label: 'Nano Banana 2',
    price: null,
    family: 'nanoBanana2',
    supports: {
      aspectRatio: ['1:1', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '16:9', '9:16', '21:9', '4:1', '1:4', '8:1', '1:8', '9:21'],
      resolution: ['512', '768', '1K', '2K', '4K'],
      candidateCount: true,
      temperature: true,
      topP: true,
      topK: true,
      seed: true,
      mimeType: true,
      safetyFilters: true,
      grounding: true,
      referenceImages: true,
      style: true,
      negativePrompt: false,
      sampleCount: false,
      personGeneration: false,
      enhancePrompt: false,
      addWatermark: false,
      safetySetting: false,
    }
  },
  {
    id: 'gemini-2.5-flash-image',
    label: 'Nano Banana 1',
    price: null,
    family: 'nanoBanana',
    supports: {
      aspectRatio: ['1:1', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '16:9', '9:16', '21:9', '4:1', '1:4', '8:1', '1:8', '9:21'],
      resolution: ['512', '768', '1K', '2K'],
      candidateCount: true,
      temperature: true,
      topP: true,
      topK: true,
      seed: true,
      mimeType: true,
      safetyFilters: true,
      grounding: false,
      referenceImages: true,
      style: true,
      negativePrompt: false,
      sampleCount: false,
      personGeneration: false,
      enhancePrompt: false,
      addWatermark: false,
      safetySetting: false,
    }
  },
  {
    id: 'gemini-3-pro-image',
    label: 'Nano Banana Pro',
    price: null,
    family: 'nanoBananaPro',
    supports: {
      aspectRatio: ['1:1', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '16:9', '9:16', '21:9', '4:1', '1:4', '8:1', '1:8', '9:21'],
      // 512/768 are rejected by this model with 400 INVALID_ARGUMENT (verified live)
      resolution: ['1K', '2K', '4K'],
      candidateCount: true,
      temperature: true,
      topP: true,
      topK: true,
      seed: true,
      mimeType: true,
      safetyFilters: true,
      grounding: true,
      thinkingLevel: true,
      referenceImages: true,
      style: true,
      negativePrompt: false,
      sampleCount: false,
      personGeneration: false,
      enhancePrompt: false,
      addWatermark: false,
      safetySetting: false,
    }
  },
];

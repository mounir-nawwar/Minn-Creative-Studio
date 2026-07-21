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

export const IMAGE_MODELS: ImageModel[] = [
  {
    id: 'imagen-4.0-ultra-generate-001',
    label: 'Imagen 4 Ultra',
    price: 0.06,
    family: 'imagen4',
    supports: {
      aspectRatio: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      sampleCount: true,
      seed: true,
      personGeneration: true,
      enhancePrompt: true,
      addWatermark: true,
      safetySetting: true,
      referenceImages: false,
      style: false,
      negativePrompt: false,
      resolution: false,
      temperature: false,
      topP: false,
      topK: false,
      candidateCount: false,
      mimeType: false,
      grounding: false,
    }
  },
  {
    id: 'imagen-4.0-generate-001',
    label: 'Imagen 4',
    price: 0.04,
    family: 'imagen4',
    supports: {
      aspectRatio: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      sampleCount: true,
      seed: true,
      personGeneration: true,
      enhancePrompt: true,
      addWatermark: true,
      safetySetting: true,
      referenceImages: false,
      style: false,
      negativePrompt: false,
      resolution: false,
      temperature: false,
      topP: false,
      topK: false,
      candidateCount: false,
      mimeType: false,
      grounding: false,
    }
  },
  {
    id: 'imagen-4.0-fast-generate-001',
    label: 'Imagen 4 Fast',
    price: 0.02,
    family: 'imagen4',
    supports: {
      aspectRatio: ['1:1', '3:4', '4:3', '9:16', '16:9'],
      sampleCount: true,
      seed: true,
      personGeneration: true,
      enhancePrompt: true,
      addWatermark: true,
      safetySetting: true,
      referenceImages: false,
      style: false,
      negativePrompt: false,
      resolution: false,
      temperature: false,
      topP: false,
      topK: false,
      candidateCount: false,
      mimeType: false,
      grounding: false,
    }
  },
  {
    id: 'gemini-3.1-flash-image',
    label: 'Nano Banana 2',
    price: null,
    family: 'nanoBanana2',
    supports: {
      aspectRatio: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:8', '8:1'],
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
      aspectRatio: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
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
      aspectRatio: ['1:1', '3:2', '2:3', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9'],
      resolution: ['512', '768', '1K', '2K', '4K'],
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

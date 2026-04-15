import { HandleType } from './handleTypes';

export const CONNECTION_VALIDATION_RULES: Record<string, {
  allowedInputs?: HandleType[];
  allowedOutputs?: HandleType[];
  blockedConnections?: Array<{
    from: string;
    to: string;
    reason: string;
  }>;
}> = {
  seed: {
    allowedInputs: ['unknown', 'number', 'text'],
    allowedOutputs: ['seed'],
    blockedConnections: [
      { from: 'imageUpload', to: 'seed', reason: 'Image upload cannot connect to seed input' },
      { from: 'videoUpload', to: 'seed', reason: 'Video upload cannot connect to seed input' },
      { from: 'imagen', to: 'seed', reason: 'Image generation output cannot feed back to seed' },
      { from: 'veo', to: 'seed', reason: 'Video generation output cannot feed back to seed' }
    ]
  },

  imagen: {
    allowedInputs: ['prompt', 'seed', 'image', 'number'],
    allowedOutputs: ['image']
  },

  veo: {
    allowedInputs: ['prompt', 'image', 'seed', 'video', 'motion'],
    allowedOutputs: ['video']
  },

  llm: {
    allowedInputs: ['text', 'image'],
    allowedOutputs: ['text']
  },

  lyria: {
    allowedInputs: ['text', 'image', 'seed'],
    allowedOutputs: ['audio']
  },

  imageToVideo: {
    allowedInputs: ['image', 'prompt', 'motion', 'seed'],
    allowedOutputs: ['video']
  },

  resize: {
    allowedInputs: ['image'],
    allowedOutputs: ['image']
  },

  blur: {
    allowedInputs: ['image'],
    allowedOutputs: ['image']
  },

  crop: {
    allowedInputs: ['image'],
    allowedOutputs: ['image']
  },

  invert: {
    allowedInputs: ['image'],
    allowedOutputs: ['image']
  },

  levels: {
    allowedInputs: ['image'],
    allowedOutputs: ['image']
  },

  channels: {
    allowedInputs: ['image'],
    allowedOutputs: ['image']
  },

  relight: {
    allowedInputs: ['image'],
    allowedOutputs: ['image']
  },

  imageUpscaler: {
    allowedInputs: ['image'],
    allowedOutputs: ['image']
  },

  maskExtractor: {
    allowedInputs: ['image'],
    allowedOutputs: ['mask']
  },

  maskByText: {
    allowedInputs: ['image', 'prompt'],
    allowedOutputs: ['mask']
  },

  matteAdjust: {
    allowedInputs: ['mask'],
    allowedOutputs: ['mask']
  },

  mergeAlpha: {
    allowedInputs: ['image', 'mask'],
    allowedOutputs: ['image']
  },

  videoUpscaler: {
    allowedInputs: ['video'],
    allowedOutputs: ['video']
  },

  frameInterpolator: {
    allowedInputs: ['video'],
    allowedOutputs: ['video']
  },

  videoMatte: {
    allowedInputs: ['video'],
    allowedOutputs: ['video']
  },

  prompt: {
    allowedInputs: [],
    allowedOutputs: ['prompt']
  },

  listSelector: {
    allowedInputs: [],
    allowedOutputs: ['text']
  },

  number: {
    allowedInputs: [],
    allowedOutputs: ['number']
  },

  text: {
    allowedInputs: [],
    allowedOutputs: ['text']
  },

  array: {
    allowedInputs: [],
    allowedOutputs: ['array']
  },

  toggle: {
    allowedInputs: [],
    allowedOutputs: ['boolean']
  },

  styleTransfer: {
    allowedInputs: ['image'],
    allowedOutputs: ['image']
  },

  compare: {
    allowedInputs: ['image'],
    allowedOutputs: ['image']
  },

  batchOutputSizer: {
    allowedInputs: ['image'],
    allowedOutputs: ['image']
  }
};

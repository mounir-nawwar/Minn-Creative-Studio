import { NodeType } from '../types';
import { HandleDefinition } from './handleTypes';

export const NODE_HANDLES: Record<NodeType | 'default', {
  inputs: HandleDefinition[];
  outputs: HandleDefinition[];
}> = {
  default: {
    inputs: [{ id: 'input', type: 'unknown', label: 'Input' }],
    outputs: [{ id: 'output', type: 'unknown', label: 'Output' }]
  },

  seed: {
    inputs: [{ id: 'input', type: 'unknown', label: 'Input' }],
    outputs: [{ id: 'seed', type: 'seed', label: 'Seed' }]
  },

  imageUpload: {
    inputs: [],
    outputs: [{ id: 'image', type: 'image', label: 'Image' }]
  },
  videoUpload: {
    inputs: [],
    outputs: [{ id: 'video', type: 'video', label: 'Video' }]
  },

  prompt: {
    inputs: [],
    outputs: [{ id: 'prompt', type: 'prompt', label: 'Prompt' }]
  },
  promptConcatenator: {
    inputs: [
      { id: 'in1', type: 'prompt', label: 'Prompt 1' },
      { id: 'in2', type: 'prompt', label: 'Prompt 2' },
      { id: 'in3', type: 'prompt', label: 'Prompt 3' },
      { id: 'in4', type: 'prompt', label: 'Prompt 4' }
    ],
    outputs: [{ id: 'prompt', type: 'prompt', label: 'Combined Prompt' }]
  },
  promptEnhancer: {
    inputs: [{ id: 'prompt', type: 'prompt', label: 'Input Prompt' }],
    outputs: [{ id: 'prompt', type: 'prompt', label: 'Enhanced Prompt' }]
  },
  promptLibrary: {
    inputs: [],
    outputs: [{ id: 'prompt', type: 'prompt', label: 'Prompt' }]
  },

  llm: {
    inputs: [
      { id: 'text', type: 'text', label: 'Input Text' },
      { id: 'image', type: 'image', label: 'Input Image (Optional)' }
    ],
    outputs: [{ id: 'text', type: 'text', label: 'Generated Text' }]
  },
  imagen: {
    inputs: [
      { id: 'prompt', type: 'prompt', label: 'Prompt' },
      { id: 'reference', type: 'image', label: 'Reference Image (Optional)' },
      { id: 'seed', type: 'seed', label: 'Seed (Optional)' },
      { id: 'guidance', type: 'number', label: 'Guidance Strength' },
      { id: 'cfg', type: 'number', label: 'CFG Scale' }
    ],
    outputs: [{ id: 'image', type: 'image', label: 'Generated Image' }]
  },
  veo: {
    inputs: [
      { id: 'prompt', type: 'prompt', label: 'Prompt' },
      { id: 'startFrame', type: 'image', label: 'Start Frame (Optional)' },
      { id: 'endFrame', type: 'image', label: 'End Frame (Optional)' },
      { id: 'reference', type: 'image', label: 'Reference Images' },
      { id: 'video', type: 'video', label: 'Input Video (Optional)' },
      { id: 'motion', type: 'motion', label: 'Motion Data (Optional)' },
      { id: 'seed', type: 'seed', label: 'Seed (Optional)' }
    ],
    outputs: [{ id: 'video', type: 'video', label: 'Generated Video' }]
  },
  nanoBanana: {
    inputs: [
      { id: 'prompt', type: 'prompt', label: 'Prompt' },
      { id: 'seed', type: 'seed', label: 'Seed (Optional)' }
    ],
    outputs: [{ id: 'image', type: 'image', label: 'Generated Image' }]
  },
  lyria: {
    inputs: [
      { id: 'prompt', type: 'text', label: 'Text Prompt' },
      { id: 'reference', type: 'image', label: 'Reference (Optional)' },
      { id: 'seed', type: 'seed', label: 'Seed (Optional)' }
    ],
    outputs: [{ id: 'audio', type: 'audio', label: 'Generated Audio' }]
  },
  imageToVideo: {
    inputs: [
      { id: 'start', type: 'image', label: 'Start Image' },
      { id: 'end', type: 'image', label: 'End Image (Optional)' },
      { id: 'reference', type: 'image', label: 'Reference Images' },
      { id: 'prompt', type: 'prompt', label: 'Prompt (Optional)' },
      { id: 'motion', type: 'motion', label: 'Motion Data (Optional)' },
      { id: 'seed', type: 'seed', label: 'Seed (Optional)' }
    ],
    outputs: [{ id: 'video', type: 'video', label: 'Video' }]
  },
  videoDescriber: {
    inputs: [{ id: 'video', type: 'video', label: 'Video' }],
    outputs: [{ id: 'text', type: 'text', label: 'Description' }]
  },
  vision: {
    inputs: [{ id: 'image', type: 'image', label: 'Image' }],
    outputs: [{ id: 'text', type: 'text', label: 'Description' }]
  },
  imageDescriber: {
    inputs: [{ id: 'image', type: 'image', label: 'Image' }],
    outputs: [{ id: 'text', type: 'text', label: 'Description' }]
  },

  resize: {
    inputs: [{ id: 'image', type: 'image', label: 'Image' }],
    outputs: [{ id: 'image', type: 'image', label: 'Resized Image' }]
  },
  blur: {
    inputs: [{ id: 'image', type: 'image', label: 'Image' }],
    outputs: [{ id: 'image', type: 'image', label: 'Blurred Image' }]
  },
  crop: {
    inputs: [{ id: 'image', type: 'image', label: 'Image' }],
    outputs: [{ id: 'image', type: 'image', label: 'Cropped Image' }]
  },
  invert: {
    inputs: [{ id: 'image', type: 'image', label: 'Image' }],
    outputs: [{ id: 'image', type: 'image', label: 'Inverted Image' }]
  },
  levels: {
    inputs: [{ id: 'image', type: 'image', label: 'Image' }],
    outputs: [{ id: 'image', type: 'image', label: 'Adjusted Image' }]
  },
  channels: {
    inputs: [{ id: 'image', type: 'image', label: 'Image' }],
    outputs: [{ id: 'image', type: 'image', label: 'Processed Image' }]
  },
  relight: {
    inputs: [{ id: 'image', type: 'image', label: 'Image' }],
    outputs: [{ id: 'image', type: 'image', label: 'Relit Image' }]
  },
  imageUpscaler: {
    inputs: [{ id: 'image', type: 'image', label: 'Image' }],
    outputs: [{ id: 'image', type: 'image', label: 'Upscaled Image' }]
  },
  styleTransfer: {
    inputs: [
      { id: 'contentUrl', type: 'image', label: 'Content Image' },
      { id: 'styleUrl', type: 'image', label: 'Style Image' }
    ],
    outputs: [{ id: 'image', type: 'image', label: 'Styled Image' }]
  },
  variation: {
    inputs: [{ id: 'input', type: 'image', label: 'Input Image' }],
    outputs: [{ id: 'output', type: 'image', label: 'Variation' }]
  },
  inpainting: {
    inputs: [
      { id: 'image', type: 'image', label: 'Image' },
      { id: 'mask', type: 'mask', label: 'Mask' },
      { id: 'prompt', type: 'prompt', label: 'Prompt' }
    ],
    outputs: [{ id: 'image', type: 'image', label: 'Inpainted Image' }]
  },

  maskExtractor: {
    inputs: [{ id: 'image', type: 'image', label: 'Image' }],
    outputs: [{ id: 'mask', type: 'mask', label: 'Mask' }]
  },
  maskByText: {
    inputs: [
      { id: 'image', type: 'image', label: 'Image' },
      { id: 'prompt', type: 'prompt', label: 'Description' }
    ],
    outputs: [{ id: 'mask', type: 'mask', label: 'Mask' }]
  },
  matteAdjust: {
    inputs: [{ id: 'mask', type: 'mask', label: 'Mask' }],
    outputs: [{ id: 'mask', type: 'mask', label: 'Adjusted Mask' }]
  },
  mergeAlpha: {
    inputs: [
      { id: 'image', type: 'image', label: 'Image' },
      { id: 'mask', type: 'mask', label: 'Mask' }
    ],
    outputs: [{ id: 'image', type: 'image', label: 'Merged Image' }]
  },

  videoUpscaler: {
    inputs: [{ id: 'video', type: 'video', label: 'Video' }],
    outputs: [{ id: 'video', type: 'video', label: 'Upscaled Video' }]
  },
  frameInterpolator: {
    inputs: [{ id: 'video', type: 'video', label: 'Video' }],
    outputs: [{ id: 'video', type: 'video', label: 'Interpolated Video' }]
  },
  videoMatte: {
    inputs: [{ id: 'video', type: 'video', label: 'Video' }],
    outputs: [{ id: 'video', type: 'video', label: 'Matted Video' }]
  },
  videoMaskByText: {
    inputs: [
      { id: 'video', type: 'video', label: 'Video' },
      { id: 'prompt', type: 'prompt', label: 'Description' }
    ],
    outputs: [{ id: 'mask', type: 'mask', label: 'Mask' }]
  },

  number: {
    inputs: [],
    outputs: [{ id: 'number', type: 'number', label: 'Number' }]
  },
  text: {
    inputs: [],
    outputs: [{ id: 'text', type: 'text', label: 'Text' }]
  },
  array: {
    inputs: [
      { id: 'item1', type: 'unknown', label: 'Item 1' },
      { id: 'item2', type: 'unknown', label: 'Item 2' },
      { id: 'item3', type: 'unknown', label: 'Item 3' }
    ],
    outputs: [{ id: 'array', type: 'array', label: 'Array' }]
  },
  toggle: {
    inputs: [],
    outputs: [{ id: 'boolean', type: 'boolean', label: 'Boolean' }]
  },
  listSelector: {
    inputs: [],
    outputs: [{ id: 'text', type: 'text', label: 'Selected' }]
  },

  textIterator: {
    inputs: [
      { id: 'array', type: 'array', label: 'Text Array' },
      { id: 'index', type: 'number', label: 'Index' }
    ],
    outputs: [{ id: 'text', type: 'text', label: 'Current Text' }]
  },
  imageIterator: {
    inputs: [
      { id: 'array', type: 'array', label: 'Image Array' },
      { id: 'index', type: 'number', label: 'Index' }
    ],
    outputs: [{ id: 'image', type: 'image', label: 'Current Image' }]
  },
  videoIterator: {
    inputs: [
      { id: 'array', type: 'array', label: 'Video Array' },
      { id: 'index', type: 'number', label: 'Index' }
    ],
    outputs: [{ id: 'video', type: 'video', label: 'Current Video' }]
  },

  sequence: {
    inputs: [{ id: 'trigger', type: 'unknown', label: 'Trigger' }],
    outputs: [
      { id: 'step1', type: 'unknown', label: 'Step 1' },
      { id: 'step2', type: 'unknown', label: 'Step 2' },
      { id: 'step3', type: 'unknown', label: 'Step 3' }
    ]
  },

  cfgScale: {
    inputs: [],
    outputs: [{ id: 'number', type: 'number', label: 'CFG Scale' }]
  },
  guidanceStrength: {
    inputs: [],
    outputs: [{ id: 'number', type: 'number', label: 'Guidance Strength' }]
  },
  motionIntensity: {
    inputs: [],
    outputs: [{ id: 'number', type: 'number', label: 'Motion Intensity' }]
  },
  directorPrompt: {
    inputs: [],
    outputs: [{ id: 'prompt', type: 'prompt', label: 'Director Prompt' }]
  },
  cameraControl: {
    inputs: [],
    outputs: [{ id: 'text', type: 'text', label: 'Camera Settings' }]
  },

  output: {
    inputs: [{ id: 'input', type: 'unknown', label: 'Output' }],
    outputs: []
  },

  compare: {
    inputs: [
      { id: 'inputA', type: 'image', label: 'Input A' },
      { id: 'inputB', type: 'image', label: 'Input B' }
    ],
    outputs: [{ id: 'comparison', type: 'image', label: 'Comparison' }]
  },
  stickyNote: {
    inputs: [],
    outputs: []
  },

  compositor: {
    inputs: [
      { id: 'background', type: 'image', label: 'Background' },
      { id: 'foreground', type: 'image', label: 'Foreground' },
      { id: 'mask', type: 'mask', label: 'Mask (Optional)' }
    ],
    outputs: [{ id: 'image', type: 'image', label: 'Composited Image' }]
  },
  painter: {
    inputs: [
      { id: 'image', type: 'image', label: 'Image' },
      { id: 'prompt', type: 'prompt', label: 'Painting Instructions' }
    ],
    outputs: [{ id: 'image', type: 'image', label: 'Painted Image' }]
  },
  batchOutputSizer: {
    inputs: [{ id: 'imageUrl', type: 'image', label: 'Image' }],
    outputs: [{ id: 'image', type: 'image', label: 'Resized Image' }]
  },

  brandContext: {
    inputs: [],
    outputs: [{ id: 'context', type: 'json', label: 'Brand Context' }]
  }
};

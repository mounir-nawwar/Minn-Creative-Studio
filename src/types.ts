export type NodeType = 
  | 'prompt' 
  | 'promptConcatenator'
  | 'promptEnhancer'
  | 'promptLibrary'
  | 'llm'
  | 'vision' 
  | 'videoDescriber'
  | 'imageDescriber'
  | 'imagen' 
  | 'nanoBanana' 
  | 'veo' 
  | 'imageToVideo' 
  | 'lyria' 
  | 'levels'
  | 'compositor'
  | 'painter'
  | 'crop'
  | 'resize'
  | 'blur'
  | 'invert'
  | 'channels'
  | 'maskExtractor'
  | 'maskByText'
  | 'matteAdjust'
  | 'mergeAlpha'
  | 'videoMatte'
  | 'videoMaskByText'
  | 'textIterator'
  | 'imageIterator'
  | 'videoIterator'
  | 'number'
  | 'text'
  | 'toggle'
  | 'listSelector'
  | 'seed'
  | 'array'
  | 'stickyNote'
  | 'compare'
  | 'imageUpscaler'
  | 'videoUpscaler'
  | 'frameInterpolator'
  | 'relight'
  | 'styleTransfer'
  | 'batchOutputSizer'
  | 'guidanceStrength'
  | 'motionIntensity'
  | 'cfgScale'
  | 'directorPrompt'
  | 'cameraControl'
  | 'sequence'
  | 'imageUpload'
  | 'videoUpload'
  | 'output'
  | 'variation'
  | 'inpainting'
  | 'brandContext';

export interface NodeConfig {
  url?: string;
  fileName?: string;
  prompt?: string;
  negativePrompt?: string;
  seed?: number;
  aspectRatio?: string;
  numberOfImages?: number;
  model?: string;
  [key: string]: unknown;
}

export interface WorkflowNodeData {
  label: string;
  type: NodeType;
  config?: NodeConfig;
  output?: any;
  outputs?: any[];
  /** Lyria returns the lyrics it wrote for the track alongside the audio. */
  lyrics?: string;
  uploadEnabled?: boolean;
  error?: string | null;
  isRunning?: boolean;
  triggerRun?: number;
  progress?: string | number;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: { id: string; type?: string; position: { x: number; y: number }; data: WorkflowNodeData }[];
  edges: { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }[];
  createdAt: number;
  updatedAt: number;
}

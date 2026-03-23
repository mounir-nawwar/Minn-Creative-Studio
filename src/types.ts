export type NodeType = 
  | 'prompt' 
  | 'promptConcatenator'
  | 'promptEnhancer'
  | 'llm'
  | 'vision' 
  | 'videoDescriber'
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
  | 'guidanceStrength'
  | 'motionIntensity'
  | 'cfgScale'
  | 'output';

export interface WorkflowNodeData {
  label: string;
  type: NodeType;
  config: any;
  output?: any;
  error?: string;
  isRunning?: boolean;
  triggerRun?: number;
  progress?: string | number;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  createdAt: number;
  updatedAt: number;
}

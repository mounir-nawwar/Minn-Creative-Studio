import { NodeType } from '../types';

export interface BaseNodeData {
  type: NodeType;
  label?: string;
  [key: string]: unknown;
}

export interface NodeProps<T extends BaseNodeData = BaseNodeData> {
  id: string;
  data: T;
  selected?: boolean;
}

export type ImagenNodeData = BaseNodeData & {
  type: 'imagen';
  model?: string;
  prompt?: string;
  aspectRatio?: string;
  sampleCount?: number;
  seed?: number;
  referenceImages?: string[];
  guidanceStrength?: number;
  cfgScale?: number;
  generatedImages?: Array<{ url: string; seed?: number }>;
  isGenerating?: boolean;
  error?: string;
};

export type VeoNodeData = BaseNodeData & {
  type: 'veo';
  model?: string;
  prompt?: string;
  aspectRatio?: string;
  duration?: number;
  seed?: number;
  startFrame?: string;
  endFrame?: string;
  generatedVideo?: { url: string };
  isGenerating?: boolean;
  error?: string;
};

export type LLMNodeData = BaseNodeData & {
  type: 'llm';
  model?: string;
  prompt?: string;
  systemPrompt?: string;
  temperature?: number;
  output?: string;
  isGenerating?: boolean;
  error?: string;
};

export type LyriaNodeData = BaseNodeData & {
  type: 'lyria';
  model?: string;
  prompt?: string;
  duration?: number;
  seed?: number;
  generatedAudio?: { url: string };
  isGenerating?: boolean;
  error?: string;
};

export type ImageUploadNodeData = BaseNodeData & {
  type: 'imageUpload';
  imageUrl?: string;
  fileName?: string;
};

export type PromptNodeData = BaseNodeData & {
  type: 'prompt';
  text?: string;
};

export type SeedNodeData = BaseNodeData & {
  type: 'seed';
  value?: number;
};

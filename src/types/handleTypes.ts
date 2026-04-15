import { Position } from 'reactflow';

export type HandleType = 
  | 'image'
  | 'prompt'
  | 'seed'
  | 'video'
  | 'audio'
  | 'mask'
  | 'number'
  | 'text'
  | 'boolean'
  | 'json'
  | 'array'
  | 'motion'
  | 'unknown';

export interface HandleDefinition {
  id: string;
  type: HandleType;
  label?: string;
  position?: Position;
}

export interface NodeValidationConfig {
  nodeType: string;
  inputHandles: HandleDefinition[];
  outputHandles: HandleDefinition[];
  allowedTargets?: string[];
}

export interface ConnectionValidationRule {
  allowedInputs?: HandleType[];
  allowedOutputs?: HandleType[];
  blockedConnections?: Array<{
    from: string;
    to: string;
    reason: string;
  }>;
}

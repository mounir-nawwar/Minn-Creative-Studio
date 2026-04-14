import { Position } from 'reactflow';
import { NodeType } from '../types';

/**
 * Type definitions and validation rules for ReactFlow node connections.
 * 
 * @remarks
 * This module implements a comprehensive allow-list validation system for node connections
 * in ReactFlow workflows. It provides semantic handle typing, node topology definitions,
 * and connection rules to prevent invalid data flows.
 * 
 * **Core Concepts:**
 * - **Allow-list strategy**: Only explicitly permitted connections work
 * - **Semantic typing**: Handles declare their data type (image, prompt, video, etc.)
 * - **Compile-time safety**: TypeScript types catch configuration errors early
 * - **Centralized rules**: Single source of truth for connection validation
 * 
 * **Key Components:**
 * - {@link HandleType} - Union type for semantic handle types
 * - {@link HandleDefinition} - Configuration for individual handles
 * - {@link NodeValidationConfig} - Complete node topology definition
 * - {@link NODE_HANDLES} - Registry of all node handle configurations
 * - {@link CONNECTION_VALIDATION_RULES} - Central validation rule engine
 * 
 * @example
 * ```typescript
 * // Getting node configuration
 * const config = NODE_HANDLES.imageUpload;
 * console.log(config.outputs); // [{ id: 'image', type: 'image', label: 'Image' }]
 * 
 * // Validating a connection
 * import { isValidConnection } from '../store/connection-validator';
 * 
 * const result = isValidConnection(
 *   { source: 'node1', target: 'node2', sourceHandle: 'image' },
 *   workflowNodes
 * );
 * 
 * if (!result.valid) {
 *   console.warn(`Blocked: ${result.message}`);
 * }
 * ```
 * 
 * @see {@link ../store/connection-validator} for validation logic
 * @see {@link ../components/BaseNode} for handle rendering
 * @since 1.0.0
 */

/**
 * Semantic type identifiers for ReactFlow handles.
 * 
 * @remarks
 * Uses allow-list strategy where only explicitly defined types can be assigned.
 * 'unknown' serves as fallback for generic connections when no specific type applies.
 * 
 * @example
 * ```typescript
 * const handle: HandleDefinition = {
 *   id: 'image-output',
 *   type: 'image', // Explicit type for safety
 *   label: 'Image Output'
 * };
 * ```
 * 
 * @see {@link HandleDefinition} for handle configuration
 * @see {@link NODE_HANDLES} for node configurations using these types
 * @since 1.0.0
 */
export type HandleType = 
  | 'image'      // Image data (URLs, base64)
  | 'prompt'     // Text prompts for LLM/gen models  
  | 'seed'       // Random seed values
  | 'video'      // Video data
  | 'audio'      // Audio data
  | 'mask'       // Mask/alpha channels
  | 'number'     // Numeric values
  | 'text'       // Generic text
  | 'boolean'    // True/false toggles
  | 'json'       // Structured data (arrays, objects)
  | 'array'      // Array of items
  | 'unknown';   // Default for generic connections

/**
 * Configuration for a single ReactFlow handle definition.
 * Defines semantic typing and placement for node handles.
 * 
 * @remarks
 * Combines visual positioning information with semantic type information
 * for type-safe connection validation. All handles must have a unique ID
 * within their node context.
 * 
 * @example
 * ```typescript
 * // Image processing node output
 * const outputHandle: HandleDefinition = {
 *   id: 'processed-image',
 *   type: 'image',
 *   label: 'Processed Output',
 *   position: Position.Right
 * };
 * 
 * // Number input with custom positioning
 * const inputHandle: HandleDefinition = {
 *   id: 'threshold',
 *   type: 'number',
 *   label: 'Threshold (−∞ to +∞)',
 *   position: Position.Left
 * };
 * ```
 * 
 * @see {@link HandleType} for available semantic types
 * @see {@link NodeValidationConfig} for full node configuration
 * @since 1.0.0
 */
export interface HandleDefinition {
  id: string;          // Unique handle identifier
  type: HandleType;    // Semantic type for validation
  label?: string;      // Display name in UI
  position?: Position;   // Override default position
}

/**
 * Complete validation configuration for a node type.
 * Defines input/output topology and connection constraints.
 * 
 * @remarks
 * Core of the allow-list validation strategy. Each node type declares
 * its acceptable inputs/outputs explicitly. The optional `allowedTargets`
 * array restricts which node types can receive connections from this node.
 * 
 * @example
 * ```typescript
 * // Image generation node configuration
 * const imgGenConfig: NodeValidationConfig = {
 *   nodeType: 'imagen',
 *   inputHandles: [
 *     { id: 'prompt', type: 'prompt', label: 'Prompt' },
 *     { id: 'seed', type: 'seed', label: 'Seed' }
 *   ],
 *   outputHandles: [
 *     { id: 'image', type: 'image', label: 'Generated Image' }
 *   ],
 *   allowedTargets: ['resize', 'blur', 'crop'] // Can only connect to image processors
 * };
 * ```
 * 
 * @see {@link HandleDefinition} for handle configuration format
 * @see {@link NODE_HANDLES} for configuration registry
 * @see {@link CONNECTION_VALIDATION_RULES} for fine-grained rules
 * @since 1.0.0
 */
export interface NodeValidationConfig {
  nodeType: string;
  inputHandles: HandleDefinition[];
  outputHandles: HandleDefinition[];
  allowedTargets?: string[]; // ['*'] for universal, or specific node types
}

// Node handle configurations
/**
 * Registry mapping node types to their handle configurations.
 * 
 * @remarks
 * Central configuration for all node types in the application. Each entry defines
 * the complete input/output topology for a specific node type. Uses strict typing
 * to catch configuration errors at compile time.
 * 
 * **Key Design Patterns:**
 * - **Allow-list strategy**: Only explicitly configured node types are supported
 * - **Semantic typing**: Each handle declares its semantic type for validation
 * - **Fallback handling**: Unknown node types use NODE_HANDLES.default
 * - **Visual positioning**: Handles can override default positions per node
 * 
 * @example
 * ```typescript
 * // Accessing handle configuration
 * const uploadHandles = NODE_HANDLES.imageUpload;
 * // Returns: { inputs: [], outputs: [{ id: 'image', type: 'image', label: 'Image' }] }
 * 
 * // Using in BaseNode component
 * const handles = NODE_HANDLES[node.data.type] || NODE_HANDLES.default;
 * handles.inputs.forEach(handle => <Handle {...handle} />);
 * ```
 * 
 * @see {@link HandleDefinition} for handle structure
 * @see {@link CONNECTION_VALIDATION_RULES} for connection rules
 * @since 1.0.0
 */
export const NODE_HANDLES: Record<NodeType | 'default', {
  inputs: HandleDefinition[];
  outputs: HandleDefinition[];
}> = {
  // Default fallback configuration
  default: {
    inputs: [{ id: 'input', type: 'unknown', label: 'Input' }],
    outputs: [{ id: 'output', type: 'unknown', label: 'Output' }]
  },

  // 1. SEED nodes
  seed: {
    inputs: [{ id: 'input', type: 'unknown', label: 'Input' }],
    outputs: [{ id: 'seed', type: 'seed', label: 'Seed' }]
  },

  // 2. IMAGE SOURCE nodes
  imageUpload: {
    inputs: [],
    outputs: [{ id: 'image', type: 'image', label: 'Image' }]
  },
  videoUpload: {
    inputs: [],
    outputs: [{ id: 'video', type: 'video', label: 'Video' }]
  },

  // 3. PROMPT nodes
  prompt: {
    inputs: [],
    outputs: [{ id: 'prompt', type: 'prompt', label: 'Prompt' }]
  },
  promptConcatenator: {
    inputs: [
      { id: 'prompt1', type: 'prompt', label: 'Prompt 1' },
      { id: 'prompt2', type: 'prompt', label: 'Prompt 2' }
    ],
    outputs: [{ id: 'prompt', type: 'prompt', label: 'Combined Prompt' }]
  },
  promptEnhancer: {
    inputs: [{ id: 'prompt', type: 'prompt', label: 'Input Prompt' }],
    outputs: [{ id: 'prompt', type: 'prompt', label: 'Enhanced Prompt' }]
  },

  // 4. MODEL/GENERATION nodes
  llm: {
    inputs: [
      { id: 'prompt', type: 'prompt', label: 'Prompt' },
      { id: 'seed', type: 'seed', label: 'Seed (Optional)' }
    ],
    outputs: [{ id: 'text', type: 'text', label: 'Generated Text' }]
  },
  imagen: {
    inputs: [
      { id: 'prompt', type: 'prompt', label: 'Prompt' },
      { id: 'seed', type: 'seed', label: 'Seed (Optional)' },
      { id: 'image', type: 'image', label: 'Reference Image (Optional)' }
    ],
    outputs: [{ id: 'image', type: 'image', label: 'Generated Image' }]
  },
  veo: {
    inputs: [
      { id: 'prompt', type: 'prompt', label: 'Prompt' },
      { id: 'seed', type: 'seed', label: 'Seed (Optional)' },
      { id: 'image', type: 'image', label: 'Reference Image (Optional)' }
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
      { id: 'prompt', type: 'prompt', label: 'Prompt' },
      { id: 'seed', type: 'seed', label: 'Seed (Optional)' }
    ],
    outputs: [{ id: 'audio', type: 'audio', label: 'Generated Audio' }]
  },
  imageToVideo: {
    inputs: [
      { id: 'image', type: 'image', label: 'Image' },
      { id: 'prompt', type: 'prompt', label: 'Prompt (Optional)' }
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

  // 5. IMAGE PROCESSING nodes
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

  // 6. MASK nodes
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

  // 7. VIDEO PROCESSING nodes
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

  // 8. GENERIC nodes
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

  // 9. ITERATOR nodes
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

  // 10. CONTROL FLOW nodes
  sequence: {
    inputs: [
      { id: 'trigger', type: 'unknown', label: 'Trigger' }
    ],
    outputs: [
      { id: 'step1', type: 'unknown', label: 'Step 1' },
      { id: 'step2', type: 'unknown', label: 'Step 2' },
      { id: 'step3', type: 'unknown', label: 'Step 3' }
    ]
  },

  // 11. PARAMETER CONTROLLER nodes
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

  // 12. OUTPUT nodes
  output: {
    inputs: [{ id: 'input', type: 'unknown', label: 'Output' }],
    outputs: []
  },

  // 13. UTILITY nodes
  compare: {
    inputs: [
      { id: 'item1', type: 'unknown', label: 'Item 1' },
      { id: 'item2', type: 'unknown', label: 'Item 2' }
    ],
    outputs: [
      { id: 'result', type: 'boolean', label: 'Comparison Result' },
      { id: 'diff', type: 'number', label: 'Difference' }
    ]
  },
  stickyNote: {
    inputs: [],
    outputs: []
  },

  // Additional specialized nodes
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
  }
};

/**
 * Central registry of connection validation rules implementing allow-list strategy.
 * 
 * @remarks
 * Defines which connections are **explicitly permitted** between node types.
 * Each rule can specify:
 * - `allowedInputs`: Whitelist of handle types the node accepts
 * - `allowedOutputs`: Whitelist of handle types the node can emit
 * - `blockedConnections`: Explicit pairs to block with reasons
 * 
 * **Validation Priority:**
 * 1. Check `blockedConnections` (highest priority - explicit blocks)
 * 2. Check `allowedInputs` against source handle type
 * 3. Check `allowedOutputs` against source node capabilities
 * 4. Default to handle type matching
 * 
 * @example
 * ```typescript
 * // Seed node blocks images/videos to prevent invalid inputs
 * seed: {
 *   allowedInputs: ['unknown', 'number', 'text'], // Only these types
 *   allowedOutputs: ['seed'],
 *   blockedConnections: [
 *     { from: 'imageUpload', to: 'seed', 
 *       reason: 'Image data cannot feed seed parameter' }
 *   ]
 * }
 * ```
 * 
 * @see {@link isValidConnection} for validation logic
 * @see {@link NODE_HANDLES} for handle configurations
 * @since 1.0.0
 */
export const CONNECTION_VALIDATION_RULES: Record<string, {
  allowedInputs?: HandleType[];  // What types can connect TO this node
  allowedOutputs?: HandleType[]; // What types this node can connect FROM
  blockedConnections?: Array<{
    from: string; // node type
    to: string;   // node type
    reason: string;
  }>;
}> = {
  // SEED NODE - Block image/video from connecting
  seed: {
    allowedInputs: ['unknown', 'number', 'text'], // Only allow these types
    allowedOutputs: ['seed'],
    blockedConnections: [
      { from: 'imageUpload', to: 'seed', reason: 'Image upload cannot connect to seed input' },
      { from: 'videoUpload', to: 'seed', reason: 'Video upload cannot connect to seed input' },
      { from: 'imagen', to: 'seed', reason: 'Image generation output cannot feed back to seed' },
      { from: 'veo', to: 'seed', reason: 'Video generation output cannot feed back to seed' }
    ]
  },

  // IMAGE GENERATION NODES
  imagen: {
    allowedInputs: ['prompt', 'seed'],
    allowedOutputs: ['image']
  },

  // IMAGE PROCESSING - Accept images only
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

  // MASK NODES
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

  // VIDEO NODES
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

  // GENERIC NODES (allow all)
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
  }
};

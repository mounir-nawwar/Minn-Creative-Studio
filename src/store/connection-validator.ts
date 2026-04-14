import { Connection, Node } from 'reactflow';
import { 
  NODE_HANDLES, 
  CONNECTION_VALIDATION_RULES,
  HandleType,
  HandleDefinition
} from '../types/connection.types';
import { perfMonitor } from '../services/performance';
import { NodeType } from '../types';

/**
 * Safely gets handle configuration for a node type
 * Returns null if nodeType is undefined or not found
 */
function getNodeHandles(nodeType: string | undefined): { inputs: HandleDefinition[]; outputs: HandleDefinition[] } | null {
  if (!nodeType) return null;
  return NODE_HANDLES[nodeType as NodeType | 'default'] || null;
}

/**
 * Validation cache for O(1) connection lookups during drag operations.
 * 
 * @remarks
 * Pre-computes all valid connections when source node changes. Enables real-time
 * visual feedback without O(n) scans per mouse move. Used by ReactFlow's
 * `isValidConnection` callback for smooth feedback.
 * 
 * **Cache Structure:**
 * - `sourceNodeId` - Node ID currently being dragged from
 * - `sourceHandleId` - Specific handle being used as source
 * - `validTargetIds` - Set of valid target node IDs (O(1) lookup)
 * - `validationByTargetId` - Map of validation results per target node
 * 
 * @example
 * ```typescript
 * const cache: ValidationCache = {
 *   sourceNodeId: 'imageUpload1',
 *   sourceHandleId: 'image',
 *   validTargetIds: new Set(['resize2', 'blur3']),
 *   validationByTargetId: new Map([
 *     ['resize2', { valid: true, message: '' }],
 *     ['seed1', { valid: false, message: 'Cannot connect image to seed' }]
 *   ])
 * };
 * 
 * // O(1) validation during drag
 * const result = cache.validationByTargetId.get('resize2');
 * console.log(result?.valid); // true
 * ```
 * 
 * @see {@link BuildValidationCache} for cache construction
 * @see {@link IsValidConnectionCached} for using cached validation
 * @since 1.0.0
 */
export interface ValidationCache {
  sourceNodeId: string;
  sourceHandleId: string;
  validTargetIds: Set<string>;
  validationByTargetId: Map<string, ValidationResult>;
}

/**
 * Result of connection validation attempt.
 * 
 * @remarks
 * Provides both boolean result and descriptive message for debugging.
 * Message is displayed to users for invalid connections and logged to console.
 * 
 * @example
 * ```typescript
 * // Valid connection
 * const validResult: ValidationResult = {
 *   valid: true,
 *   message: ''
 * };
 * 
 * // Invalid connection with reason
 * const invalidResult: ValidationResult = {
 *   valid: false,
 *   message: 'Type mismatch: image → seed'
 * };
 * 
 * // Using in UI
 * if (!result.valid) {
 *   setTooltip(result.message); // "Type mismatch: image → seed"
 * }
 * ```
 * 
 * @see {@link IsValidConnection} for generating validation results
 * @since 1.0.0
 */
export interface ValidationResult {
  valid: boolean;
  message: string;
}

/**
 * Builds a validation cache for O(1) lookups during drag operations
 * Pre-computes validation results for all target nodes
 * O(n) complexity - call once per drag start, not per mouse move
 */
export function buildValidationCache(
  sourceNodeId: string,
  sourceHandleId: string | null | undefined,
  nodes: Node[]
): ValidationCache | null {
  if (!sourceNodeId || !nodes.length) {
    return null;
  }

  const sourceNode = nodes.find(n => n.id === sourceNodeId);
  if (!sourceNode || !sourceNode.type) {
    return null;
  }

  const sourceHandles = getNodeHandles(sourceNode.type);
  if (!sourceHandles) {
    return null;
  }
  
  const sourceHandle = sourceHandleId
    ? sourceHandles.outputs.find((h: HandleDefinition) => h.id === sourceHandleId)
    : (sourceHandles.outputs.length > 0 ? sourceHandles.outputs[0] : undefined);

  if (!sourceHandle) {
    return null;
  }

  const validTargetIds = new Set<string>();
  const validationByTargetId = new Map<string, ValidationResult>();

  // Pre-compute validation for all possible target nodes
  for (const targetNode of nodes) {
    if (targetNode.id === sourceNodeId) {
      // No self-connections
      validationByTargetId.set(targetNode.id, {
        valid: false,
        message: 'Cannot connect node to itself'
      });
      continue;
    }

    const validation = validateConnectionForTarget(
      sourceNode,
      sourceHandle,
      targetNode,
      nodes
    );

    validationByTargetId.set(targetNode.id, validation);

    if (validation.valid) {
      validTargetIds.add(targetNode.id);
    }
  }

  return {
    sourceNodeId,
    sourceHandleId: sourceHandle.id,
    validTargetIds,
    validationByTargetId
  };
}

/**
 * Validates a connection between source and specific target node
 * Used during cache building
 */
function validateConnectionForTarget(
  sourceNode: Node,
  sourceHandle: HandleDefinition,
  targetNode: Node,
  nodes: Node[]
): ValidationResult {
  if (!targetNode.type || !sourceNode.type) {
    return {
      valid: false,
      message: 'Invalid node type'
    };
  }
  
  const targetHandles = getNodeHandles(targetNode.type);
  if (!targetHandles) {
    return {
      valid: false,
      message: `Unknown node type: ${targetNode.type}`
    };
  }
  
  const targetRules = CONNECTION_VALIDATION_RULES[targetNode.type];

  // Check if target accepts this type based on allowedInputs
  if (targetRules?.allowedInputs && targetRules.allowedInputs.length > 0) {
    const isAllowed = targetRules.allowedInputs.includes(sourceHandle.type);
    if (!isAllowed) {
      return {
        valid: false,
        message: `${targetNode.type} node cannot accept ${sourceHandle.type} type`
      };
    }
  }

  // Default: check if any input handle matches
  const hasValidInput = targetHandles.inputs.some((input: HandleDefinition) => {
    if (input.type === 'unknown') return true;
    return input.type === sourceHandle.type;
  });

  if (!hasValidInput) {
    return {
      valid: false,
      message: `No valid input handle for ${sourceHandle.type} type`
    };
  }

  // Check CONNECTION_VALIDATION_RULES for explicit blocks
  if (targetRules?.blockedConnections) {
    const blocked = targetRules.blockedConnections.find(
      (block: { from: string; to: string; reason: string }) => block.from === sourceNode.type && block.to === targetNode.type
    );
    
    if (blocked) {
      return {
        valid: false,
        message: blocked.reason
      };
    }
  }

  // Check source allowed outputs
  const sourceRules = CONNECTION_VALIDATION_RULES[sourceNode.type];
  if (sourceRules?.allowedOutputs && sourceRules.allowedOutputs.length > 0) {
    const isAllowed = sourceRules.allowedOutputs.includes(sourceHandle.type);
    if (!isAllowed) {
      return {
        valid: false,
        message: `${sourceNode.type} node cannot output ${sourceHandle.type} type`
      };
    }
  }

  return {
    valid: true,
    message: ''
  };
}

/**
 * Validates a connection between nodes (primary API)
 * Returns ValidationResult with clear success/failure status
 * 
 * @param connection - The connection to validate
 * @param nodes - Array of all nodes in the flow
 * @returns ValidationResult with valid status and message
 * 
 * @example
 * ```typescript
 * const result = checkConnection(connection, nodes);
 * if (!result.valid) {
 *   console.log(result.message); // "Type mismatch: image → seed"
 * }
 * ```
 */
export function checkConnection(
  connection: Connection,
  nodes: Node[]
): ValidationResult {
  return validateConnection(connection, nodes);
}

/**
 * @deprecated Use buildValidationCache instead
 * Builds validation cache for O(1) lookups during drag operations
 * Maintains backward compatibility for existing code
 * 
 * @param sourceNodeId - The ID of the source node
 * @param sourceHandleId - The ID of the source handle
 * @param nodes - Array of all nodes in the flow
 * @returns ValidationCache for cached validation or null if invalid
 */
export function checkConnectionDeprecated(
  sourceNodeId: string,
  sourceHandleId: string | null,
  nodes: Node[]
): ValidationCache | null {
  console.warn('DEPRECATED: checkConnectionDeprecated is deprecated. Use buildValidationCache instead.');
  return buildValidationCache(sourceNodeId, sourceHandleId, nodes);
}

/**
 * Actual implementation of connection validation
 */
function validateConnection(
  connection: Connection,
  nodes: Node[]
): ValidationResult {
  const sourceNode = nodes.find(n => n.id === connection.source);
  const targetNode = nodes.find(n => n.id === connection.target);

  if (!sourceNode || !targetNode || !sourceNode.type || !targetNode.type) {
    return {
      valid: false,
      message: 'Source or target node not found or has invalid type'
    };
  }

  // Prevent self-connections
  if (sourceNode.id === targetNode.id) {
    return {
      valid: false,
      message: 'Cannot connect node to itself'
    };
  }

  // Get handle definitions
  const sourceHandles = getNodeHandles(sourceNode.type);
  const targetHandles = getNodeHandles(targetNode.type);
  
  if (!sourceHandles || !targetHandles) {
    return {
      valid: false,
      message: 'Unknown node type configuration'
    };
  }

  // Find specific handles being connected
  const sourceHandle = connection.sourceHandle 
    ? sourceHandles.outputs.find((h: HandleDefinition) => h.id === connection.sourceHandle)
    : (sourceHandles.outputs.length > 0 ? sourceHandles.outputs[0] : undefined);
    
  const targetHandle = connection.targetHandle
    ? targetHandles.inputs.find((h: HandleDefinition) => h.id === connection.targetHandle)
    : (targetHandles.inputs.length > 0 ? targetHandles.inputs[0] : undefined);

  if (!sourceHandle) {
    return {
      valid: false,
      message: sourceHandles.outputs.length > 0 
        ? `Invalid source handle: ${connection.sourceHandle}`
        : `${sourceNode.type} node has no output handles`
    };
  }

  if (!targetHandle) {
    return {
      valid: false,
      message: targetHandles.inputs.length > 0
        ? `Invalid target handle: ${connection.targetHandle}`
        : `${targetNode.type} node has no input handles`
    };
  }

  // Check CONNECTION_VALIDATION_RULES for explicit blocks
  const targetRules = CONNECTION_VALIDATION_RULES[targetNode.type];
  if (targetRules?.blockedConnections) {
    const blocked = targetRules.blockedConnections.find(
      (block: { from: string; to: string; reason: string }) => block.from === sourceNode.type && block.to === targetNode.type
    );
    
    if (blocked) {
      return {
        valid: false,
        message: blocked.reason
      };
    }
  }

  // Check source allowed outputs
  const sourceRules = CONNECTION_VALIDATION_RULES[sourceNode.type];
  if (sourceRules?.allowedOutputs && sourceRules.allowedOutputs.length > 0) {
    const isAllowed = sourceRules.allowedOutputs.includes(sourceHandle?.type as HandleType);
    if (!isAllowed) {
      return {
        valid: false,
        message: `${sourceNode.type} node cannot output ${sourceHandle?.type} type`
      };
    }
  }

  // Check target allowed inputs
  if (targetRules?.allowedInputs && targetRules.allowedInputs.length > 0) {
    const isAllowed = targetRules.allowedInputs.includes(targetHandle?.type as HandleType);
    if (!isAllowed) {
      return {
        valid: false,
        message: `${targetNode.type} node cannot accept ${targetHandle?.type} type`
      };
    }
  }

  // Type compatibility check (strict mode)
  if (sourceHandle && targetHandle) {
    // Allow 'unknown' type to connect to anything (wildcard)
    if (sourceHandle.type === 'unknown' || targetHandle.type === 'unknown') {
      return { valid: true, message: '' };
    }

    // Allow same type connections
    if (sourceHandle.type === targetHandle.type) {
      return { valid: true, message: '' };
    }

    // Block all other mismatches
    return {
      valid: false,
      message: `Type mismatch: ${sourceHandle.type} → ${targetHandle.type}`
    };
  }

  // If no specific rules, allow by default (backward compatibility)
  return {
    valid: true,
    message: ''
  };
}

/**
 * Validates a connection using cached validation data
 * O(1) complexity - use during drag operations
 */
export function isValidConnectionCached(
  connection: Connection,
  cache: ValidationCache | null
): ValidationResult {
  if (!cache || !connection.target) {
    return {
      valid: false,
      message: connection.target ? 'Validation cache not available' : 'No target specified'
    };
  }

  const cachedValidation = cache.validationByTargetId.get(connection.target);
  return cachedValidation || {
    valid: false,
    message: 'Target not found in cache'
  };
}

/**
 * Gets visual feedback for connection in progress
 * Uses O(1) cache lookup for performance
 */
export function getConnectionFeedback(
  connection: Partial<Connection>,
  nodes: Node[],
  cache: ValidationCache | null,
  mousePosition?: { x: number; y: number }
): {
  isValid: boolean;
  message: string;
  validTargets: string[];
} {
  if (!connection.source || !nodes.length) {
    return {
      isValid: false,
      message: '',
      validTargets: []
    };
  }

  const sourceNode = nodes.find(n => n.id === connection.source);
  if (!sourceNode || !sourceNode.type) {
    return {
      isValid: false,
      message: '',
      validTargets: []
    };
  }

  // Build cache if not provided (fallback for legacy usage)
  if (!cache && connection.sourceHandle) {
    cache = buildValidationCache(
      connection.source,
      connection.sourceHandle,
      nodes
    );
  }

  // Use cache if available for O(1) lookups
  if (cache) {
    const validTargets = Array.from(cache.validTargetIds);
    const message = validTargets.length > 0
      ? `Valid targets: ${validTargets.length} nodes`
      : 'No valid connection targets';

    return {
      isValid: validTargets.length > 0,
      message,
      validTargets
    };
  }

  // Legacy O(n) path (fallback only)
  const sourceHandles = getNodeHandles(sourceNode.type);
  if (!sourceHandles) {
    return {
      isValid: false,
      message: `Unknown node type: ${sourceNode.type}`,
      validTargets: []
    };
  }
  
  const sourceHandle = connection.sourceHandle
    ? sourceHandles.outputs.find((h: HandleDefinition) => h.id === connection.sourceHandle)
    : (sourceHandles.outputs.length > 0 ? sourceHandles.outputs[0] : undefined);

  if (!sourceHandle) {
    return {
      isValid: false,
      message: sourceHandles.outputs.length > 0 
        ? 'No valid source handle found'
        : `Node ${sourceNode.type} has no outputs`,
      validTargets: []
    };
  }

  // Find all valid targets (O(n) - only used as fallback)
  const validTargets = nodes
    .filter(node => {
      if (node.id === sourceNode.id || !node.type) return false; // No self-connections
      
      const targetHandles = getNodeHandles(node.type);
      if (!targetHandles) return false;
      
      const targetRules = CONNECTION_VALIDATION_RULES[node.type];
      
      // Check if target accepts this type
      if (targetRules?.allowedInputs && targetRules.allowedInputs.length > 0) {
        return targetRules.allowedInputs.includes(sourceHandle.type);
      }
      
      // Default: check if any input handle matches
      return targetHandles.inputs.some((input: HandleDefinition) => {
        if (input.type === 'unknown') return true;
        return input.type === sourceHandle.type;
      });
    })
    .map((n: Node) => n.id);

  return {
    isValid: validTargets.length > 0,
    message: validTargets.length > 0
      ? `Valid targets: ${validTargets.length} nodes`
      : 'No valid connection targets',
    validTargets
  };
}

/**
 * Validates multiple connections (batch validation for nodes with multiple outputs)
 */
export function validateMultipleConnections(
  connections: Connection[],
  nodes: Node[]
): Array<ValidationResult & { connection: Connection }> {
  return connections.map(connection => {
    const result = checkConnection(connection, nodes);
    return {
      ...result,
      connection
    };
  });
}

/**
 * Helper hook to create and memoize validation cache
 * Usage in React components:
 * 
 * const cache = useValidationCache(sourceNodeId, sourceHandleId, nodes);
 */
export function useValidationCache(
  sourceNodeId: string | null | undefined,
  sourceHandleId: string | null | undefined,
  nodes: Node[]
): ValidationCache | null {
  // Simple memoization - in real usage, wrap with useMemo from React
  if (!sourceNodeId) return null;
  return buildValidationCache(sourceNodeId, sourceHandleId, nodes);
}

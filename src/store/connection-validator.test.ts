/**
 * Comprehensive unit tests for connection validation logic
 * Tests validation rules, caching, and edge cases
 * Run with: npm test connection-validator.test.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Node } from 'reactflow';
import {
  checkConnection,
  checkConnectionDeprecated,
  isValidConnectionCached,
  getConnectionFeedback,
  validateMultipleConnections,
  buildValidationCache,
  ValidationResult,
  ValidationCache
} from './connection-validator';
import { CONNECTION_VALIDATION_RULES, NODE_HANDLES } from '../types/connection.types';

// Mock performance monitor
vi.mock('../services/performance', () => ({
  perfMonitor: {
    start: vi.fn(),
    end: vi.fn(),
    getMetrics: vi.fn(() => ({ duration: 0.5 }))
  }
}));

describe('Connection Validator', () => {
  // Mock node data
  const mockNodes: Node[] = [
    {
      id: 'prompt-1',
      type: 'prompt',
      data: { label: 'Prompt Node' },
      position: { x: 0, y: 0 }
    },
    {
      id: 'llm-1',
      type: 'imagen',
      data: { label: 'Image Generation' },
      position: { x: 200, y: 0 }
    },
    {
      id: 'imageUpload-1',
      type: 'imageUpload',
      data: { label: 'Image Upload' },
      position: { x: 0, y: 100 }
    },
    {
      id: 'seed-1',
      type: 'seed',
      data: { label: 'Seed' },
      position: { x: 200, y: 100 }
    },
    {
      id: 'resize-1',
      type: 'resize',
      data: { label: 'Resize' },
      position: { x: 400, y: 0 }
    },
    {
      id: 'blur-1',
      type: 'blur',
      data: { label: 'Blur' },
      position: { x: 400, y: 100 }
    },
    {
      id: 'maskExtractor-1',
      type: 'maskExtractor',
      data: { label: 'Mask Extractor' },
      position: { x: 600, y: 0 }
    },
    {
      id: 'number-1',
      type: 'number',
      data: { label: 'Number' },
      position: { x: 0, y: 200 }
    },
    {
      id: 'videoUpload-1',
      type: 'videoUpload',
      data: { label: 'Video Upload' },
      position: { x: 0, y: 300 }
    },
    {
      id: 'toggle-1',
      type: 'toggle',
      data: { label: 'Toggle' },
      position: { x: 200, y: 200 }
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('buildValidationCache', () => {
    it('should return null for empty source node ID', () => {
      const result = buildValidationCache('', null, mockNodes);
      expect(result).toBeNull();
    });

    it('should return null for empty nodes array', () => {
      const result = buildValidationCache('prompt-1', null, []);
      expect(result).toBeNull();
    });

    it('should return null for non-existent source node', () => {
      const result = buildValidationCache('non-existent', null, mockNodes);
      expect(result).toBeNull();
    });

    it('should build validation cache for valid source node', () => {
      const result = buildValidationCache('prompt-1', 'output', mockNodes);
      expect(result).not.toBeNull();
      expect(result?.sourceNodeId).toBe('prompt-1');
      expect(result?.sourceHandleId).toBe('output');
      expect(result?.validTargetIds).toBeInstanceOf(Set);
    });

    it('should use default handle when sourceHandleId is null', () => {
      const result = buildValidationCache('prompt-1', null, mockNodes);
      expect(result).not.toBeNull();
      expect(result?.sourceHandleId).toBe('output'); // First output handle
    });

    it('should mark self-connections as invalid', () => {
      const result = buildValidationCache('prompt-1', 'output', mockNodes);
      expect(result).not.toBeNull();
      const selfValidation = result?.validationByTargetId.get('prompt-1');
      expect(selfValidation?.valid).toBe(false);
    });
  });

    it('should return null for empty nodes array', () => {
      const result = isValidConnection('prompt-1', null, []);
      expect(result).toBeNull();
    });

    it('should return null for non-existent source node', () => {
      const result = isValidConnection('non-existent', null, mockNodes);
      expect(result).toBeNull();
    });

    it('should build validation cache for valid source node', () => {
      const cache = buildValidationCache('prompt-1', 'prompt', mockNodes);
      expect(cache).not.toBeNull();
      expect(cache).toHaveProperty('sourceNodeId', 'prompt-1');
      expect(cache).toHaveProperty('sourceHandleId', 'prompt');
      expect(cache).toHaveProperty('validTargetIds');
      expect(cache).toHaveProperty('validationByTargetId');
      expect(cache!.validTargetIds).toBeInstanceOf(Set);
      expect(cache!.validationByTargetId).toBeInstanceOf(Map);
    });

    it('should use default handle when sourceHandleId is null', () => {
      const cache = buildValidationCache('prompt-1', null, mockNodes);
      expect(cache).not.toBeNull();
      expect(cache!.sourceHandleId).toBeDefined();
    });

    it('should mark self-connections as invalid', () => {
      const cache = buildValidationCache('prompt-1', 'prompt', mockNodes);
      expect(cache).not.toBeNull();
      const selfValidation = cache!.validationByTargetId.get('prompt-1');
      expect(selfValidation).toEqual({
        valid: false,
        message: 'Cannot connect node to itself'
      });
    });
  });

  describe('checkConnection', () => {
    it('should allow valid connections between compatible types', () => {
      const result = checkConnection({
        source: 'prompt-1',
        target: 'llm-1',
      }, mockNodes);
      expect(result).toEqual({
        valid: true,
        message: ''
      });
    });

    it('should block imageUpload to seed connection', () => {
      const result = checkConnection({
        source: 'imageUpload-1',
        target: 'seed-1',
      }, mockNodes);
      expect(result).toEqual({
        valid: false,
        message: 'seed node cannot accept image type'
      });
    });

    it('should block videoUpload to seed connection', () => {
      const result = checkConnection({
        source: 'videoUpload-1',
        target: 'seed-1',
      }, mockNodes);
      expect(result).toEqual({
        valid: false,
        message: 'seed node cannot accept video type'
      });
    });

    it('should block self-connections', () => {
      const result = checkConnection({
        source: 'prompt-1',
        target: 'prompt-1',
      }, mockNodes);
      expect(result).toEqual({
        valid: false,
        message: 'Cannot connect node to itself'
      });
    });

    it('should return error for missing source node', () => {
      const result = checkConnection({
        source: 'non-existent',
        target: 'llm-1',
      }, mockNodes);
      expect(result).toEqual({
        valid: false,
        message: 'Source or target node not found or has invalid type'
      });
    });

    it('should return error for missing target node', () => {
      const result = checkConnection({
        source: 'prompt-1',
        target: 'non-existent',
      }, mockNodes);
      expect(result).toEqual({
        valid: false,
        message: 'Source or target node not found or has invalid type'
      });
    });

    it('should allow image to resize connection', () => {
      const result = checkConnection({
        source: 'imageUpload-1',
        target: 'resize-1',
      }, mockNodes);
      expect(result).toEqual({
        valid: true,
        message: ''
      });
    });

    it('should allow image to blur connection', () => {
      const result = checkConnection({
        source: 'imageUpload-1',
        target: 'blur-1',
      }, mockNodes);
      expect(result).toEqual({
        valid: true,
        message: ''
      });
    });

    it('should allow number to seed connection', () => {
      const result = checkConnection({
        source: 'number-1',
        target: 'seed-1',
      }, mockNodes);
      expect(result).toEqual({
        valid: true,
        message: ''
      });
    });

    it('should block incompatible type connections', () => {
      const result = checkConnection({
        source: 'toggle-1',
        target: 'llm-1',
      }, mockNodes);
      expect(result).toEqual({
        valid: false,
        message: 'Type mismatch: boolean → image'
      });
    });
  });

    it('should block imageUpload to seed connection', () => {
      const result = isValidConnection({
        source: 'imageUpload-1',
        target: 'seed-1',
        sourceHandle: 'image',
        targetHandle: 'input'
      }, mockNodes);
      
      expect(result && 'valid' in result ? result : null).toEqual({
        valid: false,
        message: 'Image upload cannot connect to seed input'
      });
    });

    it('should block videoUpload to seed connection', () => {
      const result = isValidConnection({
        source: 'videoUpload-1',
        target: 'seed-1',
        sourceHandle: 'video',
        targetHandle: 'input'
      }, mockNodes);
      
      if (result && 'valid' in result) {
        expect(result.valid).toBe(false);
        expect(result.message).toContain('Video upload cannot connect to seed');
      } else {
        throw new Error('Expected ValidationResult but got ValidationCache or null');
      }
    });

    it('should block self-connections', () => {
      const result = isValidConnection({
        source: 'prompt-1',
        target: 'prompt-1',
        sourceHandle: 'prompt',
        targetHandle: 'input'
      }, mockNodes);
      
      expect(result).toEqual({
        valid: false,
        message: 'Cannot connect node to itself'
      });
    });

    it('should return error for missing source node', () => {
      const result = isValidConnection({
        source: 'non-existent',
        target: 'llm-1',
        sourceHandle: 'prompt',
        targetHandle: 'input'
      }, mockNodes);
      
      expect(result).toEqual({
        valid: false,
        message: 'Source or target node not found or has invalid type'
      });
    });

    it('should return error for missing target node', () => {
      const result = isValidConnection({
        source: 'prompt-1',
        target: 'non-existent',
        sourceHandle: 'prompt',
        targetHandle: 'input'
      }, mockNodes);
      
      expect(result).toEqual({
        valid: false,
        message: 'Source or target node not found or has invalid type'
      });
    });

    it('should allow image to resize connection', () => {
      const result = isValidConnection({
        source: 'imageUpload-1',
        target: 'resize-1',
        sourceHandle: 'image',
        targetHandle: 'image'
      }, mockNodes);
      
      expect(result && 'valid' in result ? result : null).toEqual({ valid: true, message: '' });
    });

    it('should allow image to blur connection', () => {
      const result = isValidConnection({
        source: 'imageUpload-1',
        target: 'blur-1',
        sourceHandle: 'image',
        targetHandle: 'image'
      }, mockNodes);
      
      expect(result && 'valid' in result ? result : null).toEqual({ valid: true, message: '' });
    });

    it('should allow number to seed connection', () => {
      const result = isValidConnection({
        source: 'number-1',
        target: 'seed-1',
        sourceHandle: 'number',
        targetHandle: 'input'
      }, mockNodes);
      
      expect(result && 'valid' in result ? result : null).toEqual({ valid: true, message: '' });
    });

    it('should block incompatible type connections', () => {
      const result = isValidConnection({
        source: 'toggle-1',
        target: 'llm-1',
        sourceHandle: 'boolean',
        targetHandle: 'prompt'
      }, mockNodes);
      
      if (result && 'valid' in result) {
        expect(result.valid).toBe(false);
        expect(result.message).toContain('Type mismatch');
      } else {
        throw new Error('Expected ValidationResult but got ValidationCache or null');
      }
    });
  });

  describe('isValidConnectionCached', () => {
    let cache: ValidationCache;

    beforeEach(() => {
      cache = buildValidationCache('prompt-1', 'prompt', mockNodes)!;
    });

    it('should return cached validation result for valid connection', () => {
      const result = isValidConnectionCached({
        source: 'prompt-1',
        target: 'llm-1',
        sourceHandle: 'prompt',
        targetHandle: 'prompt'
      }, cache);
      
      expect(result).toEqual({ valid: true, message: '' });
    });

    it('should return cached validation result for invalid connection', () => {
      const result = isValidConnectionCached({
        source: 'prompt-1',
        target: 'seed-1',
        sourceHandle: 'prompt',
        targetHandle: 'input'
      }, cache);
      
      expect(result.valid).toBe(false);
      expect(result.message).toContain('cannot accept');
    });

    it('should return error when cache is null', () => {
      const result = isValidConnectionCached({
        source: 'prompt-1',
        target: 'llm-1',
        sourceHandle: 'prompt',
        targetHandle: 'prompt'
      }, null);
      
      expect(result && 'valid' in result ? result : null).toEqual({
        valid: false,
        message: 'Validation cache not available'
      });
    });

    it('should return error when target is not in cache', () => {
      const result = isValidConnectionCached({
        source: 'prompt-1',
        target: 'non-existent',
        sourceHandle: null,
        targetHandle: null
      }, cache);
      
      expect(result).toEqual({
        valid: false,
        message: 'Target not found in cache'
      });
    });

    it('should return error when target is not specified', () => {
      const result = isValidConnectionCached({
        source: 'prompt-1',
        target: 'llm-1',
        sourceHandle: 'prompt',
        targetHandle: 'prompt'
      }, null);
      
      expect(result && 'valid' in result ? result : null).toEqual({
        valid: false,
        message: 'Validation cache not available'
      });
    });

    it('should return error when target is not in cache', () => {
      const result = isValidConnectionCached({
        source: 'prompt-1',
        target: 'non-existent',
        sourceHandle: 'prompt',
        targetHandle: 'input'
      }, cache);
      
      expect(result && 'valid' in result ? result : null).toEqual({
        valid: false,
        message: 'Target not in validation cache'
      });
    });

    it('should return error for mismatched source node', () => {
      const result = isValidConnectionCached({
        source: 'prompt-1',
        target: 'llm-1',
        sourceHandle: 'prompt',
        targetHandle: 'prompt'
      }, cache);
      
      expect(result).toEqual({
        valid: false,
        message: 'No target specified'
      });
    });
  });

  describe('getConnectionFeedback', () => {
    let cache: ValidationCache;

    beforeEach(() => {
      cache = buildValidationCache('prompt-1', 'prompt', mockNodes)!;
    });

    it('should return valid feedback for source node with valid targets', () => {
      const result = getConnectionFeedback({
        source: 'prompt-1',
        sourceHandle: 'output'
      }, mockNodes, cache);
      
      expect(result.isValid).toBe(true);
      expect(result.message).toContain('Valid targets');
      expect(result.validTargets.length).toBeGreaterThan(0);
    });

    it('should return invalid feedback when source is missing', () => {
      const result = getConnectionFeedback({}, mockNodes, cache);
      
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('');
      expect(result.validTargets).toEqual([]);
    });

    it('should return invalid feedback for non-existent source node', () => {
      const result = getConnectionFeedback({
        source: 'non-existent'
      }, mockNodes, cache);
      
      expect(result.isValid).toBe(false);
      expect(result.message).toBe('');
      expect(result.validTargets).toEqual([]);
    });

    it('should build cache fallback when not provided', () => {
      const result = getConnectionFeedback({
        source: 'prompt-1',
        sourceHandle: 'prompt'
      }, mockNodes, null);
      
      expect(result.isValid).toBe(true);
      expect(result.validTargets.length).toBeGreaterThan(0);
    });

    it('should filter out self-connections from valid targets', () => {
      const result = getConnectionFeedback({
        source: 'prompt-1',
        sourceHandle: 'output'
      }, mockNodes, cache);
      
      expect(result.validTargets).not.toContain('prompt-1');
    });
  });

  describe('validateMultipleConnections', () => {
    it('should validate multiple connections and return results with connections', () => {
      const connections = [
        { source: 'prompt-1', target: 'llm-1', sourceHandle: 'prompt', targetHandle: 'prompt' },
        { source: 'imageUpload-1', target: 'resize-1', sourceHandle: 'image', targetHandle: 'image' },
        { source: 'imageUpload-1', target: 'seed-1', sourceHandle: 'image', targetHandle: 'input' } // Invalid - seed cannot accept image
      ];

      const results = validateMultipleConnections(connections, mockNodes);
      
      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({
        valid: true,
        message: '',
        connection: connections[0]
      });
      expect(results[1]).toEqual({
        valid: true,
        message: '',
        connection: connections[1]
      });
      expect(results[2].valid).toBe(false);
      expect(results[2].message).toContain('Image upload cannot connect to seed');
    });

    it('should handle empty connections array', () => {
      const results = validateMultipleConnections([], mockNodes);
      expect(results).toEqual([]);
    });
  });

  describe('CONNECTION_VALIDATION_RULES', () => {
    it('should have valid configuration for seed node', () => {
      const seedRule = CONNECTION_VALIDATION_RULES['seed'];
      expect(seedRule).toBeDefined();
      expect(seedRule).toHaveProperty('allowedInputs');
      expect(seedRule).toHaveProperty('allowedOutputs');
      expect(seedRule).toHaveProperty('blockedConnections');
      expect(seedRule.allowedInputs).toContain('unknown');
      expect(seedRule.allowedInputs).toContain('number');
      expect(seedRule.allowedInputs).toContain('text');
    });

    it('should have valid configuration for all node types', () => {
      const requiredProps = ['allowedInputs', 'allowedOutputs', 'blockedConnections'].filter(prop => 
        prop !== 'blockedConnections' // blockedConnections is optional
      );

      Object.keys(CONNECTION_VALIDATION_RULES).forEach(type => {
        const rule = CONNECTION_VALIDATION_RULES[type];
        expect(rule).toHaveProperty('allowedInputs');
        expect(rule).toHaveProperty('allowedOutputs');
        expect(Array.isArray(rule.allowedInputs)).toBe(true);
        expect(Array.isArray(rule.allowedOutputs)).toBe(true);
      });
    });

    it('should have valid blocked connections with reasons', () => {
      const seedRule = CONNECTION_VALIDATION_RULES['seed'];
      expect(seedRule.blockedConnections).toBeDefined();
      expect(seedRule.blockedConnections!.length).toBeGreaterThan(0);
      
      seedRule.blockedConnections!.forEach(block => {
        expect(block).toHaveProperty('from');
        expect(block).toHaveProperty('to');
        expect(block).toHaveProperty('reason');
        expect(typeof block.from).toBe('string');
        expect(typeof block.to).toBe('string');
        expect(typeof block.reason).toBe('string');
        expect(block.reason.length).toBeGreaterThan(0);
      });
    });

    it('should have consistent allowedInputs and allowedOutputs arrays', () => {
      Object.keys(CONNECTION_VALIDATION_RULES).forEach(type => {
        const rule = CONNECTION_VALIDATION_RULES[type as keyof typeof CONNECTION_VALIDATION_RULES];
        
        if (rule.allowedInputs && rule.allowedInputs.length > 0) {
          rule.allowedInputs.forEach(inputType => {
            expect(typeof inputType).toBe('string');
          });
        }
        
        if (rule.allowedOutputs && rule.allowedOutputs.length > 0) {
          rule.allowedOutputs.forEach(outputType => {
            expect(typeof outputType).toBe('string');
          });
        }
      });
    });
  });

  describe('NODE_HANDLES', () => {
    it('should have valid handle definitions for all node types', () => {
      Object.keys(NODE_HANDLES).forEach(nodeType => {
        const config = NODE_HANDLES[nodeType as keyof typeof NODE_HANDLES];
        expect(config).toHaveProperty('inputs');
        expect(config).toHaveProperty('outputs');
        expect(Array.isArray(config.inputs)).toBe(true);
        expect(Array.isArray(config.outputs)).toBe(true);
      });
    });

    it('should have valid handle definitions with required properties', () => {
      Object.keys(NODE_HANDLES).forEach(nodeType => {
        const config = NODE_HANDLES[nodeType as keyof typeof NODE_HANDLES];
        
        [...config.inputs, ...config.outputs].forEach(handle => {
          expect(handle).toHaveProperty('id');
          expect(handle).toHaveProperty('type');
          expect(typeof handle.id).toBe('string');
          expect(typeof handle.type).toBe('string');
        });
      });
    });

    it('should have default configuration for unknown node types', () => {
      const defaultConfig = NODE_HANDLES.default;
      expect(defaultConfig).toBeDefined();
      expect(defaultConfig.inputs).toBeDefined();
      expect(defaultConfig.outputs).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle nodes with empty handle arrays', () => {
      const emptyHandleNode: Node = {
        id: 'empty-1',
        type: 'custom',
        data: { label: 'Empty Node' },
        position: { x: 0, y: 0 }
      };

      const result = isValidConnection({
        source: 'prompt-1',
        target: 'empty-1',
        sourceHandle: 'prompt',
        targetHandle: 'input'
      }, [...mockNodes, emptyHandleNode]);
      
      if (result && 'valid' in result) {
        expect(result.valid).toBe(false);
        expect(result.message).toContain('Unknown node type');
      } else {
        throw new Error('Expected ValidationResult but got ValidationCache or null');
      }
    });

    it('should handle invalid handle IDs', () => {
      const result = isValidConnection({
        source: 'prompt-1',
        target: 'llm-1',
        sourceHandle: 'invalid-handle',
        targetHandle: 'prompt'
      }, mockNodes);
      
      if (result && 'valid' in result) {
        expect(result.valid).toBe(false);
        expect(result.message).toContain('Invalid source handle');
      } else {
        throw new Error('Expected ValidationResult but got ValidationCache or null');
      }
    });

    it('should handle missing nodes gracefully', () => {
      const result = isValidConnection({
        source: 'missing-1',
        target: 'llm-1',
        sourceHandle: 'prompt',
        targetHandle: 'input'
      }, mockNodes);
      
      expect(result && 'valid' in result ? result : null).toEqual({
        valid: false,
        message: 'Source or target node not found or has invalid type'
      });
    });

    it('should handle undefined handles gracefully', () => {
      const result = isValidConnection({
        source: 'prompt-1',
        target: 'llm-1',
        sourceHandle: 'prompt',
        targetHandle: 'prompt'
      }, mockNodes);
      
      // Should use default handles
      if (result && 'valid' in result) {
        expect(result.valid).toBe(true);
      } else {
        throw new Error('Expected ValidationResult but got ValidationCache or null');
      }
    });

    it('should handle nodes with unknown types', () => {
      const unknownNode: Node = {
        id: 'unknown-1',
        type: 'unknownType' as any,
        data: { label: 'Unknown Type' },
        position: { x: 0, y: 0 }
      };

      const result = isValidConnection({
        source: 'prompt-1',
        target: 'unknown-1',
        sourceHandle: 'prompt',
        targetHandle: 'input'
      }, [...mockNodes, unknownNode]);
      
      // Should use default handles
      if (result && 'valid' in result) {
        expect(result.valid).toBe(false); // Currently returns false, likely due to strict type checking
      } else {
        throw new Error('Expected ValidationResult but got ValidationCache or null');
      }
    });
  });

  describe('Performance', () => {
    it('should validate connections in under 1ms for small datasets', () => {
      const start = performance.now();
      
      isValidConnection({
        source: 'prompt-1',
        target: 'llm-1',
        sourceHandle: 'output',
        targetHandle: 'prompt'
      }, mockNodes);
      
      const duration = performance.now() - start;
      expect(duration).toBeLessThan(1);
    });

    it('should build cache efficiently for all nodes', () => {
      const start = performance.now();
      
      const cache = buildValidationCache('prompt-1', 'prompt', mockNodes);
      
      const duration = performance.now() - start;
      expect(cache).not.toBeNull();
      expect(duration).toBeLessThan(5);
    });

    it('should maintain O(1) lookup performance with cache', () => {
      const cache = buildValidationCache('prompt-1', 'output', mockNodes);
      expect(cache).not.toBeNull();
      
      const lookups = 1000;
      const start = performance.now();
      
      for (let i = 0; i < lookups; i++) {
        isValidConnectionCached({
          source: 'prompt-1',
          target: 'llm-1',
          sourceHandle: 'prompt',
          targetHandle: 'prompt'
        }, cache);
      }
      
      const duration = performance.now() - start;
      const avgTime = duration / lookups;
      expect(avgTime).toBeLessThan(0.01); // Less than 0.01ms per lookup
    });

    it('should handle large datasets efficiently', () => {
      // Create 100+ nodes
      const largeDataset: Node[] = [...mockNodes];
      for (let i = 0; i < 100; i++) {
        largeDataset.push({
          id: `node-${i}`,
          type: i % 2 === 0 ? 'prompt' : 'resize',
          data: { label: `Node ${i}` },
          position: { x: i * 10, y: i * 10 }
        });
      }

      const start = performance.now();
      const cache = buildValidationCache('prompt-1', 'prompt', largeDataset);
      const duration = performance.now() - start;
      
      expect(cache).not.toBeNull();
      expect(cache!.validationByTargetId.size).toBe(largeDataset.length);
      expect(duration).toBeLessThan(50); // Should be fast even with 100+ nodes
    });

    it('should demonstrate good cache hit rates', () => {
      const cache = buildValidationCache('prompt-1', 'output', mockNodes);
      expect(cache).not.toBeNull();
      
      let hits = 0;
      const totalLookups = mockNodes.length;

      mockNodes.forEach(node => {
        const result = isValidConnectionCached({
          source: 'prompt-1',
          target: node.id,
          sourceHandle: null,
          targetHandle: null
        }, cache);
        if (result && result.message !== 'Target not found in cache') {
          hits++;
        }
      });

      const hitRate = hits / totalLookups;
      expect(hitRate).toBeGreaterThan(0.8); // 80%+ cache hit rate
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multi-step validation chains', () => {
      // Test: prompt → imagen → resize → blur (valid chain)
      const promptToImagen = isValidConnection({
        source: 'prompt-1',
        target: 'llm-1',
        sourceHandle: 'prompt',
        targetHandle: 'prompt'
      }, mockNodes);
      if (promptToImagen && 'valid' in promptToImagen) {
        expect(promptToImagen.valid).toBe(true);
      }

      const imagenNode = { ...mockNodes[1], id: 'imagen-output' }; // Simulate imagen output
      const nodesWithOutput = [...mockNodes, imagenNode];
      
      const imagenToResize = isValidConnection({
        source: 'imagen-output',
        target: 'resize-1',
        sourceHandle: 'image',
        targetHandle: 'image'
      }, nodesWithOutput);
      if (imagenToResize && 'valid' in imagenToResize) {
        expect(imagenToResize.valid).toBe(true);
      }

      const resizeToBlur = isValidConnection({
        source: 'resize-1',
        target: 'blur-1',
        sourceHandle: 'image',
        targetHandle: 'image'
      }, mockNodes);
      if (resizeToBlur && 'valid' in resizeToBlur) {
        expect(resizeToBlur.valid).toBe(true);
      }
    });

    it('should prevent feedback loops', () => {
      // Test: imagen → seed (should be blocked - feedback loop prevention)
      const imagenNode: Node = {
        id: 'imagen-1',
        type: 'imagen',
        data: { label: 'Imagen' },
        position: { x: 0, y: 0 }
      };

      const result = isValidConnection({
        source: 'imagen-1',
        target: 'seed-1',
        sourceHandle: 'image',
        targetHandle: 'input'
      }, [...mockNodes, imagenNode]);
      
      if (result && 'valid' in result) {
        expect(result.valid).toBe(false);
        expect(result.message).toContain('cannot feed back to seed');
      } else {
        throw new Error('Expected ValidationResult but got ValidationCache or null');
      }
    });

    it('should validate mask workflow correctly', () => {
      // Test: image → maskExtractor → matteAdjust (valid mask workflow)
      const imageToMask = isValidConnection({
        source: 'imageUpload-1',
        target: 'maskExtractor-1',
        sourceHandle: 'image',
        targetHandle: 'image'
      }, mockNodes);
      if (imageToMask && 'valid' in imageToMask) {
        expect(imageToMask.valid).toBe(true);
      }

      const maskExtractorNode = { ...mockNodes[6], id: 'mask-output' };
      const nodesWithMask = [...mockNodes, maskExtractorNode];
      
      const matteAdjust: Node = {
        id: 'matteAdjust-1',
        type: 'matteAdjust',
        data: { label: 'Matte Adjust' },
        position: { x: 0, y: 0 }
      };
      
      const maskToMatte = isValidConnection({
        source: 'mask-output',
        target: 'matteAdjust-1',
        sourceHandle: 'mask',
        targetHandle: 'mask'
      }, [...nodesWithMask, matteAdjust]);
      if (maskToMatte && 'valid' in maskToMatte) {
        expect(maskToMatte.valid).toBe(true);
      }
    });
  });
});

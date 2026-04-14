import { Node } from 'reactflow';
import { NodeType } from '../types';

/**
 * Test helper to create mock nodes for integration tests
 */
export const createMockNode = (
  type: NodeType,
  id?: string,
  position = { x: 0, y: 0 }
): Node => {
  const nodeId = id || `${type}-${Date.now()}`;
  
  return {
    id: nodeId,
    type,
    position,
    data: {
      label: type,
      type,
      config: {},
    },
  };
};

/**
 * Create multiple nodes at once
 */
export const createMockNodes = (...nodeDefs: Array<{type: NodeType; id?: string; position?: {x: number, y: number}}>): Node[] => {
  return nodeDefs.map((def, index) => 
    createMockNode(def.type, def.id || `${def.type}-${index}`, def.position || { x: index * 200, y: 0 })
  );
};

/**
 * Common node configurations for tests
 */
export const testNodes = {
  imageUpload: (id = 'imageUpload-1', position = { x: 0, y: 0 }) => 
    createMockNode('imageUpload', id, position),
  
  resize: (id = 'resize-1', position = { x: 300, y: 0 }) => 
    createMockNode('resize', id, position),
  
  blur: (id = 'blur-1', position = { x: 600, y: 0 }) => 
    createMockNode('blur', id, position),
  
  seed: (id = 'seed-1', position = { x: 300, y: 200 }) => 
    createMockNode('seed', id, position),
  
  prompt: (id = 'prompt-1', position = { x: 0, y: 200 }) => 
    createMockNode('prompt', id, position),
  
  imagen: (id = 'imagen-1', position = { x: 600, y: 200 }) => 
    createMockNode('imagen', id, position),
};

import { create } from 'zustand';
import { 
  Connection, 
  Edge, 
  EdgeChange, 
  Node, 
  NodeChange, 
  addEdge, 
  OnNodesChange, 
  OnEdgesChange, 
  OnConnect, 
  applyNodeChanges, 
  applyEdgeChanges 
} from 'reactflow';
import { WorkflowNodeData } from '../types';
import { checkConnection, ValidationResult } from './connection-validator';
import { NodeType } from '../types';
import { perfMonitor } from '../services/performance';

// Define proper type for node data
interface NodeData {
  label: string;
  type: NodeType;
  config?: Record<string, unknown>;
  [key: string]: unknown; // Allow additional properties
}

interface WorkflowState {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  pendingNodeType: string | null;
  pendingNodeData: NodeData | null;
  isChatOpen: boolean;
  activeChatId: string | null;
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;
  setNodes: (nodes: Node<WorkflowNodeData>[]) => void;
  setEdges: (edges: Edge[]) => void;
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
  addNode: (node: Node<WorkflowNodeData>) => void;
  deleteNode: (nodeId: string) => void;
  deleteEdge: (edgeId: string) => void;
  setPendingNodeType: (type: string | null, data?: NodeData | null) => void;
  setChatOpen: (open: boolean) => void;
  setActiveChatId: (id: string | null) => void;
}

export const useStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  pendingNodeType: null,
  pendingNodeData: null,
  isChatOpen: false,
  activeChatId: null,
  onNodesChange: (changes: NodeChange[]) => {
    set({
      nodes: applyNodeChanges(changes, get().nodes),
    });
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({
      edges: applyEdgeChanges(changes, get().edges),
    });
  },
  onConnect: (connection: Connection) => {
    const validation = perfMonitor.measureValidation(() => 
      checkConnection(connection, get().nodes),
      'store-connection-validation'
    );
    
    if (!validation.valid) {
      console.warn(`[Connection Validator] Blocked: ${validation.message}`, {
        connection,
        reason: validation.message
      });
      return; // BLOCK invalid connections
    }
    
    perfMonitor.mark('update-edge-start');
    set({
      edges: addEdge(connection, get().edges),
    });
    perfMonitor.mark('update-edge-end');
    
    const duration = perfMonitor.measure('update-edge', 'update-edge-start', 'update-edge-end');
    if (duration > 16) {
      console.warn(`[Performance Monitor] Slow edge update: ${duration.toFixed(2)}ms`);
    }
  },
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),
  updateNodeData: (nodeId, data) => {
    perfMonitor.mark(`update-${nodeId}-start`);
    
    set({
      nodes: get().nodes.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...data } };
        }
        return node;
      }),
    });
    
    perfMonitor.mark(`update-${nodeId}-end`);
    
    const duration = perfMonitor.measure(`update-${nodeId}`, `update-${nodeId}-start`, `update-${nodeId}-end`);
    if (duration > 50) {
      console.warn(`[Performance Monitor] Slow node update (${nodeId}): ${duration.toFixed(2)}ms`);
    }
  },
  addNode: (node) => {
    set({
      nodes: [...get().nodes, node],
    });
  },
  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    });
  },
  deleteEdge: (edgeId) => {
    set({
      edges: get().edges.filter((edge) => edge.id !== edgeId),
    });
  },
  setPendingNodeType: (type, data = null) => set({ pendingNodeType: type, pendingNodeData: data }),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setActiveChatId: (id) => set({ activeChatId: id }),
}));

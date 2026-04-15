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

interface NodeData {
  label: string;
  type: NodeType;
  config?: Record<string, unknown>;
  [key: string]: unknown;
}

interface HistoryState {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
}

interface WorkflowState {
  nodes: Node<WorkflowNodeData>[];
  edges: Edge[];
  pendingNodeType: string | null;
  pendingNodeData: NodeData | null;
  isChatOpen: boolean;
  activeChatId: string | null;
  expandedAsset: { url: string; type: 'image' | 'video' | 'audio' } | null;
  history: HistoryState[];
  historyIndex: number;
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
  setExpandedAsset: (url: string | null, type?: 'image' | 'video' | 'audio') => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  saveToHistory: () => void;
}

const MAX_HISTORY = 50;

export const useStore = create<WorkflowState>((set, get) => ({
  nodes: [],
  edges: [],
  pendingNodeType: null,
  pendingNodeData: null,
  isChatOpen: false,
  activeChatId: null,
  expandedAsset: null,
  history: [],
  historyIndex: -1,
  
  saveToHistory: () => {
    const { nodes, edges, history, historyIndex } = get();
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) });
    if (newHistory.length > MAX_HISTORY) {
      newHistory.shift();
    }
    set({ history: newHistory, historyIndex: newHistory.length - 1 });
  },
  
  undo: () => {
    const { history, historyIndex } = get();
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      set({ 
        nodes: JSON.parse(JSON.stringify(prevState.nodes)), 
        edges: JSON.parse(JSON.stringify(prevState.edges)),
        historyIndex: historyIndex - 1 
      });
    }
  },
  
  redo: () => {
    const { history, historyIndex } = get();
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      set({ 
        nodes: JSON.parse(JSON.stringify(nextState.nodes)), 
        edges: JSON.parse(JSON.stringify(nextState.edges)),
        historyIndex: historyIndex + 1 
      });
    }
  },
  
  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
  
  onNodesChange: (changes: NodeChange[]) => {
    const hasRemove = changes.some(c => c.type === 'remove');
    set({ nodes: applyNodeChanges(changes, get().nodes) });
    if (hasRemove) {
      setTimeout(() => get().saveToHistory(), 0);
    }
  },
  onEdgesChange: (changes: EdgeChange[]) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
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
      return;
    }
    
    perfMonitor.mark('update-edge-start');
    set({ edges: addEdge(connection, get().edges) });
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
    set({ nodes: [...get().nodes, node] });
    setTimeout(() => get().saveToHistory(), 0);
  },
  deleteNode: (nodeId) => {
    set({
      nodes: get().nodes.filter((node) => node.id !== nodeId),
      edges: get().edges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId),
    });
    setTimeout(() => get().saveToHistory(), 0);
  },
  deleteEdge: (edgeId) => {
    set({ edges: get().edges.filter((edge) => edge.id !== edgeId) });
    setTimeout(() => get().saveToHistory(), 0);
  },
  setPendingNodeType: (type, data = null) => set({ pendingNodeType: type, pendingNodeData: data }),
  setChatOpen: (open) => set({ isChatOpen: open }),
  setActiveChatId: (id) => set({ activeChatId: id }),
  setExpandedAsset: (url, type = 'image') => {
    if (url) {
      set({ expandedAsset: { url, type } });
    } else {
      set({ expandedAsset: null });
    }
  },
}));

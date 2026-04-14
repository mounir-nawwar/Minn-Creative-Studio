import React, { useCallback, useRef, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Panel,
  useReactFlow,
  ReactFlowProvider,
  OnConnectStartParams,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { NodeType } from '../types';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { nodeTypes } from '../utils/nodeTypes';
import { motion, AnimatePresence } from 'motion/react';
import { db, updateDoc, doc } from '../firebase';
import { stripUndefined } from '../lib/utils';
import { Loader2, CloudCheck, CloudOff } from 'lucide-react';
import { checkConnection } from '../store/connection-validator';
import { ConnectionProvider, useConnectionContext } from '../contexts/ConnectionContext';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { PerfHUD } from '../components/PerfHUD';
import { perfMonitor } from '../services/performance';

const CanvasContent = () => {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
    pendingNodeType,
    pendingNodeData,
    setPendingNodeType,
    addNode,
  } = useStore();

  const { activeWorkflowId, uploadEnabled } = useProjectStore();
  const { screenToFlowPosition } = useReactFlow();
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const { startConnection, endConnection } = useConnectionContext();

  // Canvas initialization performance measurement
  useEffect(() => {
    perfMonitor.mark('canvas-init-start');
    
    return () => {
      const duration = perfMonitor.measure('canvas-init', 'canvas-init-start', 'canvas-init-end');
      if (duration > 100) {
        console.warn(`[Performance Monitor] Slow canvas initialization: ${duration.toFixed(2)}ms`);
      }
    };
  }, [])

  // Simple toast notification system (production would use react-hot-toast or similar)
  const showToast = (message: string, type: 'error' | 'success', action?: { label: string; onClick: () => void }) => {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `fixed top-4 right-4 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white p-3 rounded-lg shadow-lg z-50`;
    toast.textContent = message;
    
    if (action) {
      const button = document.createElement('button');
      button.className = 'ml-3 bg-white text-red-500 px-2 py-1 rounded text-sm';
      button.textContent = action.label;
      button.onclick = () => {
        action.onClick();
        toast.remove();
      };
      toast.appendChild(button);
    }
    
    document.body.appendChild(toast);
    
    // Auto-remove after 5 seconds if not already removed
    const timeoutId = setTimeout(() => {
      if (toast.parentNode) {
        toast.remove();
      }
    }, 5000);
    
    // Store timeout ID on the element for manual cleanup if needed
    (toast as any)._timeoutId = timeoutId;
  };

  useEffect(() => {
    pendingRef.current = pendingNodeType;
  }, [pendingNodeType]);

  // ReactFlow event handlers that integrate with connection context
  const handleConnectStart = useCallback((event: React.MouseEvent | React.TouchEvent, params: OnConnectStartParams) => {
    startConnection({
      source: params.nodeId,
      sourceHandle: params.handleId,
    });
  }, [startConnection]);

  const handleConnectEnd = useCallback(() => {
    endConnection();
  }, [endConnection]);

  // Auto-save logic
  useEffect(() => {
    if (!activeWorkflowId) return;

    const saveWorkflow = async () => {
      setSaveStatus('saving');
      try {
        const wfRef = doc(db, 'workflows', activeWorkflowId);
        await updateDoc(wfRef, {
          nodes: nodes.map(n => {
            const nodeData = { ...n.data };
            // Strip transient base64 data URLs — they exceed Firestore's 1MB/10MB limits
            // and are replaced by Firebase Storage URLs after server-side upload
            if (typeof nodeData.output === 'string' && nodeData.output.startsWith('data:')) {
              delete nodeData.output;
            }
            if (Array.isArray(nodeData.outputs)) {
              const filtered = nodeData.outputs.filter((u: unknown) => typeof u !== 'string' || !u.startsWith('data:'));
              nodeData.outputs = filtered.length ? filtered : undefined;
            }
            return {
              id: n.id,
              type: n.type,
              position: { x: isFinite(n.position.x) ? n.position.x : 0, y: isFinite(n.position.y) ? n.position.y : 0 },
              data: stripUndefined(nodeData),
            };
          }),
          edges: edges.map(e => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle ?? null,
            targetHandle: e.targetHandle ?? null,
            type: e.type ?? null,
            animated: e.animated ?? false,
            data: e.data ? stripUndefined(e.data) : null,
          })),
          updatedAt: new Date()
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Failed to save workflow:', err);
        setSaveStatus('error');
        
        showToast(
          `Save failed: ${errorMessage}`,
          'error',
          {
            label: 'Retry',
            onClick: () => {
              setSaveStatus('saving');
              saveWorkflow(); // Retry
            }
          }
        );
        
        // Log to Sentry in production
        // Sentry.captureException(err);
      }
    };

    // Debounce save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(saveWorkflow, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, edges, activeWorkflowId]);

  // Only track mouse position when placing nodes (pendingNodeType is active)
  useEffect(() => {
    if (!pendingNodeType) return;
    
    const handleMouseMove = (e: MouseEvent) => {
      setGhostPos({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [pendingNodeType, setGhostPos]);

  // Always listen for Escape key to cancel node placement
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pendingRef.current) {
        setPendingNodeType(null);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setPendingNodeType, pendingRef]);

  useEffect(() => {
    perfMonitor.mark('canvas-init-end');
  }, []);

  const handleWrapperClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!pendingRef.current) return;
      e.stopPropagation();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const nodeType = pendingRef.current;
      const nodeData = pendingNodeData || {
        label: nodeType,
        type: nodeType as NodeType,
        config: {},
      };
      if (nodeType === 'imageUpload' || nodeType === 'videoUpload') {
        nodeData.uploadEnabled = uploadEnabled;
      }
      addNode({
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: nodeData as import('../types').WorkflowNodeData,
      });
      setPendingNodeType(null);
    },
    [screenToFlowPosition, pendingNodeData, addNode, setPendingNodeType]
  );

  return (
    <div
      ref={wrapperRef}
      onClick={handleWrapperClick}
      className={`flex-1 h-full bg-[#050505] relative overflow-hidden ${
        pendingNodeType ? 'cursor-crosshair' : ''
      }`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        isValidConnection={(connection) => {
          const validation = perfMonitor.measureValidation(() =>
            checkConnection(connection, nodes),
            'canvas-connection-validation'
          );
          return !!validation && validation.valid;
        }}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        panOnDrag={!pendingNodeType}
        style={{ background: '#050505' }}
        defaultEdgeOptions={{
          style: { stroke: '#0097A7', strokeWidth: 2 },
          animated: true,
        }}
      >
        <Background color="#1a1a1a" gap={30} size={1} variant={BackgroundVariant.Dots} />
        <Controls
          className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden fill-gray-400"
          showInteractive={false}
        />
        <MiniMap
          className="bg-[#111111] border border-[#1a1a1a] rounded-lg overflow-hidden"
          maskColor="rgba(0, 0, 0, 0.7)"
          nodeColor="#0097A7"
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
        <Panel
          position="bottom-left"
          className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-4"
        >
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
            {nodes.length} Nodes • {edges.length} Connections
          </p>
          
          <div className="h-3 w-px bg-white/10" />
          
          <div className="flex items-center gap-1.5">
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-3 h-3 text-[#0097A7] animate-spin" />
                <span className="text-[8px] text-[#0097A7] font-black uppercase tracking-widest">Saving Changes</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <CloudCheck className="w-3 h-3 text-green-500" />
                <span className="text-[8px] text-green-500 font-black uppercase tracking-widest">Workflow Saved</span>
              </>
            )}
            {saveStatus === 'error' && (
              <>
                <CloudOff className="w-3 h-3 text-red-500" />
                <span className="text-[8px] text-red-500 font-black uppercase tracking-widest">Save Failed</span>
              </>
            )}
            {saveStatus === 'idle' && (
              <>
                <CloudCheck className="w-3 h-3 text-gray-600" />
                <span className="text-[8px] text-gray-600 font-black uppercase tracking-widest">Cloud Sync Active</span>
              </>
            )}
          </div>
        </Panel>
      </ReactFlow>

      {process.env.NODE_ENV === 'development' && <PerfHUD />}

      <AnimatePresence>
        {pendingNodeType && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 0.45, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed pointer-events-none z-[9999] border-2 border-[#0097A7] bg-[#111111] rounded-3xl p-6 w-[280px] shadow-2xl"
              style={{
                left: 0,
                top: 0,
                transform: `translate(${ghostPos.x - 140}px, ${ghostPos.y - 60}px)`,
              }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-20 h-2 bg-white/10 rounded-full" />
                <div className="w-4 h-4 bg-[#0097A7]/30 rounded-lg" />
              </div>
              <div className="space-y-2">
                <div className="w-full h-3 bg-white/5 rounded-lg" />
                <div className="w-2/3 h-3 bg-white/5 rounded-lg" />
              </div>
              <p className="mt-4 text-[10px] font-black text-[#0097A7] uppercase tracking-widest text-center">
                {pendingNodeData?.label || pendingNodeType}
              </p>
            </motion.div>

            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="fixed top-36 left-1/2 -translate-x-1/2 z-[10000] bg-[#0097A7] text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl border border-white/20 flex items-center gap-2"
            >
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Click to place — Esc to cancel
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );

};

const Canvas = () => (
  <ReactFlowProvider>
    <ErrorBoundary fallback={<div className="text-red-500 p-4">An error occurred. Please reload the page.</div>}>
      <ConnectionProvider>
        <CanvasContent />
      </ConnectionProvider>
    </ErrorBoundary>
  </ReactFlowProvider>
);

export default Canvas;

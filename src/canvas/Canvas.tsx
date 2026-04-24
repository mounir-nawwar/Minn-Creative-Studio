import React, { useCallback, useRef, useEffect, useState, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Panel,
  useReactFlow,
  OnConnectStartParams,
  Connection,
  type OnConnectStart
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { nodeTypes } from '../utils/nodeTypes';
import { motion, AnimatePresence } from 'motion/react';
import { db, updateDoc, doc } from '../firebase';
import { stripUndefined } from '../lib/utils';
import { Loader2, CloudCheck, CloudOff } from 'lucide-react';
import { useConnectionContext } from '../contexts/ConnectionContext';
import { type SourceInfo } from '../contexts/ConnectionContext';
import { checkConnection } from '../store/connection-validator';
import { type WorkflowNodeData } from '../types';

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
    undo,
    redo,
    canUndo,
    canRedo,
  } = useStore();

  const { activeWorkflowId, uploadEnabled } = useProjectStore();
  const { isConnecting, connectionValidation, startConnection, endConnection, setHoveredTarget, sourceInfo } = useConnectionContext();
  const { screenToFlowPosition, getNodes, getViewport } = useReactFlow();
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    pendingRef.current = pendingNodeType;
  }, [pendingNodeType]);

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
              const filtered = nodeData.outputs.filter((u: any) => typeof u !== 'string' || !u.startsWith('data:'));
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
        console.error('Failed to save workflow:', err);
        setSaveStatus('error');
      }
    };

    // Debounce save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(saveWorkflow, 2000);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [nodes, edges, activeWorkflowId]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setGhostPos({ x: e.clientX, y: e.clientY });
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && pendingRef.current) {
        setPendingNodeType(null);
      }
      
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isInput) return;
      
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const selectedNodes = getNodes().filter(n => n.selected);
        if (selectedNodes.length > 0) {
          const nodeIds = selectedNodes.map(n => n.id);
          onNodesChange(nodeIds.map(id => ({ type: 'remove', id })));
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        const selectedNodes = getNodes().filter(n => n.selected);
        if (selectedNodes.length > 0) {
          selectedNodes.forEach(node => {
            const newNodeId = `${node.id}-${Date.now()}`;
            const newNode = {
              ...node,
              id: newNodeId,
              position: {
                x: node.position.x + 50,
                y: node.position.y + 50,
              },
              data: { ...node.data },
              selected: false,
            };
            addNode(newNode);
          });
        }
      }
      
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) undo();
      }
      
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo()) redo();
      }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setPendingNodeType, getNodes, onNodesChange, addNode, undo, redo, canUndo, canRedo]);

  // Global mouse move handler for connection drag hover detection.
  // Uses proximity detection (radius-based) instead of exact elementFromPoint so
  // the handle highlights as soon as the dragged line endpoint is near the dot,
  // not only when the cursor is pixel-perfect on the 12px circle.
  useEffect(() => {
    const handleConnectionMouseMove = (e: MouseEvent) => {
      if (!isConnecting || !sourceInfo) return;

      // Scale the hit radius with zoom: zoomed-in = larger handles on screen = bigger snap zone.
      // 28 canvas units * zoom → screen pixels. Clamped between 14px (zoomed out) and 56px (zoomed in).
      const { zoom } = getViewport();
      const HIT_RADIUS = Math.min(56, Math.max(14, 28 * zoom));

      // Find the closest handle within HIT_RADIUS of the cursor
      const allHandles = document.querySelectorAll<Element>('.react-flow__handle');
      let closestHandle: Element | null = null;
      let closestDist = Infinity;

      for (const handle of allHandles) {
        const rect = handle.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
        if (dist < HIT_RADIUS && dist < closestDist) {
          closestDist = dist;
          closestHandle = handle;
        }
      }

      if (!closestHandle) {
        setHoveredTarget(null);
        return;
      }

      const nodeElement = closestHandle.closest('.react-flow__node');
      if (!nodeElement) {
        setHoveredTarget(null);
        return;
      }

      const nodeId = nodeElement.getAttribute('data-id');
      const handleId = closestHandle.getAttribute('data-handleid');

      if (!nodeId || !handleId || nodeId === sourceInfo.nodeId) {
        setHoveredTarget(null);
        return;
      }

      const nodes = getNodes();
      const validation = checkConnection(
        {
          source: sourceInfo.nodeId,
          sourceHandle: sourceInfo.handleId,
          target: nodeId,
          targetHandle: handleId,
        },
        nodes
      );

      setHoveredTarget({ nodeId, handleId, validation });
    };

    if (isConnecting) {
      window.addEventListener('mousemove', handleConnectionMouseMove);
      return () => window.removeEventListener('mousemove', handleConnectionMouseMove);
    }
  }, [isConnecting, sourceInfo, setHoveredTarget, getNodes]);

  const handleWrapperClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!pendingRef.current) return;
      e.stopPropagation();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const nodeType = pendingRef.current;
      const nodeData: WorkflowNodeData = pendingNodeData || {
        label: nodeType,
        type: nodeType as any,
        config: {},
      };
      if (nodeType === 'imageUpload' || nodeType === 'videoUpload') {
        nodeData.uploadEnabled = uploadEnabled;
      }
      addNode({
        id: `${nodeType}-${Date.now()}`,
        type: nodeType,
        position,
        data: nodeData,
      });
      setPendingNodeType(null);
    },
    [screenToFlowPosition, pendingNodeData, addNode, setPendingNodeType, uploadEnabled]
  );

  const handleConnectStart = useCallback<OnConnectStart>((event, params) => {
    if (params.nodeId && params.handleId && params.handleType) {
      if (process.env.NODE_ENV === 'development') {
        console.log('[Connection Debug] Connect start:', {
          nodeId: params.nodeId,
          handleId: params.handleId,
          handleType: params.handleType,
        });
      }
      
      const sourceInfo: SourceInfo = {
        nodeId: params.nodeId,
        handleId: params.handleId,
        handleType: params.handleType as 'source' | 'target',
      };
      startConnection(sourceInfo);
    }
  }, [startConnection]);

  const handleConnectEnd = useCallback(() => {
    endConnection();
  }, [endConnection]);

  // Dynamic connection line styling based on validation
  const connectionLineStyle = useMemo(() => {
    if (!isConnecting) {
      // Default cyan color when not hovering over a target
      return { stroke: '#0097A7', strokeWidth: 2 };
    }
    
    if (connectionValidation) {
      // Green for valid, red for invalid
      return {
        stroke: connectionValidation.valid ? '#10b981' : '#ef4444',
        strokeWidth: 3,
      };
    }
    
    // During drag but not hovering over any target
    return { stroke: '#0097A7', strokeWidth: 2 };
  }, [isConnecting, connectionValidation]);

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
          connectionLineStyle={connectionLineStyle}
          
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
          style={{ marginLeft: '52px' }}
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

const Canvas = CanvasContent;

export default Canvas;

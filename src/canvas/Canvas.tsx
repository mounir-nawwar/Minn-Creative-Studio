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
import { workflowsApi } from '../lib/api';
import { stripUndefined } from '../lib/utils';
import { Loader2, CloudCheck, CloudOff } from 'lucide-react';
import { useConnectionContext } from '../contexts/ConnectionContext';
import { type SourceInfo } from '../contexts/ConnectionContext';
import { checkConnection } from '../store/connection-validator';
import { type WorkflowNodeData } from '../types';
import { useWorkflowSync } from '../hooks/useWorkflowSync';

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
  // True while local edits are queued for the debounced save — live sync merges
  // rather than replaces when this is set.
  const dirtyRef = useRef(false);
  // Set just before live sync writes to the store, so the graph it just pulled
  // in doesn't immediately bounce back out as a "local" auto-save.
  const applyingRemoteRef = useRef(false);

  // Stable per-mount token identifying this canvas's own writes, so live sync
  // never mistakes our own auto-save for a foreign change.
  const clientTokenRef = useRef<string>(
    (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const isDirty = useCallback(() => dirtyRef.current, []);
  const onBeforeApply = useCallback(() => {
    applyingRemoteRef.current = true;
  }, []);
  const { markSaved } = useWorkflowSync({ workflowId: activeWorkflowId, clientToken: clientTokenRef.current, isDirty, onBeforeApply });

  useEffect(() => {
    pendingRef.current = pendingNodeType;
  }, [pendingNodeType]);

  // Auto-save logic
  useEffect(() => {
    if (!activeWorkflowId) return;

    // Changes we just pulled from the server are not local edits.
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }
    dirtyRef.current = true;

    const saveWorkflow = async () => {
      setSaveStatus('saving');
      try {
        const saved = await workflowsApi.update(activeWorkflowId, {
          nodes: nodes.map(n => {
            const nodeData = { ...n.data };
            // Strip transient base64 data URLs — they exceed size limits
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
          clientToken: clientTokenRef.current,
        });
        // Our own write defines the new server revision — record it so live
        // sync doesn't mistake the echo for someone else's change.
        dirtyRef.current = false;
        if (saved?.updated_at) markSaved(saved.updated_at);
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
  }, [nodes, edges, activeWorkflowId, markSaved]);

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
          className="overflow-hidden rounded-lg fill-gray-400 ring-1 ring-white/10 [&_button]:border-white/5 [&_button]:bg-[#111111]"
          showInteractive={false}
        />
        <MiniMap
          className="overflow-hidden rounded-lg ring-1 ring-white/10 [&>svg]:bg-[#111111]"
          maskColor="rgba(0, 0, 0, 0.7)"
          nodeColor="#0097A7"
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
        <Panel
          position="bottom-left"
          style={{ marginLeft: '52px' }}
          className="flex items-center gap-3 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 backdrop-blur-md"
        >
          <p className="text-[11px] text-gray-400">
            <span className="tabular-nums">{nodes.length}</span> nodes · <span className="tabular-nums">{edges.length}</span> connections
          </p>

          <div className="h-3 w-px bg-white/10" />

          <div className="flex items-center gap-1.5">
            {saveStatus === 'saving' && (<><Loader2 className="h-3 w-3 animate-spin text-[#0097A7]" /><span className="text-[11px] text-[#0097A7]">Saving…</span></>)}
            {saveStatus === 'saved' && (<><CloudCheck className="h-3 w-3 text-emerald-500" /><span className="text-[11px] text-emerald-500">Saved</span></>)}
            {saveStatus === 'error' && (<><CloudOff className="h-3 w-3 text-red-500" /><span className="text-[11px] text-red-500">Save failed</span></>)}
            {saveStatus === 'idle' && (<><CloudCheck className="h-3 w-3 text-gray-600" /><span className="text-[11px] text-gray-500">Synced</span></>)}
          </div>
        </Panel>
      </ReactFlow>

      <AnimatePresence>
        {pendingNodeType && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="pointer-events-none fixed z-[9999] w-[280px] rounded-xl bg-[#111111] p-5 shadow-2xl ring-1 ring-[#0097A7]/60"
              style={{ left: 0, top: 0, transform: `translate(${ghostPos.x - 140}px, ${ghostPos.y - 60}px)` }}
            >
              <div className="mb-3 flex items-center justify-between">
                <div className="h-2 w-20 rounded-full bg-white/10" />
                <div className="h-4 w-4 rounded-md bg-[#0097A7]/30" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-full rounded-md bg-white/5" />
                <div className="h-3 w-2/3 rounded-md bg-white/5" />
              </div>
              <p className="mt-4 text-center text-[11px] font-medium text-[#0097A7]">{pendingNodeData?.label || pendingNodeType}</p>
            </motion.div>

            <motion.div
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
              className="fixed left-1/2 top-36 z-[10000] inline-flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-[#0097A7] px-4 py-2 text-[12px] font-medium text-white shadow-[0_8px_24px_-6px_rgba(0,151,167,0.7)]"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
              Click to place · Esc to cancel
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const Canvas = CanvasContent;

export default Canvas;

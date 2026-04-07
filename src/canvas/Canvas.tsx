import React, { useCallback, useRef, useEffect, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  Panel,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { nodeTypes } from '../utils/nodeTypes';
import { motion, AnimatePresence } from 'motion/react';
import { db, updateDoc, doc } from '../firebase';
import { stripUndefined } from '../lib/utils';
import { Loader2, CloudCheck, CloudOff } from 'lucide-react';

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
          nodes: nodes.map(n => ({
            id: n.id,
            type: n.type,
            position: n.position,
            data: stripUndefined(n.data),
          })),
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
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [setPendingNodeType]);

  const handleWrapperClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!pendingRef.current) return;
      e.stopPropagation();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const nodeType = pendingRef.current;
      const nodeData = pendingNodeData || {
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
    <CanvasContent />
  </ReactFlowProvider>
);

export default Canvas;

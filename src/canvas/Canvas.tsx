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
import { nodeTypes } from '../utils/nodeTypes';
import { motion, AnimatePresence } from 'motion/react';

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

  const { screenToFlowPosition } = useReactFlow();
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    pendingRef.current = pendingNodeType;
  }, [pendingNodeType]);

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
          className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10"
        >
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
            {nodes.length} Nodes • {edges.length} Connections
          </p>
        </Panel>
      </ReactFlow>

      <AnimatePresence>
        {pendingNodeType && (
          <>
            {/* Ghost node following cursor */}
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

            {/* Tooltip — top-36 = 144px, safely below ProjectContextBar (48px) + Toolbar (64px) = 112px */}
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="fixed top-36 left-1/2 -translate-x-1/2 z-[10000] bg-[#0097A7] text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl border border-white/20 flex items-center gap-2 pointer-events-none"
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

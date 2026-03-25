import React, { useCallback, useRef, useEffect, useState } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  BackgroundVariant,
  Panel,
  useReactFlow,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store/useStore';
import { nodeTypes } from '../utils/nodeTypes';
import { motion, AnimatePresence } from 'motion/react';
import { Plus } from 'lucide-react';

const CanvasContent = () => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect, pendingNodeType, pendingNodeData, setPendingNodeType, addNode } = useStore();
  const { screenToFlowPosition } = useReactFlow();
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pendingNodeType) return;

    const handleMouseMove = (e: MouseEvent) => {
      setGhostPos({ x: e.clientX, y: e.clientY });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingNodeType(null);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pendingNodeType, setPendingNodeType]);

  const onPaneClick = useCallback((e: React.MouseEvent) => {
    if (pendingNodeType) {
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      const id = `${pendingNodeType}-${Date.now()}`;
      
      // Use pendingNodeData if available, otherwise default
      const nodeData = pendingNodeData || { 
        label: pendingNodeType, 
        type: pendingNodeType as any, 
        config: {} 
      };

      addNode({
        id,
        type: pendingNodeType,
        position,
        data: nodeData,
      });
      setPendingNodeType(null);
    }
  }, [pendingNodeType, pendingNodeData, screenToFlowPosition, addNode, setPendingNodeType]);

  return (
    <div 
      ref={wrapperRef}
      className={`flex-1 h-full bg-[#050505] relative overflow-hidden ${pendingNodeType ? 'cursor-crosshair' : ''}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        fitView
        snapToGrid
        snapGrid={[15, 15]}
        style={{ background: '#050505' }}
        defaultEdgeOptions={{
          style: { stroke: '#0097A7', strokeWidth: 2 },
          animated: true,
        }}
      >
        <Background 
          color="#1a1a1a" 
          gap={30} 
          size={1} 
          variant={BackgroundVariant.Dots} 
        />
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
        
        <Panel position="bottom-left" className="bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
            {nodes.length} Nodes • {edges.length} Connections
          </p>
        </Panel>
      </ReactFlow>

      {/* Ghost Overlay */}
      <AnimatePresence>
        {pendingNodeType && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed pointer-events-none z-[9999] border-2 border-[#0097A7] bg-[#111111] rounded-3xl p-6 w-[320px] shadow-2xl"
              style={{ 
                left: 0, 
                top: 0, 
                transform: `translate(${ghostPos.x}px, ${ghostPos.y}px) translate(-50%, -50%)` 
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-24 h-2 bg-white/10 rounded-full" />
                <div className="w-4 h-4 bg-white/10 rounded-lg" />
              </div>
              <div className="space-y-2">
                <div className="w-full h-4 bg-white/5 rounded-lg" />
                <div className="w-2/3 h-4 bg-white/5 rounded-lg" />
              </div>
              <p className="mt-4 text-[10px] font-black text-[#0097A7] uppercase tracking-widest text-center">
                {pendingNodeData?.label || pendingNodeType}
              </p>
            </motion.div>

            {/* Tooltip */}
            <motion.div 
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="fixed top-20 left-1/2 -translate-x-1/2 z-[10000] bg-[#0097A7] text-white px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl border border-white/20"
            >
              Click to place — Esc to cancel
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const Canvas = () => {
  return (
    <ReactFlowProvider>
      <CanvasContent />
    </ReactFlowProvider>
  );
};

export default Canvas;

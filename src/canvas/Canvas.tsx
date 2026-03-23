import React, { useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  BackgroundVariant,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useStore } from '../store/useStore';
import { nodeTypes } from '../utils/nodeTypes';

const Canvas = () => {
  const { nodes, edges, onNodesChange, onEdgesChange, onConnect } = useStore();

  return (
    <div className="flex-1 h-full bg-[#050505] relative overflow-hidden">
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
    </div>
  );
};

export default Canvas;

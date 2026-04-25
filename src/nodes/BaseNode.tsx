import React, { ReactNode, useMemo, useEffect, useRef, ComponentType } from 'react';
import { Handle, Position, HandleType, useUpdateNodeInternals } from 'reactflow';
import { cn } from '../lib/utils';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { NODE_HANDLES, HandleDefinition } from '../types/connection.types';
import { calcHandlePosition } from '../lib/utils';
import { useConnectionContext } from '../contexts/ConnectionContext';

interface BaseNodeProps {
  id: string;
  data: {
    label: string;
    isRunning?: boolean;
    error?: string;
    triggerRun?: number;
    type?: string;
    inputHandles?: HandleDefinition[];
    outputHandles?: HandleDefinition[];
    progress?: number | string;
  };
  children: ReactNode;
  inputs?: boolean;
  outputs?: boolean;
  className?: string;
  onRun?: () => void;
  color?: string;
  icon?: ComponentType<any>;
}

const BaseNode: React.FC<BaseNodeProps> = ({ 
  id, 
  data, 
  children, 
  inputs = true, 
  outputs = true,
  className,
  onRun,
  color,
  icon: Icon
}) => {
  const deleteNode = useStore((state) => state.deleteNode);
  const updateNodeInternals = useUpdateNodeInternals();
  const { hoveredTargetInfo } = useConnectionContext();
  const nodeRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);

  const { inputHandles, outputHandles } = useMemo(() => {
    const nodeType = data.type || 'default';
    const defaultHandles = NODE_HANDLES[nodeType as keyof typeof NODE_HANDLES];

    return {
      inputHandles: data.inputHandles || (defaultHandles?.inputs || []),
      outputHandles: data.outputHandles || (defaultHandles?.outputs || [])
    };
  }, [data]);

  // Re-measure when node content resizes (e.g., when output appears/disappears).
  // Debounced via rAF so we never measure during a CSS transition or animation frame.
  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;

    const observer = new ResizeObserver(() => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        updateNodeInternals(id);
        rafRef.current = null;
      });
    });

    observer.observe(node);

    return () => {
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [id, updateNodeInternals]);

  // Returns the drag-hover colour class for a handle, driven by proximity detection.
  const getHandleHoverClass = (handleId: string) => {
    if (!hoveredTargetInfo || hoveredTargetInfo.nodeId !== id || hoveredTargetInfo.handleId !== handleId) {
      return '';
    }
    return hoveredTargetInfo.validation?.valid
      ? 'bg-emerald-500 border-emerald-400 scale-125'
      : 'bg-red-500 border-red-400 scale-125';
  };

  // For backward compatibility: if no handle definitions and inputs/outputs are true, render single handles
  const renderHandles = (type: HandleType, handles: HandleDefinition[]) => {
    if (handles.length === 0) {
      // Backward compatibility: render single default handle
      if ((type === 'target' && inputs) || (type === 'source' && outputs)) {
        const position = type === 'target' ? Position.Left : Position.Right;
        const handleId = type === 'target' ? 'input' : 'output';

        return (
          <Handle
            key={`${type}-default`}
            type={type}
            position={position}
            id={handleId}
            className={cn(
              "w-3 h-3 bg-[#0097A7] border-2 border-[#111111] hover:scale-110 transition-all duration-100 z-10",
              position === Position.Left ? "-left-[6px]" : "-right-[6px]",
              getHandleHoverClass(handleId)
            )}
            style={{ top: '50%', transform: 'translateY(-50%)' }}
          />
        );
      }
      return null;
    }

    return handles.map((handle, index) => {
      const position = handle.position || (type === 'target' ? Position.Left : Position.Right);
      const topPercent = calcHandlePosition(index, handles.length);

      return (
        <Handle
          key={`${type}-${handle.id}`}
          type={type}
          position={position}
          id={handle.id}
          className={cn(
            "w-3 h-3 bg-[#0097A7] border-2 border-[#111111] hover:scale-110 transition-all duration-100 z-10",
            position === Position.Left ? "-left-[6px]" : "-right-[6px]",
            getHandleHoverClass(handle.id)
          )}
          style={{ top: topPercent, transform: 'translateY(-50%)' }}
        />
      );
    });
  };

  return (
    <motion.div
      ref={nodeRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.15 }}
      onAnimationComplete={() => updateNodeInternals(id)}
      className={cn(
        "w-[320px] bg-[#111111] border border-[#1a1a1a] rounded-xl shadow-2xl transition-all duration-300",
        "relative", // Add positioning context for absolute handles
        data.isRunning && "border-[#0097A7] shadow-[0_0_15px_rgba(0,151,167,0.3)]",
        data.error && "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]",
        className
      )}
      style={{ position: 'relative' }} // Ensure handles can be absolutely positioned
    >
      {/* Input Handles - Rendered as first children with absolute positioning */}
      {inputs && (
        <>
          {renderHandles('target', inputHandles)}
        </>
      )}
      
      <div className="px-4 py-2 bg-[#1a1a1a] flex items-center justify-between group/header relative overflow-hidden rounded-t-xl">
        {data.isRunning && (
          <div 
            className="absolute bottom-0 left-0 h-[2px] w-[200%] bg-gradient-to-r from-transparent via-[#0097A7] to-transparent"
            style={{ animation: 'shimmer 1.5s infinite linear' }}
          />
        )}
        <div className="flex items-center gap-2 z-10">
          {Icon && <Icon className="w-4 h-4 text-gray-400" />}
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">{data.label}</span>
        </div>
        <div className="flex items-center gap-2 z-10">
          {data.isRunning && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-[#0097A7] tabular-nums">{typeof data.progress === 'string' ? data.progress : `${data.progress || 0}%`}</span>
              <Loader2 className="w-4 h-4 text-[#0097A7] animate-spin" />
            </div>
          )}
          {data.error && <AlertCircle className="w-4 h-4 text-red-500" />}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              deleteNode(id);
            }}
            className="opacity-0 group-hover/header:opacity-100 p-1 hover:bg-white/10 rounded transition-all"
          >
            <X className="w-3 h-3 text-gray-500 hover:text-white" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 overflow-hidden">
        {children}
      </div>

      <AnimatePresence>
        {data.error && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-4 py-2 bg-red-950/20 border-t border-red-500/30"
          >
            <p className="text-[10px] text-red-400 leading-tight">{data.error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {outputs && (
        <>
          {renderHandles('source', outputHandles)}
        </>
      )}
    </motion.div>
  );
};

export default BaseNode;

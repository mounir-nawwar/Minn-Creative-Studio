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
        "relative w-[320px] rounded-xl bg-[#111111] ring-1 ring-white/[0.07] shadow-[0_1px_2px_rgba(0,0,0,0.4)] transition-shadow duration-200",
        data.isRunning && "ring-[#0097A7]/70 shadow-[0_0_20px_rgba(0,151,167,0.25)]",
        data.error && "ring-red-500/70 shadow-[0_0_20px_rgba(239,68,68,0.2)]",
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
      
      <div className="group/header relative flex items-center justify-between overflow-hidden rounded-t-xl border-b border-white/5 bg-white/[0.03] px-3.5 py-2">
        {data.isRunning && (
          <div
            className="absolute bottom-0 left-0 h-[2px] w-[200%] bg-gradient-to-r from-transparent via-[#0097A7] to-transparent"
            style={{ animation: 'shimmer 1.5s infinite linear' }}
          />
        )}
        <div className="z-10 flex items-center gap-2">
          {Icon && <Icon className="h-3.5 w-3.5 text-gray-400" />}
          <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-300">{data.label}</span>
        </div>
        <div className="z-10 flex items-center gap-2">
          {data.isRunning && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium tabular-nums text-[#0097A7]">{typeof data.progress === 'string' ? data.progress : `${data.progress || 0}%`}</span>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0097A7]" />
            </div>
          )}
          {data.error && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
          <button
            onClick={(e) => {
              e.stopPropagation();
              deleteNode(id);
            }}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-gray-500 opacity-0 transition-[transform,color,background-color] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.96] group-hover/header:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-4 overflow-hidden p-4">
        {children}
      </div>

      <AnimatePresence>
        {data.error && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="border-t border-red-500/20 bg-red-500/[0.08] px-4 py-2"
          >
            <p className="text-[11px] leading-tight text-red-400">{data.error}</p>
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

// Memoized for 60 FPS Canvas performance on large graphs
export const MemoizedBaseNode = React.memo(BaseNode, (prev, next) => {
  if (prev.id !== next.id) return false;
  if (prev.className !== next.className) return false;
  if (prev.inputs !== next.inputs) return false;
  if (prev.outputs !== next.outputs) return false;
  if (prev.color !== next.color) return false;
  if (prev.data.isRunning !== next.data.isRunning) return false;
  if (prev.data.error !== next.data.error) return false;
  if (prev.data.progress !== next.data.progress) return false;
  if (prev.data.triggerRun !== next.data.triggerRun) return false;
  if (prev.data.label !== next.data.label) return false;
  if (prev.data.type !== next.data.type) return false;

  if (prev.data !== next.data) {
    if (JSON.stringify(prev.data) !== JSON.stringify(next.data)) return false;
  }

  return true;
});

export default MemoizedBaseNode;

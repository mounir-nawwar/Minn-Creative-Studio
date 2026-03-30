import React, { ReactNode, useEffect } from 'react';
import { Handle, Position } from 'reactflow';
import { cn } from '../lib/utils';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';

interface BaseNodeProps {
  id: string;
  data: {
    label: string;
    isRunning?: boolean;
    error?: string;
    triggerRun?: number;
    type?: string;
  };
  children: ReactNode;
  inputs?: boolean;
  outputs?: boolean;
  className?: string;
  onRun?: () => void;
}

const BaseNode: React.FC<BaseNodeProps> = ({ 
  id, 
  data, 
  children, 
  inputs = true, 
  outputs = true,
  className,
  onRun
}) => {
  const deleteNode = useStore((state) => state.deleteNode);

  // Handle triggerRun from Toolbar
  useEffect(() => {
    if (data.triggerRun && onRun) {
      onRun();
    }
  }, [data.triggerRun]);

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "w-[320px] bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl transition-all duration-300",
        data.isRunning && "border-[#0097A7] shadow-[0_0_15px_rgba(0,151,167,0.3)]",
        data.error && "border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]",
        className
      )}
    >
      {inputs && (
        <Handle
          type="target"
          position={Position.Left}
          className="w-3 h-3 bg-[#0097A7] border-2 border-[#111111]"
        />
      )}
      
      <div className="px-4 py-2 bg-[#1a1a1a] flex items-center justify-between group/header relative overflow-hidden">
        {data.isRunning && (
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${data.progress || 0}%` }}
            className="absolute bottom-0 left-0 h-[2px] bg-[#0097A7] shadow-[0_0_10px_rgba(0,151,167,0.5)]"
          />
        )}
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider z-10">{data.label}</span>
        <div className="flex items-center gap-2 z-10">
          {data.isRunning && (
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-bold text-[#0097A7] animate-pulse">{data.progress || 0}%</span>
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

      <div className="p-4 space-y-4">
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
        <Handle
          type="source"
          position={Position.Right}
          className="w-3 h-3 bg-[#0097A7] border-2 border-[#111111]"
        />
      )}
    </motion.div>
  );
};

export default BaseNode;

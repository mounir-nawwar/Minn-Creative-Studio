import React, { ReactNode, useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Handle, Position } from 'reactflow';
import { cn, calcHandlePosition } from '../lib/utils';
import { Loader2, AlertCircle, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { HandleDefinition, NODE_HANDLES } from '../types/connection.types';
import { useConnectionContext } from '../contexts/ConnectionContext';
import { checkConnection, ValidationResult } from '../store/connection-validator';

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
    progress?: string | number;
  };
  children: ReactNode;
  inputs?: boolean;
  outputs?: boolean;
  className?: string;
  onRun?: () => void;
  color?: string;
  icon?: React.ElementType | ReactNode;
  customHandles?: ReactNode;
  // Accept nodes as optional prop for React concurrent mode compliance
  nodes?: any[];
}

interface HandleRendererProps {
  handle: HandleDefinition;
  nodeId: string;
  isInput: boolean;
  index: number;
  total: number;
  validation: ValidationResult | undefined;
  onMouseEnter: (handleId: string) => void;
  onMouseLeave: () => void;
  data: any;
}

const HandleRenderer = React.memo(({
  handle,
  nodeId,
  isInput,
  index,
  total,
  validation,
  onMouseEnter,
  onMouseLeave,
  data,
}: HandleRendererProps) => {
  const fullHandleId = `${nodeId}:${handle.id}`;
  const isValidTarget = validation?.valid;
  const isInvalidTarget = validation && !validation.valid;
  
    return (
    <Handle
      key={handle.id}
      id={handle.id}
      type={isInput ? "target" : "source"}
      position={handle.position || (isInput ? Position.Left : Position.Right)}
      className={cn(
        "w-3 h-3 bg-[var(--color-handle-default)] border-2 border-[var(--color-node-bg)] transition-all",
        "hover:bg-[var(--color-handle-hover)] hover:shadow-[var(--shadow-handle-hover)]",
        isValidTarget && "bg-[var(--color-handle-valid)] border-[var(--color-handle-valid)] shadow-[var(--shadow-handle-valid)]",
        isInvalidTarget && "bg-[var(--color-handle-invalid)] border-[var(--color-handle-invalid)] shadow-[var(--shadow-handle-invalid)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--color-handle-focus)]"
      )}
      style={{ 
        top: calcHandlePosition(index, total)
      }}
      onMouseEnter={() => onMouseEnter(handle.id)}
      onMouseLeave={onMouseLeave}
      aria-label={`${handle.label || 'connection'} ${isInput ? 'input' : 'output'} handle for ${data.label} node`}
      role="button"
      tabIndex={-1}
    >
      {handle.label && (
        <div className={cn(
          "absolute top-1/2 -translate-y-1/2 bg-[var(--color-label-bg)] px-1 py-0.5 rounded text-[8px] text-[var(--color-text-primary)] whitespace-nowrap",
          isInput ? "left-4" : "right-4"
        )}>
          {handle.label}
        </div>
      )}
    </Handle>
  );
});

const BaseNode: React.FC<BaseNodeProps> = ({ 
  id, 
  data, 
  children, 
  inputs = true, 
  outputs = true,
  className,
  onRun,
  nodes
}) => {
  const deleteNode = useStore((state) => state.deleteNode);
  const { isConnecting, currentConnection, hoveredHandle, setHoveredHandle } = useConnectionContext();
  const [screenReaderMessage, setScreenReaderMessage] = useState<string>('');
  const [focusedElement, setFocusedElement] = useState<string>('');
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  
  // Use prop nodes if provided, otherwise use hook for concurrent mode compliance
  const storeNodes = useStore(state => state.nodes);

  // Get handle definitions from data or NODE_HANDLES
  const nodeType = data.type || '';
  const handleDefinitions = NODE_HANDLES[nodeType] || NODE_HANDLES.default;
  
  const inputHandleDefs = data.inputHandles || handleDefinitions.inputs;
  const outputHandleDefs = data.outputHandles || handleDefinitions.outputs;

  // Check if this handle should show validation feedback
  const isHandleHovered = (handleId: string, type: 'source' | 'target') => {
    if (!isConnecting || !currentConnection) return false;
    
    const fullHandleId = `${id}:${handleId}`;
    return hoveredHandle === fullHandleId;
  };

  const getHandleValidation = (handleId: string, type: 'source' | 'target'): ValidationResult | null => {
    if (!isConnecting || !currentConnection || !currentConnection.source) return null;
    
    // Create a proper Connection object for validation
    const testConnection: Connection = {
      source: type === 'source' ? currentConnection.source : id,
      target: type === 'source' ? id : currentConnection.source!,
      sourceHandle: type === 'source' ? currentConnection.sourceHandle : handleId,
      targetHandle: type === 'source' ? handleId : currentConnection.targetHandle,
    };
    
    // Use prop nodes if available, fallback to store nodes for concurrent mode compliance
    const nodesToUse = nodes || storeNodes;
    return checkConnection(testConnection, nodesToUse);
  };

  // Handle triggerRun from Toolbar
  useEffect(() => {
    if (data.triggerRun && onRun) {
      onRun();
      announceToScreenReader(`Running ${data.label} node`);
    }
  }, [data.triggerRun]);

  // Screen reader announcement helper
  const announceToScreenReader = (message: string) => {
    setScreenReaderMessage(message);
    // Clear message after announcement to avoid repetition
    setTimeout(() => setScreenReaderMessage(''), 1000);
  };

  // Memoized event handlers (Step 1)
  const handleHandleMouseEnter = useCallback((handleId: string) => {
    if (isConnecting) setHoveredHandle(`${id}:${handleId}`);
  }, [isConnecting, setHoveredHandle, id]);

  const handleHandleMouseLeave = useCallback(() => {
    setHoveredHandle(null);
  }, [setHoveredHandle]);

  const handleDelete = useCallback((e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (window.confirm(`Delete ${data.label} node?`)) {
      deleteNode(id);
    }
  }, [deleteNode, id, data.label]);

  // Memoized keyboard handler
  const handleDeleteKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleDelete(e);
    }
  }, [handleDelete]);

  // Handle focus management
  const handleFocus = (element: string) => {
    setFocusedElement(element);
  };

  const handleBlur = () => {
    setFocusedElement('');
  };

  // Generate connection status message
  const getConnectionStatusMessage = () => {
    if (isConnecting && currentConnection) {
      const sourceNode = (nodes || storeNodes).find((n: any) => n.id === currentConnection.source);
      if (sourceNode) {
        return `Connecting from ${sourceNode.data.label} to ${data.label} node. Hover over handles to check valid connections.`;
      }
    }
    return `${data.label} node. Ready for connections.`;
  };

  // Memoized validation results (Step 2)
  const handleValidation = useMemo(() => {
    if (!isConnecting || !currentConnection) return new Map<string, ValidationResult>();
    
    const validations = new Map<string, ValidationResult>();
    inputHandleDefs.forEach(handle => {
      const validation = getHandleValidation(handle.id, 'target');
      if (validation) {
        validations.set(handle.id, validation);
      }
    });
    return validations;
  }, [isConnecting, currentConnection, inputHandleDefs, id]);

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn(
        "w-[320px] bg-[var(--color-node-bg)] border border-[var(--color-node-border)] rounded-xl overflow-hidden shadow-2xl transition-all duration-300 focus-within:ring-2 focus-within:ring-[var(--color-handle-focus)] focus-within:border-[var(--color-handle-focus)]",
        data.isRunning && "border-[var(--color-node-loading)] shadow-[var(--shadow-node-loading)]",
        data.error && "border-[var(--color-node-error)] shadow-[var(--shadow-node-error)]",
        className
      )}
      role="group"
      aria-label={`${data.label} node`}
    >
      {/* Input Handles - using memoized renderer */}
      {inputs && inputHandleDefs.map((handle, index) => (
        <HandleRenderer
          key={handle.id}
          handle={handle}
          nodeId={id}
          isInput={true}
          index={index}
          total={inputHandleDefs.length}
          validation={handleValidation.get(handle.id)}
          onMouseEnter={handleHandleMouseEnter}
          onMouseLeave={handleHandleMouseLeave}
          data={data}
        />
      ))}
      
      <div className="px-4 py-2 bg-[var(--color-header-bg)] flex items-center justify-between group/header relative overflow-hidden">
        {data.isRunning && (
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${data.progress || 0}%` }}
            className="absolute bottom-0 left-0 h-[2px] bg-[var(--color-progress-bar)] shadow-[var(--shadow-progress-glow)]"
          />
        )}
        <span className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider z-10 focus:outline-none" tabIndex={0}>
          {data.label}
        </span>
        <div className="flex items-center gap-2 z-10">
          {data.isRunning && (
            <div className="flex items-center gap-2">
              <span className="text-[8px] font-bold text-[var(--color-node-loading)] animate-pulse">
                {data.progress || 0}%
              </span>
              <Loader2 className="w-4 h-4 text-[var(--color-node-loading)] animate-spin" aria-label="Node is running" />
            </div>
          )}
          {data.error && (
            <AlertCircle 
              className="w-4 h-4 text-[var(--color-text-error)]" 
              aria-label={`Error: ${data.error}`}
              role="img"
            />
          )}
          <button 
            ref={deleteButtonRef}
            onClick={handleDelete}
            onKeyDown={handleDeleteKeyDown}
            tabIndex={0}
            aria-label={`Delete ${data.label} node. Press Enter or Space to delete.`}
            role="button"
            className={cn(
              "opacity-0 group-hover/header:opacity-100 p-1 hover:bg-[var(--color-button-secondary-hover)] rounded transition-all",
              "focus:outline-none focus:ring-2 focus:ring-[var(--color-handle-focus)] focus:opacity-100",
              focusedElement === 'delete' && "ring-2 ring-[var(--color-handle-focus)] opacity-100"
            )}
            onFocus={() => handleFocus('delete')}
            onBlur={handleBlur}
          >
            <X className="w-3 h-3 text-[var(--color-text-secondary)] hover:text-[var(--color-delete-hover)]" aria-hidden="true" />
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
            className="px-4 py-2 bg-[var(--color-error-bg)] border-t border-[var(--color-error-border)]"
            role="alert"
            aria-live="assertive"
          >
            <p className="text-[10px] text-[var(--color-text-error)] leading-tight">
              Error: {data.error}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Output Handles - using memoized renderer */}
      {outputs && outputHandleDefs.map((handle, index) => (
        <HandleRenderer
          key={handle.id}
          handle={handle}
          nodeId={id}
          isInput={false}
          index={index}
          total={outputHandleDefs.length}
          validation={undefined}
          onMouseEnter={handleHandleMouseEnter}
          onMouseLeave={handleHandleMouseLeave}
          data={data}
        />
      ))}

      {/* Screen reader announcements */}
      <div 
        className="sr-only" 
        role="status" 
        aria-live="polite"
        aria-atomic="true"
      >
        {screenReaderMessage || getConnectionStatusMessage()}
      </div>

      {/* Hidden connection validation info for screen readers */}
      {isConnecting && currentConnection && (
        <div className="sr-only" role="log" aria-live="polite">
          Dragging connection. Current node: {data.label}. 
          {hoveredHandle ? ` Hovering over handle: ${hoveredHandle.split(':')[1]}.` : ' Hover over a handle to check connection validity.'}
        </div>
      )}
    </motion.div>
  );
};

export default React.memo(BaseNode, (prev, next) => {
  // Custom equality check to prevent unnecessary re-renders
  return prev.id === next.id && 
         prev.data.isRunning === next.data.isRunning &&
         prev.data.error === next.data.error &&
         prev.data.progress === next.data.progress;
});

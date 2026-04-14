import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { Connection } from 'reactflow';
import { useStore } from '../store/useStore';
import { checkConnection } from '../store/connection-validator';
import { perfMonitor } from '../services/performance';

export interface SourceInfo {
  nodeId: string;
  handleId: string;
  handleType: 'source' | 'target';
}

interface HoveredTargetInfo {
  nodeId: string;
  handleId: string;
  validation: { valid: boolean; message: string } | null;
}

interface ConnectionContextType {
  isConnecting: boolean;
  sourceInfo: SourceInfo | null;
  hoveredTargetInfo: HoveredTargetInfo | null;
  connectionValidation: { valid: boolean; message: string } | null;
  startConnection: (sourceInfo: SourceInfo) => void;
  setHoveredTarget: (hoveredInfo: HoveredTargetInfo | null) => void;
  endConnection: () => void;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnecting: false,
  sourceInfo: null,
  hoveredTargetInfo: null,
  connectionValidation: null,
  startConnection: () => {},
  setHoveredTarget: () => {},
  endConnection: () => {},
});

export const useConnectionContext = () => useContext(ConnectionContext);

interface ConnectionProviderProps {
  children: ReactNode;
}

export const ConnectionProvider: React.FC<ConnectionProviderProps> = ({ children }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [sourceInfo, setSourceInfo] = useState<SourceInfo | null>(null);
  const [hoveredTargetInfo, setHoveredTargetInfoState] = useState<HoveredTargetInfo | null>(null);
  const [connectionValidation, setConnectionValidation] = useState<{ valid: boolean; message: string } | null>(null);
  
  const nodes = useStore((state) => state.nodes);

  const startConnection = useCallback((newSourceInfo: SourceInfo) => {
    setIsConnecting(true);
    setSourceInfo(newSourceInfo);
    setHoveredTargetInfoState(null);
    setConnectionValidation(null);
  }, []);

  const setHoveredTarget = useCallback((hoveredInfo: HoveredTargetInfo | null) => {
    setHoveredTargetInfoState(hoveredInfo);
    
    // Validate the connection when hovering over a target
    if (hoveredInfo && sourceInfo) {
      const connection: Connection = {
        source: sourceInfo.nodeId,
        sourceHandle: sourceInfo.handleId,
        target: hoveredInfo.nodeId,
        targetHandle: hoveredInfo.handleId,
      };
      
      const validation = perfMonitor.measureValidation(() => 
        checkConnection(connection, nodes),
        'connection-validation'
      );
      setConnectionValidation(validation);
    } else {
      setConnectionValidation(null);
    }
  }, [sourceInfo, nodes]);

  const endConnection = useCallback(() => {
    setIsConnecting(false);
    setSourceInfo(null);
    setHoveredTargetInfoState(null);
    setConnectionValidation(null);
  }, []);

  const value = useMemo(() => ({
    isConnecting,
    sourceInfo,
    hoveredTargetInfo,
    connectionValidation,
    startConnection,
    setHoveredTarget,
    endConnection,
  }), [
    isConnecting,
    sourceInfo,
    hoveredTargetInfo,
    connectionValidation,
    startConnection,
    setHoveredTarget,
    endConnection,
  ]);

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};

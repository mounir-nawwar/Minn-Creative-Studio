import React, { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react';
import { Connection } from 'reactflow';
import { useStore } from '../store/useStore';
import { checkConnection } from '../store/connection-validator';
import { perfMonitor } from '../services/performance';

interface ConnectionContextType {
  isConnecting: boolean;
  currentConnection: Partial<Connection> | null;
  hoveredHandle: string | null;
  connectionValidation: { valid: boolean; message: string } | null;
  startConnection: (connection: Partial<Connection>) => void;
  updateConnection: (connection: Partial<Connection>) => void;
  endConnection: () => void;
  setHoveredHandle: (handleId: string | null) => void;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnecting: false,
  currentConnection: null,
  hoveredHandle: null,
  connectionValidation: null,
  startConnection: () => {},
  updateConnection: () => {},
  endConnection: () => {},
  setHoveredHandle: () => {},
});

export const useConnectionContext = () => useContext(ConnectionContext);

interface ConnectionProviderProps {
  children: ReactNode;
}

export const ConnectionProvider: React.FC<ConnectionProviderProps> = ({ children }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentConnection, setCurrentConnection] = useState<Partial<Connection> | null>(null);
  const [hoveredHandle, setHoveredHandleState] = useState<string | null>(null);
  const [connectionValidation, setConnectionValidation] = useState<{ valid: boolean; message: string } | null>(null);
  
  const nodes = useStore((state) => state.nodes);

  const startConnection = useCallback((connection: Partial<Connection>) => {
    setIsConnecting(true);
    setCurrentConnection(connection);
    setConnectionValidation(null);
    setHoveredHandle(null);
  }, []);

  const updateConnection = useCallback((connection: Partial<Connection>) => {
    setCurrentConnection(connection);
    
    // Validate current connection attempt with performance measurement
    if (connection.source && connection.target) {
      const validation = perfMonitor.measureValidation(() => 
        checkConnection(
          connection as Connection, 
          nodes
        ),
        'connection-validation'
      );
      setConnectionValidation(
        { valid: validation.valid, message: validation.message }
      );
    }
  }, [nodes]);

  const endConnection = useCallback(() => {
    setIsConnecting(false);
    setCurrentConnection(null);
    setHoveredHandleState(null);
    setConnectionValidation(null);
  }, []);

  const setHoveredHandle = useCallback((handleId: string | null) => {
    setHoveredHandleState(handleId);
  }, []);

  const value = useMemo(() => ({
    isConnecting,
    currentConnection,
    hoveredHandle,
    connectionValidation,
    startConnection,
    updateConnection,
    endConnection,
    setHoveredHandle,
  }), [
    isConnecting,
    currentConnection,
    hoveredHandle,
    connectionValidation,
    startConnection,
    updateConnection,
    endConnection,
    setHoveredHandle,
  ]);

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};

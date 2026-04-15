import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99998]"
        >
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full backdrop-blur-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(255, 69, 58, 0.15), rgba(255, 69, 58, 0.08))',
              border: '1px solid rgba(255, 69, 58, 0.3)',
              boxShadow: '0 8px 32px rgba(255, 69, 58, 0.15), 0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <WifiOff className="w-4 h-4" style={{ color: '#FF453A' }} />
            <span
              className="text-[12px] font-medium text-white/90"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}
            >
              You're offline
            </span>
          </div>
        </motion.div>
      )}

      {showReconnected && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99998]"
        >
          <div
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-full backdrop-blur-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(52, 199, 89, 0.15), rgba(52, 199, 89, 0.08))',
              border: '1px solid rgba(52, 199, 89, 0.3)',
              boxShadow: '0 8px 32px rgba(52, 199, 89, 0.15), 0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <Wifi className="w-4 h-4" style={{ color: '#34C759' }} />
            <span
              className="text-[12px] font-medium text-white/90"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}
            >
              Back online
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineIndicator;

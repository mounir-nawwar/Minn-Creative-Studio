import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { useToastStore, ToastType } from '../store/useToastStore';

const iconMap: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle className="w-[18px] h-[18px]" />,
  error: <XCircle className="w-[18px] h-[18px]" />,
  warning: <AlertCircle className="w-[18px] h-[18px]" />,
  info: <Info className="w-[18px] h-[18px]" />,
};

const colorMap: Record<ToastType, { bg: string; border: string; icon: string; glow: string }> = {
  success: {
    bg: 'rgba(52, 199, 89, 0.12)',
    border: 'rgba(52, 199, 89, 0.25)',
    icon: '#34C759',
    glow: '0 0 40px rgba(52, 199, 89, 0.15)',
  },
  error: {
    bg: 'rgba(255, 69, 58, 0.12)',
    border: 'rgba(255, 69, 58, 0.25)',
    icon: '#FF453A',
    glow: '0 0 40px rgba(255, 69, 58, 0.15)',
  },
  warning: {
    bg: 'rgba(255, 159, 10, 0.12)',
    border: 'rgba(255, 159, 10, 0.25)',
    icon: '#FF9F0A',
    glow: '0 0 40px rgba(255, 159, 10, 0.15)',
  },
  info: {
    bg: 'rgba(0, 122, 255, 0.12)',
    border: 'rgba(0, 122, 255, 0.25)',
    icon: '#007AFF',
    glow: '0 0 40px rgba(0, 122, 255, 0.15)',
  },
};

const ToastItem: React.FC<{
  toast: {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    action?: { label: string; onClick: () => void };
  };
  onRemove: (id: string) => void;
}> = ({ toast, onRemove }) => {
  const [isLeaving, setIsLeaving] = useState(false);
  const colors = colorMap[toast.type];

  const handleRemove = () => {
    setIsLeaving(true);
    setTimeout(() => onRemove(toast.id), 200);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: isLeaving ? 0 : 1, y: isLeaving ? -10 : 0, scale: isLeaving ? 0.95 : 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ 
        type: 'spring', 
        stiffness: 500, 
        damping: 30,
        opacity: { duration: 0.2 }
      }}
      className="relative"
      style={{ zIndex: 9999 }}
    >
      <div
        className="flex items-start gap-3 px-4 py-3.5 rounded-2xl min-w-[320px] max-w-[420px] backdrop-blur-2xl"
        style={{
          background: `linear-gradient(135deg, ${colors.bg}, rgba(255,255,255,0.03))`,
          border: `1px solid ${colors.border}`,
          boxShadow: `
            ${colors.glow},
            0 8px 32px rgba(0,0,0,0.12),
            0 2px 8px rgba(0,0,0,0.08),
            inset 0 1px 0 rgba(255,255,255,0.05)
          `,
        }}
      >
        <div 
          className="flex-shrink-0 mt-0.5 p-1.5 rounded-xl"
          style={{ 
            background: `linear-gradient(135deg, ${colors.icon}20, ${colors.icon}10)`,
            color: colors.icon,
          }}
        >
          {iconMap[toast.type]}
        </div>
        
        <div className="flex-1 min-w-0 pt-0.5">
          <p 
            className="text-[13px] font-semibold text-white/95 tracking-tight"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif' }}
          >
            {toast.title}
          </p>
          {toast.message && (
            <p 
              className="text-[12px] text-white/50 mt-1 leading-relaxed"
              style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif' }}
            >
              {toast.message}
            </p>
          )}
          {toast.action && (
            <button
              onClick={toast.action.onClick}
              className="text-[12px] font-medium mt-2.5 px-3 py-1.5 rounded-lg transition-all"
              style={{ 
                color: colors.icon,
                background: `${colors.icon}15`,
                fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
        
        <button
          onClick={handleRemove}
          className="flex-shrink-0 p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all mt-0.5"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
};

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  return (
    <div 
      className="fixed top-6 left-1/2 -translate-x-1/2 flex flex-col gap-3 pointer-events-none"
      style={{ zIndex: 99999 }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;

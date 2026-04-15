import React from 'react';
import { motion } from 'motion/react';
import { Maximize2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface ExpandableAssetWrapperProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  type?: 'image' | 'video' | 'audio';
}

/**
 * Apple-inspired expand wrapper with subtle hover effects
 * Provides consistent visual feedback across all nodes
 */
export const ExpandableAssetWrapper: React.FC<ExpandableAssetWrapperProps> = ({ 
  children, 
  onClick, 
  className,
  type = 'image'
}) => {
  return (
    <motion.div
      className={cn(
        "relative group cursor-pointer overflow-hidden",
        "border border-[#2a2a2a] rounded-xl",
        "bg-[#0a0a0a]",
        "hover:border-[#0097A7]/50",
        "transition-all duration-300",
        className
      )}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Expand Icon */}
      <motion.div 
        className="absolute top-3 right-3 p-2 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-all duration-300"
        initial={{ scale: 0.8 }}
        whileHover={{ scale: 1.1 }}
      >
        <Maximize2 className="w-4 h-4 text-white" />
      </motion.div>
      
      {/* Click Indicator */}
      <motion.div 
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div 
          className="w-20 h-20 bg-[#0097A7]/20 backdrop-blur-sm rounded-full flex items-center justify-center"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          whileHover={{ scale: 1.2 }}
        >
          <Maximize2 className="w-8 h-8 text-[#0097A7]" />
        </motion.div>
      </motion.div>
      
      {/* Subtle Glow Effect */}
      <div className="absolute inset-0 bg-[#0097A7]/0 group-hover:bg-[#0097A7]/5 transition-colors duration-300 pointer-events-none" />
    </motion.div>
  );
};

export const ExpandableGridWrapper: React.FC<ExpandableAssetWrapperProps> = ({
  children,
  onClick,
  className,
  type = 'image'
}) => {
  return (
    <motion.div
      className={cn(
        "relative group cursor-pointer overflow-hidden",
        "border border-white/5 rounded-2xl",
        "bg-[#111111]",
        "hover:border-[#0097A7]/30",
        "transition-all duration-300",
        className
      )}
      onClick={onClick}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {children}
      
      {/* Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Expand Icon */}
      <motion.div 
        className="absolute top-3 right-3 p-1.5 bg-black/60 backdrop-blur-sm rounded-lg border border-white/10 opacity-0 group-hover:opacity-100"
        initial={{ scale: 0.8 }}
        whileHover={{ scale: 1.1 }}
      >
        <Maximize2 className="w-3.5 h-3.5 text-white" />
      </motion.div>
      
      {/* Subtle Glow Effect */}
      <div className="absolute inset-0 bg-[#0097A7]/0 group-hover:bg-[#0097A7]/5 transition-colors duration-300 pointer-events-none" />
    </motion.div>
  );
};

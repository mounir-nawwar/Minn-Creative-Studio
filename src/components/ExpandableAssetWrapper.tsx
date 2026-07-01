import React from 'react';
import { Maximize2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface ExpandableAssetWrapperProps {
  children: React.ReactNode;
  onClick: () => void;
  className?: string;
  type?: 'image' | 'video' | 'audio';
}

/**
 * Consistent expand affordance across nodes. Hover reveals a subtle
 * darkening + expand icon — no scale/grow, calm ring on hover.
 */
export const ExpandableAssetWrapper: React.FC<ExpandableAssetWrapperProps> = ({ children, onClick, className }) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl bg-[#0a0a0a] ring-1 ring-white/10',
        'transition-[transform,box-shadow] duration-150 hover:ring-[#0097A7]/50 active:scale-[0.98]',
        className,
      )}
    >
      {children}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      <div className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 ring-1 ring-white/10 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100">
        <Maximize2 className="h-3.5 w-3.5 text-white" />
      </div>
    </div>
  );
};

export const ExpandableGridWrapper: React.FC<ExpandableAssetWrapperProps> = ({ children, onClick, className }) => {
  return (
    <div
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-xl bg-[#111111] ring-1 ring-white/10',
        'transition-[transform,box-shadow] duration-150 hover:ring-[#0097A7]/40 active:scale-[0.98]',
        className,
      )}
    >
      {children}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      <div className="pointer-events-none absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 ring-1 ring-white/10 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100">
        <Maximize2 className="h-3 w-3 text-white" />
      </div>
    </div>
  );
};

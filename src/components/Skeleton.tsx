import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`animate-pulse bg-[#2a2a2a] rounded ${className}`} />
);

export const WorkflowSkeleton: React.FC = () => (
  <div className="space-y-2">
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-20 w-full rounded-lg" />
  </div>
);

export const ProjectSkeleton: React.FC = () => (
  <div className="bg-[#111111] border border-white/5 rounded-2xl p-4">
    <div className="flex gap-3">
      <Skeleton className="w-16 h-16 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  </div>
);

export const AssetGridSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <div className="grid grid-cols-2 gap-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="aspect-square rounded-lg overflow-hidden bg-[#111111]">
        <Skeleton className="w-full h-full" />
      </div>
    ))}
  </div>
);

export const NodeSkeleton: React.FC = () => (
  <div className="bg-[#0a0a0a] border border-white/5 rounded-xl p-3 min-w-[200px]">
    <div className="space-y-2">
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-8 w-full rounded-lg" />
    </div>
  </div>
);

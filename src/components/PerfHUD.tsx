import React, { useEffect, useState } from 'react';
import { perfMonitor, PerformanceSnapshot } from '../services/performance';

interface PerfHUDProps {
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  refreshRate?: number; // in milliseconds
  showSlowOps?: boolean;
}

export const PerfHUD: React.FC<PerfHUDProps> = ({
  position = 'top-left',
  refreshRate = 1000,
  showSlowOps = false
}) => {
  const [metrics, setMetrics] = useState<PerformanceSnapshot>(() => 
    perfMonitor.getMetrics()
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      const currentMetrics = perfMonitor.getMetrics();
      setMetrics(currentMetrics);
      setLastUpdate(Date.now());
    }, refreshRate);
    
    return () => clearInterval(interval);
  }, [refreshRate]);

  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  const getBudgetStatus = (time: number): 'good' | 'warning' | 'bad' => {
    if (time <= 16) return 'good';
    if (time <= 50) return 'warning';
    return 'bad';
  };

  const getBudgetColor = (status: 'good' | 'warning' | 'bad'): string => {
    switch (status) {
      case 'good': return 'text-green-400';
      case 'warning': return 'text-yellow-400';
      case 'bad': return 'text-red-400';
    }
  }

  return (
    <div
      className={`fixed ${positionClasses[position]} bg-black/80 backdrop-blur-sm text-white rounded-lg p-3 text-xs font-mono z-50 border border-white/10 shadow-2xl`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-glow" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-300">Performance Monitor</span>
        </div>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-[11px] text-gray-400 hover:text-white transition-colors px-1 py-0.5 rounded hover:bg-white/10"
          title={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Validation Avg:</span>
          <span className={`font-semibold ${getBudgetColor(getBudgetStatus(metrics.averageValidationTime))}`}>
            {metrics.averageValidationTime.toFixed(2)}ms
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Cache Hit:</span>
          <span className="font-semibold">
            {(metrics.cacheHitRate * 100).toFixed(0)}%
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Renders:</span>
          <span className="font-semibold">
            {metrics.renderCount}
          </span>
        </div>

        {isExpanded && (
          <>
            <div className="h-px bg-white/10 my-2" />
            
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Total Ops:</span>
              <span className="font-semibold">
                {metrics.totalOperations}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Min Time:</span>
              <span className="text-green-400 font-semibold">
                {metrics.minValidationTime === Infinity ? 'N/A' : `${metrics.minValidationTime.toFixed(2)}ms`}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Max Time:</span>
              <span className={`font-semibold ${getBudgetColor(getBudgetStatus(metrics.maxValidationTime))}`}>
                {metrics.maxValidationTime.toFixed(2)}ms
              </span>
            </div>

            {showSlowOps && metrics.slowOperations.length > 0 && (
              <>
                <div className="h-px bg-white/10 my-2" />
                <div className="text-[10px]">
                  <div className="text-gray-400 mb-1 font-bold uppercase tracking-wider">Slow Operations</div>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {metrics.slowOperations.slice(-5).map((op, idx) => (
                      <div key={idx} className="text-red-400">
                        • {op.name}: {op.duration.toFixed(2)}ms
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="text-[9px] text-gray-500 mt-2">
        Last update: {new Date(lastUpdate).toLocaleTimeString()}
      </div>
    </div>
  );
};

export default PerfHUD;

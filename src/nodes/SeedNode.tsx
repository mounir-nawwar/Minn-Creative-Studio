import React, { useState, useEffect, useCallback } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { RefreshCw, Lock, Unlock } from 'lucide-react';
import { NodeField, NodeLabel, NodeInput, NodeToggle, RunButton } from './ui';

interface SeedNodeProps {
  id: string;
  data: {
    label: string;
    config?: {
      seed?: number;
      isLocked?: boolean;
      isRandom?: boolean;
    };
  };
}

const SeedNode: React.FC<SeedNodeProps> = ({ id, data }) => {
  const [seed, setSeed] = useState<number>(data.config?.seed ?? Math.floor(Math.random() * 1000000));
  const [isLocked, setIsLocked] = useState<boolean>(data.config?.isLocked ?? false);
  const [isRandom, setIsRandom] = useState<boolean>(data.config?.isRandom ?? false);
  const updateNodeData = useStore((state) => state.updateNodeData);

  // Deep comparison helper to prevent unnecessary updates
  const configsAreEqual = useCallback((a: any, b: any): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.seed === b.seed && a.isLocked === b.isLocked && a.isRandom === b.isRandom;
  }, []);

  // Sync local state with prop changes
  useEffect(() => {
    setSeed(prevSeed => {
      const newSeed = data.config?.seed ?? Math.floor(Math.random() * 1000000);
      return prevSeed !== newSeed ? newSeed : prevSeed;
    });
    
    setIsLocked(prevLocked => {
      const newLocked = data.config?.isLocked ?? false;
      return prevLocked !== newLocked ? newLocked : prevLocked;
    });
    
    setIsRandom(prevRandom => {
      const newRandom = data.config?.isRandom ?? false;
      return prevRandom !== newRandom ? newRandom : prevRandom;
    });
  }, [data.config, configsAreEqual]);

  const handleRun = useCallback(() => {
    const finalSeed = isRandom ? Math.floor(Math.random() * 1000000) : seed;
    updateNodeData(id, { output: finalSeed, isRunning: false });
  }, [id, isRandom, seed, updateNodeData]);

  const randomize = useCallback(() => {
    if (isLocked) return;
    const newSeed = Math.floor(Math.random() * 1000000);
    setSeed(newSeed);
    
    // Guard against infinite loops - only update if value actually changed
    if (data.config?.seed !== newSeed) {
      updateNodeData(id, { config: { ...data.config, seed: newSeed } });
    }
  }, [id, isLocked, data.config, updateNodeData]);

  const handleRandomToggle = useCallback(() => {
    const newRandom = !isRandom;
    setIsRandom(newRandom);
    
    // Guard against infinite loops
    if (data.config?.isRandom !== newRandom) {
      updateNodeData(id, { config: { ...data.config, isRandom: newRandom } });
    }
  }, [id, isRandom, data.config, updateNodeData]);

  const handleSeedChange = useCallback((newSeed: number) => {
    setSeed(newSeed);
    
    // Guard against infinite loops
    if (data.config?.seed !== newSeed) {
      updateNodeData(id, { config: { ...data.config, seed: newSeed } });
    }
  }, [id, data.config, updateNodeData]);

  const handleLockToggle = useCallback(() => {
    const newLocked = !isLocked;
    setIsLocked(newLocked);
    
    // Guard against infinite loops
    if (data.config?.isLocked !== newLocked) {
      updateNodeData(id, { config: { ...data.config, isLocked: newLocked } });
    }
  }, [id, isLocked, data.config, updateNodeData]);

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <NodeLabel>Random</NodeLabel>
          <NodeToggle on={isRandom} onClick={handleRandomToggle} />
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <NodeField label="Seed value">
              <NodeInput
                type="number"
                value={seed}
                disabled={isLocked || isRandom}
                onChange={(e) => handleSeedChange(Number(e.target.value))}
                className="disabled:opacity-50"
              />
            </NodeField>
          </div>
          <div className="flex flex-col gap-1">
            <button
              onClick={randomize}
              disabled={isLocked || isRandom}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-gray-500 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:text-[#0097A7] active:scale-[0.96] disabled:opacity-50"
              title="Randomize"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={handleLockToggle}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ring-1 transition-[transform,color,background-color] duration-150 active:scale-[0.96] ${isLocked ? 'bg-red-500/10 text-red-400 ring-red-500/40' : 'bg-white/[0.04] text-gray-500 ring-white/10'}`}
              title={isLocked ? 'Locked' : 'Unlocked'}
            >
              {isLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <RunButton onClick={handleRun}>Set seed</RunButton>

        <p className="text-center text-[11px] text-gray-500">
          Output: <span className="font-medium tabular-nums text-[#0097A7]">{isRandom ? 'Random' : seed}</span>
        </p>
      </div>
    </BaseNode>
  );
};

export default React.memo(SeedNode);
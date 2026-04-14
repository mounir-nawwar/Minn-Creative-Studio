import React, { useState, useEffect, useCallback } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { RefreshCw, Lock, Unlock } from 'lucide-react';

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
          <label className="text-[10px] text-gray-500 uppercase font-bold">Random Toggle</label>
          <button 
            onClick={handleRandomToggle}
            className={`w-8 h-4 rounded-full transition-all relative ${isRandom ? 'bg-[#2196F3]' : 'bg-[#1a1a1a]'}`}
          >
            <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${isRandom ? 'left-4.5' : 'left-0.5'}`} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Seed Value</label>
            <input 
              type="number" value={seed}
              disabled={isLocked || isRandom}
              onChange={(e) => handleSeedChange(Number(e.target.value))}
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-xs text-gray-300 focus:outline-none disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col gap-1 mt-4">
            <button 
              onClick={randomize}
              disabled={isLocked || isRandom}
              className="p-1.5 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2a2a2a] rounded-lg text-gray-500 hover:text-[#2196F3] transition-all disabled:opacity-50"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
            <button 
              onClick={handleLockToggle}
              className={`p-1.5 border rounded-lg transition-all ${isLocked ? 'bg-red-500/10 border-red-500/50 text-red-500' : 'bg-[#1a1a1a] border-[#2a2a2a] text-gray-500'}`}
            >
              {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
            </button>
          </div>
        </div>

        <button
          onClick={handleRun}
          className="w-full py-2 bg-[#2196F3] hover:bg-[#1976D2] text-white rounded-lg text-xs font-bold transition-colors"
        >
          SET SEED
        </button>

        <div className="mt-2 text-center">
          <p className="text-[10px] text-gray-500 uppercase font-bold">Output: <span className="text-[#2196F3]">{isRandom ? "RANDOM" : seed}</span></p>
        </div>
      </div>
    </BaseNode>
  );
};

export default React.memo(SeedNode);
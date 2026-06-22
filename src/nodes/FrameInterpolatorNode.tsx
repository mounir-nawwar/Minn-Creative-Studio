import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Zap, Loader2, Video } from 'lucide-react';
import { API_BASE } from '../constants';
import { authHeader } from '../lib/api';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';

const FrameInterpolatorNode = ({ id, data }: any) => {
  const [targetFps, setTargetFps] = useState(data.config?.targetFps || 24);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { setExpandedAsset } = useAssetExpand();

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    let videoUrl = data.config?.videoUrl;

    if (incomingEdge) {
      const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
      videoUrl = sourceNode?.data?.output;
    }

    if (!videoUrl) {
      updateNodeData(id, { error: 'No video input connected', isRunning: false });
      return;
    }

    updateNodeData(id, { isRunning: true, error: null, progress: 10 });

    try {
      const response = await fetch(`${API_BASE}/interpolate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ videoUrl, targetFps })
      });

      if (!response.ok) throw new Error('Interpolation failed');
      const result = await response.json();
      
      updateNodeData(id, { output: result.video, isRunning: false, progress: 100 });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#FF9800" icon={Zap}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Target FPS</label>
          <div className="grid grid-cols-3 gap-2">
            {[24, 30, 60].map((fps) => (
              <button
                key={fps}
                onClick={() => {
                  setTargetFps(fps);
                  updateNodeData(id, { config: { ...data.config, targetFps: fps } });
                }}
                className={`py-1.5 rounded-lg text-xs font-bold transition-all ${targetFps === fps ? 'bg-[#FF9800] text-white' : 'bg-[#1a1a1a] text-gray-500 hover:bg-[#222222]'}`}
              >
                {fps}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#FF9800] hover:bg-[#F57C00] text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2"
        >
          {data.isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          {data.isRunning ? 'INTERPOLATING...' : 'RUN INTERPOLATOR'}
        </button>

        {data.output && (
          <ExpandableAssetWrapper
            onClick={() => setExpandedAsset(data.output, 'video')}
            type="video"
          >
            <video 
              src={data.output} 
              className="w-full h-auto object-contain max-h-48"
              controls
              loop
              autoPlay
              muted
            />
          </ExpandableAssetWrapper>
        )}
      </div>
    </BaseNode>
  );
};

export default FrameInterpolatorNode;

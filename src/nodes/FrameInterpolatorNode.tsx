import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Zap } from 'lucide-react';
import { API_BASE } from '../constants';
import { authHeader } from '../lib/api';
import { useAssetExpand } from '../hooks/useAssetExpand';
import { ExpandableAssetWrapper } from '../components/ExpandableAssetWrapper';
import { NodeLabel, RunButton } from './ui';

const FrameInterpolatorNode = ({ id, data }: any) => {
  const [targetFps, setTargetFps] = useState(data.config?.targetFps || 24);
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { setExpandedAsset } = useAssetExpand();

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find((e) => e.target === id);
    let videoUrl = data.config?.videoUrl;
    if (incomingEdge) videoUrl = state.nodes.find((n) => n.id === incomingEdge.source)?.data?.output;
    if (!videoUrl) { updateNodeData(id, { error: 'No video input connected', isRunning: false }); return; }
    updateNodeData(id, { isRunning: true, error: null, progress: 10 });
    try {
      const response = await fetch(`${API_BASE}/interpolate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ videoUrl, targetFps }),
      });
      if (!response.ok) throw new Error('Interpolation failed');
      const result = await response.json();
      updateNodeData(id, { output: result.video, isRunning: false, progress: 100 });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#0097A7" icon={Zap}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <NodeLabel>Target FPS</NodeLabel>
          <div className="grid grid-cols-3 gap-2">
            {[24, 30, 60].map((fps) => (
              <button
                key={fps}
                onClick={() => { setTargetFps(fps); updateNodeData(id, { config: { ...data.config, targetFps: fps } }); }}
                className={`rounded-lg py-1.5 text-xs font-medium tabular-nums transition-[transform,color,background-color] duration-150 active:scale-[0.98] ${targetFps === fps ? 'bg-[#0097A7] text-white' : 'bg-white/[0.04] text-gray-400 ring-1 ring-white/10 hover:text-white'}`}
              >
                {fps}
              </button>
            ))}
          </div>
        </div>

        <RunButton onClick={handleRun} running={data.isRunning} icon={Zap}>{data.isRunning ? 'Interpolating…' : 'Run interpolator'}</RunButton>

        {data.output && (
          <ExpandableAssetWrapper onClick={() => setExpandedAsset(data.output, 'video')} type="video">
            <video src={data.output} className="h-auto max-h-48 w-full object-contain" controls loop autoPlay muted />
          </ExpandableAssetWrapper>
        )}
      </div>
    </BaseNode>
  );
};

export default FrameInterpolatorNode;

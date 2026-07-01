import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Maximize, Video } from 'lucide-react';
import { API_BASE } from '../constants';
import { authHeader } from '../lib/api';
import { NodeLabel, RunButton } from './ui';

const VideoUpscalerNode = ({ id, data }: any) => {
  const [scale, setScale] = useState(data.config?.scale || '2x');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find((e) => e.target === id);
    let videoUrl = data.config?.videoUrl;
    if (incomingEdge) videoUrl = state.nodes.find((n) => n.id === incomingEdge.source)?.data?.output;
    if (!videoUrl) { updateNodeData(id, { error: 'No video input connected', isRunning: false }); return; }
    updateNodeData(id, { isRunning: true, error: null, progress: 10 });
    try {
      const response = await fetch(`${API_BASE}/upscale/video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({ videoUrl, scale }),
      });
      if (!response.ok) throw new Error('Upscaling failed');
      const result = await response.json();
      updateNodeData(id, { output: result.video, isRunning: false, progress: 100 });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun} color="#0097A7" icon={Video}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <NodeLabel>Scale</NodeLabel>
          <div className="grid grid-cols-2 gap-2">
            {['2x', '4x'].map((s) => (
              <button
                key={s}
                onClick={() => { setScale(s); updateNodeData(id, { config: { ...data.config, scale: s } }); }}
                className={`rounded-lg py-1.5 text-xs font-medium transition-[transform,color,background-color] duration-150 active:scale-[0.98] ${scale === s ? 'bg-[#0097A7] text-white' : 'bg-white/[0.04] text-gray-400 ring-1 ring-white/10 hover:text-white'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <RunButton onClick={handleRun} running={data.isRunning} icon={Maximize}>{data.isRunning ? 'Upscaling…' : 'Run upscaler'}</RunButton>

        {data.output && (
          <div className="overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
            <video src={data.output} className="h-auto max-h-48 w-full object-contain" controls loop autoPlay muted />
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default VideoUpscalerNode;

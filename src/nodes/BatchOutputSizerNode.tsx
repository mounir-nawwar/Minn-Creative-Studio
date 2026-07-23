import React, { useState } from 'react';
import { Layout, Check, Download, ExternalLink, ImageIcon } from 'lucide-react';
import { API_BASE } from '../constants';
import { authHeader } from '../lib/api';
import { downloadFile } from '../lib/utils';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { RunButton } from './ui';

const SIZES = [
  { id: '1:1', label: '1:1 (Instagram Post)' },
  { id: '4:5', label: '4:5 (Instagram Portrait)' },
  { id: '9:16', label: '9:16 (Story / Reel)' },
  { id: '16:9', label: '16:9 (Website Banner)' },
  { id: '1.91:1', label: '1.91:1 (Facebook / LinkedIn)' },
];

const BatchOutputSizerNode = ({ data, id }: any) => {
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['1:1', '4:5', '9:16']);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputs, setOutputs] = useState<any[]>(data.outputs || []);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const toggleSize = (sizeId: string) => {
    setSelectedSizes(prev => 
      prev.includes(sizeId) ? prev.filter(s => s !== sizeId) : [...prev, sizeId]
    );
  };

  const findInputImage = (): string | undefined => {
    const edge = useStore.getState().edges.find(e => e.target === id);
    const sourceNode = useStore.getState().nodes.find(n => n.id === edge?.source);
    return sourceNode?.data?.output || sourceNode?.data?.outputs?.[0] || data.imageUrl || data.config?.imageUrl;
  };

  const inputImage = findInputImage();

  const handleProcess = async () => {
    const imageUrl = findInputImage();
    if (!imageUrl) {
      updateNodeData(id, { error: 'No image input connected. Wire an image into this node first.' });
      return;
    }

    if (selectedSizes.length === 0) {
      updateNodeData(id, { error: 'Select at least one aspect ratio' });
      return;
    }

    setIsProcessing(true);
    updateNodeData(id, { isRunning: true, error: undefined });

    try {
      const response = await fetch(`${API_BASE}/batchsize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeader() },
        body: JSON.stringify({
          imageUrl,
          sizes: selectedSizes
        })
      });
      if (!response.ok) {
        throw new Error(`Batch resize failed (${response.status})`);
      }
      const result = await response.json();
      const images = result.images || [];
      setOutputs(images);
      updateNodeData(id, {
        outputs: images.map((i: any) => i.url),
        output: images[0]?.url,
        isRunning: false,
      });
    } catch (err: any) {
      console.error('Batch Resize Error:', err);
      updateNodeData(id, { error: err.message || 'Resize failed', isRunning: false });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} outputs={true} onRun={handleProcess}>
      <div className="nodrag nowheel space-y-4">
        {/* Input Image Preview */}
        {inputImage ? (
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Input Image</span>
            <div className="relative aspect-video bg-black/60 rounded-lg overflow-hidden border border-white/10">
              <img src={inputImage} alt="Input" className="w-full h-full object-cover" />
            </div>
          </div>
        ) : (
          <div className="p-3 bg-white/[0.02] rounded-lg border border-dashed border-white/10 flex items-center justify-center gap-2 text-gray-500 text-xs text-center">
            <ImageIcon className="w-4 h-4 text-gray-600" />
            <span>Connect an image node to generate social sizes</span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Select Aspect Ratios</label>
          <div className="grid grid-cols-1 gap-1.5">
            {SIZES.map(size => (
              <button
                key={size.id}
                type="button"
                onClick={() => toggleSize(size.id)}
                className={`flex items-center justify-between p-2 rounded-lg text-xs transition-all ${
                  selectedSizes.includes(size.id) 
                    ? 'bg-[#0097A7]/20 text-[#0097A7] ring-1 ring-[#0097A7]/50' 
                    : 'bg-white/[0.03] text-gray-400 ring-1 ring-white/10 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span>{size.label}</span>
                {selectedSizes.includes(size.id) && <Check className="w-3.5 h-3.5 text-[#0097A7]" />}
              </button>
            ))}
          </div>
        </div>

        <RunButton onClick={handleProcess} running={isProcessing} icon={Layout}>
          {isProcessing ? 'Generating Batch...' : 'Generate Batch'}
        </RunButton>

        {outputs.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-white/10">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Resized Variations</label>
            <div className="grid grid-cols-2 gap-2">
              {outputs.map((out, idx) => (
                <div key={idx} className="relative group aspect-square bg-black rounded-lg overflow-hidden border border-white/10">
                  <img src={out.url} alt={out.size} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-xs">
                    <span className="text-[10px] text-white font-bold">{out.size}</span>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => downloadFile(out.url, `batch_${out.size}.png`)} 
                        className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full"
                        title="Download"
                      >
                        <Download className="w-3 h-3 text-white" />
                      </button>
                      <button type="button" onClick={() => window.open(out.url, '_blank')} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full" title="Open full image">
                        <ExternalLink className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default BatchOutputSizerNode;
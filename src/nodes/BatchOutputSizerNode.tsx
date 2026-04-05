import React, { useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Maximize, Layout, Check, Loader2, Download, ExternalLink } from 'lucide-react';
import { API_BASE } from '../constants';
import { downloadFile } from '../lib/utils';

const SIZES = [
  { id: '1:1', label: '1:1 (Instagram Post)', aspect: 1 },
  { id: '4:5', label: '4:5 (Instagram Portrait)', aspect: 0.8 },
  { id: '9:16', label: '9:16 (Story / Reel)', aspect: 0.5625 },
  { id: '16:9', label: '16:9 (Website Banner)', aspect: 1.777 },
  { id: '1.91:1', label: '1.91:1 (Facebook / LinkedIn)', aspect: 1.91 },
  { id: 'custom', label: 'Custom', aspect: 0 }
];

const BatchOutputSizerNode = ({ data, id }: any) => {
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['1:1', '9:16']);
  const [isProcessing, setIsProcessing] = useState(false);
  const [outputs, setOutputs] = useState<any[]>([]);

  const toggleSize = (sizeId: string) => {
    setSelectedSizes(prev => 
      prev.includes(sizeId) ? prev.filter(s => s !== sizeId) : [...prev, sizeId]
    );
  };

  const handleProcess = async () => {
    if (!data.imageUrl) return;
    setIsProcessing(true);
    try {
      const response = await fetch(`${API_BASE}/batchsize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: data.imageUrl,
          sizes: selectedSizes
        })
      });
      const result = await response.json();
      setOutputs(result.images);
    } catch (err) {
      console.error('Batch Resize Error:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden min-w-[320px] shadow-2xl">
      <div className="bg-zinc-900/50 p-3 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Maximize className="w-4 h-4 text-blue-500" />
          <span className="text-xs font-medium text-zinc-200 uppercase tracking-wider">Batch Sizer</span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] text-zinc-500 uppercase tracking-tighter">Select Sizes</label>
          <div className="grid grid-cols-1 gap-1">
            {SIZES.map(size => (
              <button
                key={size.id}
                onClick={() => toggleSize(size.id)}
                className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                  selectedSizes.includes(size.id) 
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                    : 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-zinc-800'
                }`}
              >
                <span>{size.label}</span>
                {selectedSizes.includes(size.id) && <Check className="w-3 h-3" />}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleProcess}
          disabled={isProcessing || !data.imageUrl}
          className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-600 rounded-lg text-white text-xs font-bold uppercase transition-all flex items-center justify-center gap-2"
        >
          {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layout className="w-4 h-4" />}
          {isProcessing ? 'Processing...' : 'Generate Batch'}
        </button>

        {outputs.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-zinc-800">
            <label className="text-[10px] text-zinc-500 uppercase tracking-tighter">Outputs</label>
            <div className="grid grid-cols-2 gap-2">
              {outputs.map((out, idx) => (
                <div key={idx} className="relative group aspect-square bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800">
                  <img src={out.url} alt={out.size} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                    <span className="text-[10px] text-white font-bold">{out.size}</span>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => downloadFile(out.url, `batch_${out.size}.png`)} 
                        className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full"
                      >
                        <Download className="w-3 h-3 text-white" />
                      </button>
                      <button onClick={() => window.open(out.url)} className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full">
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

      <Handle type="target" position={Position.Left} id="imageUrl" style={{ background: '#3b82f6' }} />
    </div>
  );
};

export default BatchOutputSizerNode;

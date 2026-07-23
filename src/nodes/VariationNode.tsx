import React, { useState } from 'react';
import { Sparkles, Sliders, Grid, ImageIcon, Download, ExternalLink } from 'lucide-react';
import { generateVariations } from '../services/geminiService';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { useAssets } from '../hooks/useAssets';
import { downloadFile } from '../lib/utils';
import { RunButton } from './ui';

const VariationNode = ({ data, id }: any) => {
  const [prompt, setPrompt] = useState(data.config?.prompt || data.prompt || '');
  const [count, setCount] = useState(data.config?.count || 4);
  const [strength, setStrength] = useState(data.config?.strength || 0.5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [variations, setVariations] = useState<string[]>(data.outputs || []);

  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject, uploadEnabled } = useProjectStore();
  const { addAsset } = useAssets();

  const findInputImage = (): string | undefined => {
    const edge = useStore.getState().edges.find(e => e.target === id);
    const sourceNode = useStore.getState().nodes.find(n => n.id === edge?.source);
    return sourceNode?.data?.output || sourceNode?.data?.outputs?.[0] || data.imageUrl || data.config?.imageUrl;
  };

  const inputImage = findInputImage();

  const handleGenerate = async () => {
    const imageUrl = findInputImage();
    if (!imageUrl) {
      updateNodeData(id, { error: 'No input image connected. Connect an image node to generate variations.' });
      return;
    }

    setIsGenerating(true);
    updateNodeData(id, { isRunning: true, error: undefined, progress: 10 });

    try {
      const images = await generateVariations({
        imageUrl,
        prompt,
        count,
      });

      setVariations(images);
      updateNodeData(id, {
        outputs: images,
        output: images[0],
        isRunning: false,
        progress: 100
      });

      // Save variations as assets
      images.forEach((url, i) => {
        addAsset({
          name: `Image Variation ${i + 1} - ${new Date().toLocaleTimeString()}`,
          type: 'image',
          url,
          thumbnailUrl: url,
          tags: ['generated', 'image', 'variation']
        });
      });
    } catch (err: any) {
      console.error('Variation Generation Error:', err);
      updateNodeData(id, { error: err.message || 'Failed to generate variations', isRunning: false });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} outputs={true} onRun={handleGenerate}>
      <div className="space-y-4">
        {/* Input Image Preview */}
        {inputImage ? (
          <div className="space-y-1">
            <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Input Reference Image</span>
            <div className="relative aspect-video bg-black/60 rounded-lg overflow-hidden border border-white/10">
              <img src={inputImage} alt="Input" className="w-full h-full object-cover" />
            </div>
          </div>
        ) : (
          <div className="p-3 bg-white/[0.02] rounded-lg border border-dashed border-white/10 flex items-center justify-center gap-2 text-gray-500 text-xs text-center">
            <ImageIcon className="w-4 h-4 text-gray-600" />
            <span>Connect an image node to generate variations</span>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Variation Prompt (Optional)</label>
          <textarea
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              updateNodeData(id, { config: { ...data.config, prompt: e.target.value } });
            }}
            placeholder="Describe the desired changes or style tweak..."
            className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white h-16 focus:outline-none focus:border-[#0097A7]/50 resize-none placeholder:text-gray-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <Grid className="w-3 h-3 text-[#0097A7]" /> Count: {count}
            </label>
            <input
              type="range"
              min="1"
              max="8"
              step="1"
              value={count}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                setCount(val);
                updateNodeData(id, { config: { ...data.config, count: val } });
              }}
              className="w-full accent-[#0097A7]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider flex items-center gap-1">
              <Sliders className="w-3 h-3 text-[#0097A7]" /> Strength: {strength}
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={strength}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setStrength(val);
                updateNodeData(id, { config: { ...data.config, strength: val } });
              }}
              className="w-full accent-[#0097A7]"
            />
          </div>
        </div>

        <RunButton onClick={handleGenerate} running={isGenerating} icon={Sparkles}>
          {isGenerating ? 'Generating Variations...' : 'Generate Variations'}
        </RunButton>

        {variations.length > 0 && (
          <div className="space-y-2 pt-3 border-t border-white/10">
            <label className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Variations</label>
            <div className="grid grid-cols-2 gap-2">
              {variations.map((url, idx) => (
                <div key={idx} className="relative group aspect-square bg-black rounded-lg overflow-hidden border border-white/10">
                  <img src={url} alt={`Variation ${idx + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-xs">
                    <button
                      type="button"
                      onClick={() => downloadFile(url, `variation_${idx + 1}.png`)}
                      className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full"
                      title="Download"
                    >
                      <Download className="w-3 h-3 text-white" />
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(url, '_blank')}
                      className="p-1.5 bg-white/20 hover:bg-white/40 rounded-full"
                      title="Open full image"
                    >
                      <ExternalLink className="w-3 h-3 text-white" />
                    </button>
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

export default VariationNode;
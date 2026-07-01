import React, { useState, useRef } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { Upload } from 'lucide-react';
import { generateText } from '../services/geminiService';
import { NodeLabel, NodeInput, RunButton, NodeOutput } from './ui';

const ImageDescriberNode = ({ id, data }: any) => {
  const [imageUrl, setImageUrl] = useState(data.config?.imageUrl || '');
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject } = useProjectStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setImageUrl(result);
      updateNodeData(id, { config: { ...data.config, imageUrl: result } });
    };
    reader.readAsDataURL(file);
  };

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find((e) => e.target === id);
    let finalImageUrl = imageUrl;
    if (incomingEdge) {
      const input = state.nodes.find((n) => n.id === incomingEdge.source)?.data?.output;
      if (typeof input === 'string' && input.startsWith('data:image')) finalImageUrl = input;
    }
    if (!finalImageUrl) { updateNodeData(id, { error: 'No image input or URL provided' }); return; }
    updateNodeData(id, { isRunning: true, error: undefined });
    try {
      const description = await generateText({
        prompt: 'Describe this image in detail for a creative generation prompt. Focus on lighting, composition, and mood.',
        model: 'gemini-3-flash-preview',
        imageUrls: [finalImageUrl],
        projectId: currentProject?.id,
      });
      updateNodeData(id, { output: description, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        <div className="space-y-1.5">
          <NodeLabel>Image source (URL or upload)</NodeLabel>
          <div className="flex gap-2">
            <NodeInput
              type="text"
              placeholder="Paste image URL…"
              value={imageUrl}
              onChange={(e) => { setImageUrl(e.target.value); updateNodeData(id, { config: { ...data.config, imageUrl: e.target.value } }); }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg bg-white/[0.04] text-gray-400 ring-1 ring-white/10 transition-[transform,color,background-color] duration-150 hover:text-white active:scale-[0.96]"
              title="Upload image"
            >
              <Upload className="h-4 w-4" />
            </button>
          </div>
        </div>

        {(imageUrl || data.output) && (
          <div className="aspect-video overflow-hidden rounded-lg bg-black ring-1 ring-inset ring-white/10">
            <img
              src={imageUrl || data.output}
              alt="Input"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => (e.currentTarget.src = 'https://via.placeholder.com/300x200?text=Invalid+Image+URL')}
            />
          </div>
        )}

        <RunButton onClick={handleRun} running={data.isRunning}>{data.isRunning ? 'Analyzing…' : 'Analyze image'}</RunButton>

        {data.output && typeof data.output === 'string' && !data.output.startsWith('data:image') && (
          <NodeOutput label="Description">
            <p className="italic">"{data.output}"</p>
          </NodeOutput>
        )}
      </div>
    </BaseNode>
  );
};

export default ImageDescriberNode;

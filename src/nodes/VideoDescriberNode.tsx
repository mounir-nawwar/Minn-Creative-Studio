import { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { generateText } from '../services/geminiService';
import { NodeField, NodeSelect, NodeTextArea, RunButton, NodeOutput } from './ui';

const VideoDescriberNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'gemini-3-flash-preview');
  const [prompt, setPrompt] = useState(data.config?.prompt || 'Describe this video in detail, focusing on style, camera movement, and lighting.');
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject } = useProjectStore();

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find((e) => e.target === id);
    if (!incomingEdge) { updateNodeData(id, { error: 'No video input connected' }); return; }
    const videoUrl = state.nodes.find((n) => n.id === incomingEdge.source)?.data?.output;
    if (!videoUrl) { updateNodeData(id, { error: 'Input node has no output video' }); return; }
    updateNodeData(id, { isRunning: true, error: undefined });
    try {
      const text = await generateText({ prompt, model, videoUrls: [videoUrl], projectId: currentProject?.id });
      updateNodeData(id, { output: text, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Model">
          <NodeSelect value={model} onChange={(e) => { setModel(e.target.value); updateNodeData(id, { config: { ...data.config, model: e.target.value } }); }}>
            <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
          </NodeSelect>
        </NodeField>

        <NodeField label="Prompt">
          <NodeTextArea className="h-16" value={prompt} onChange={(e) => { setPrompt(e.target.value); updateNodeData(id, { config: { ...data.config, prompt: e.target.value } }); }} />
        </NodeField>

        <RunButton onClick={handleRun} running={data.isRunning}>{data.isRunning ? 'Analyzing…' : 'Describe video'}</RunButton>

        {data.output && (
          <NodeOutput label="Description">
            <p className="line-clamp-4 max-h-32 overflow-y-auto">"{data.output}"</p>
          </NodeOutput>
        )}
      </div>
    </BaseNode>
  );
};

export default VideoDescriberNode;

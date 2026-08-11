import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { buildProjectContext } from '../lib/projectContext';
import { generateText } from '../services/geminiService';
import { resolveTextModel } from '../lib/models';
import { NodeField, NodeTextArea, RunButton, NodeOutput } from './ui';

const LLMNode = ({ id, data }: any) => {
  // The studio runs one text model; a saved config from an older graph is
  // coerced to it rather than silently calling a retired model.
  const model = resolveTextModel(data.config?.model);
  const [systemInstruction, setSystemInstruction] = useState(data.config?.systemInstruction || 'You are a helpful creative assistant.');
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject } = useProjectStore();

  const handleRun = async () => {
    const state = useStore.getState();
    const edges = state.edges.filter(e => e.target === id);
    
    // Find text and image inputs
    const textEdge = edges.find(e => {
      const source = state.nodes.find(n => n.id === e.source);
      return source?.data?.type === 'prompt' || source?.data?.type === 'text' || source?.data?.type === 'promptConcatenator' || source?.data?.type === 'promptEnhancer';
    });
    
    const imageEdge = edges.find(e => {
      const source = state.nodes.find(n => n.id === e.source);
      return source?.data?.type === 'imagen' || source?.data?.type === 'nanoBanana' || source?.data?.type === 'vision';
    });

    const textNode = state.nodes.find(n => n.id === textEdge?.source);
    const imageNode = state.nodes.find(n => n.id === imageEdge?.source);

    const promptText = textNode?.data?.output || 'Describe this content';
    const imageUrl = imageNode?.data?.output;

    updateNodeData(id, { isRunning: true, error: undefined });

    const projectContext = buildProjectContext(currentProject) || undefined;

    try {
      const text = await generateText({
        prompt: promptText,
        model,
        systemInstruction,
        imageUrls: imageUrl ? [imageUrl] : [],
        projectContext,
        projectId: currentProject?.id,
      });

      updateNodeData(id, { output: text, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} inputs={true} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="System instruction">
          <NodeTextArea
            className="h-16"
            value={systemInstruction}
            onChange={(e) => {
              setSystemInstruction(e.target.value);
              updateNodeData(id, { config: { ...data.config, systemInstruction: e.target.value } });
            }}
          />
        </NodeField>

        <RunButton onClick={handleRun} running={data.isRunning}>{data.isRunning ? 'Running…' : 'Run LLM'}</RunButton>

        {data.output && (
          <NodeOutput label="Response">
            <p className="line-clamp-4 max-h-32 overflow-y-auto">"{data.output}"</p>
          </NodeOutput>
        )}
      </div>
    </BaseNode>
  );
};

export default React.memo(LLMNode);

import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { buildProjectContext } from '../lib/projectContext';
import { generateText } from '../services/geminiService';
import { NodeField, NodeTextArea, NodeSelect, RunButton, NodeOutput } from './ui';

const LLMNode = ({ id, data }: any) => {
  const [model, setModel] = useState(data.config?.model || 'gemini-3-flash-preview');
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
        <NodeField label="Model">
          <NodeSelect
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              updateNodeData(id, { config: { ...data.config, model: e.target.value } });
            }}
          >
            <option value="gemini-3-flash-preview">Gemini 3 Flash</option>
            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro</option>
          </NodeSelect>
        </NodeField>

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

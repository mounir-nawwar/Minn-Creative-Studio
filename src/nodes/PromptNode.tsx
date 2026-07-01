import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import AskAIButton from '../components/AskAIButton';
import { NodeField, NodeTextArea, RunButton, NodeOutput } from './ui';

const PromptNode = ({ id, data }: any) => {
  const [prompt, setPrompt] = useState(data.config?.prompt || '');
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleAISuggestion = (suggestion: any) => {
    if (suggestion.prompt) {
      setPrompt(suggestion.prompt);
      updateNodeData(id, { output: suggestion.prompt, config: { ...data.config, prompt: suggestion.prompt } });
    }
  };

  const handleRun = () => updateNodeData(id, { output: prompt, isRunning: false });

  return (
    <BaseNode id={id} data={data} inputs={false} onRun={handleRun}>
      <div className="space-y-3">
        <AskAIButton nodeType="Text Prompt" currentConfig={{ prompt }} onSuggestion={handleAISuggestion} label="Ask AI to write" />

        <NodeField label="Prompt text">
          <NodeTextArea
            className="h-32"
            placeholder="Enter your prompt here…"
            value={prompt}
            onChange={(e) => {
              setPrompt(e.target.value);
              updateNodeData(id, { config: { ...data.config, prompt: e.target.value } });
            }}
          />
        </NodeField>

        <RunButton onClick={handleRun}>Set prompt</RunButton>

        {data.output && (
          <NodeOutput label="Current output">
            <p className="line-clamp-3 italic">"{data.output}"</p>
          </NodeOutput>
        )}
      </div>
    </BaseNode>
  );
};

export default React.memo(PromptNode);

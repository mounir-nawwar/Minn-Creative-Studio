import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { useProjectStore } from '../store/useProjectStore';
import { buildProjectContext } from '../lib/projectContext';
import { generateText } from '../services/geminiService';
import { NodeField, NodeSelect, RunButton, NodeOutput } from './ui';

const PromptEnhancerNode = ({ id, data }: any) => {
  const [targetModel, setTargetModel] = useState(data.config?.targetModel || 'imagen');
  const updateNodeData = useStore((state) => state.updateNodeData);
  const { currentProject } = useProjectStore();

  const handleRun = async () => {
    const state = useStore.getState();
    const incomingEdge = state.edges.find(e => e.target === id);
    if (!incomingEdge) {
      updateNodeData(id, { error: "No prompt input connected" });
      return;
    }

    const sourceNode = state.nodes.find(n => n.id === incomingEdge.source);
    const prompt = sourceNode?.data?.output;

    if (!prompt) {
      updateNodeData(id, { error: "Input node has no output prompt" });
      return;
    }

    updateNodeData(id, { isRunning: true, error: undefined });

    const projectContext = buildProjectContext(currentProject) || undefined;

    try {
      const systemInstruction = `You are a creative director and prompt engineer. 
The user gives you a short creative idea. 
Rewrite it into a detailed, technically precise generation prompt 
optimized for ${targetModel}. 
${projectContext ? `Project Context: ${projectContext}` : ''}
For Veo: use cinematic language, describe camera movement, lighting, mood, duration. 
For Imagen: describe composition, style, lighting, color palette, detail level. 
For Nano Banana: describe precision, style consistency, subject detail. 
Never add watermarks, blur, or text overlays to the description. 
Return only the enhanced prompt, nothing else.`;

      const enhancedPrompt = await generateText({
        prompt,
        model: 'gemini-3-flash-preview',
        systemInstruction,
        projectContext,
        projectId: currentProject?.id,
      });

      updateNodeData(id, { output: enhancedPrompt, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <NodeField label="Target model">
          <NodeSelect value={targetModel} onChange={(e) => { setTargetModel(e.target.value); updateNodeData(id, { config: { ...data.config, targetModel: e.target.value } }); }}>
            <option value="imagen">Target: Imagen</option>
            <option value="veo">Target: Veo</option>
            <option value="nanoBanana">Target: Nano Banana</option>
          </NodeSelect>
        </NodeField>

        <RunButton onClick={handleRun} running={data.isRunning}>{data.isRunning ? 'Enhancing…' : 'Run enhancer'}</RunButton>

        {data.output && (
          <NodeOutput label="Enhanced output">
            <p className="line-clamp-3 italic">"{data.output}"</p>
          </NodeOutput>
        )}
      </div>
    </BaseNode>
  );
};

export default PromptEnhancerNode;

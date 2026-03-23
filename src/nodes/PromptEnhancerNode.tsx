import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { GoogleGenAI } from "@google/genai";

const PromptEnhancerNode = ({ id, data }: any) => {
  const [targetModel, setTargetModel] = useState(data.config?.targetModel || 'imagen');
  const updateNodeData = useStore((state) => state.updateNodeData);

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

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const systemInstruction = `You are a creative director and prompt engineer. 
The user gives you a short creative idea. 
Rewrite it into a detailed, technically precise generation prompt 
optimized for ${targetModel}. 
For Veo: use cinematic language, describe camera movement, lighting, mood, duration. 
For Imagen: describe composition, style, lighting, color palette, detail level. 
For Nano Banana: describe precision, style consistency, subject detail. 
Never add watermarks, blur, or text overlays to the description. 
Return only the enhanced prompt, nothing else.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { systemInstruction }
      });

      const enhancedPrompt = response.text;
      updateNodeData(id, { output: enhancedPrompt, isRunning: false });
    } catch (err: any) {
      updateNodeData(id, { error: err.message, isRunning: false });
    }
  };

  return (
    <BaseNode id={id} data={data} onRun={handleRun}>
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Target Model</label>
          <select 
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
            value={targetModel}
            onChange={(e) => {
              setTargetModel(e.target.value);
              updateNodeData(id, { config: { ...data.config, targetModel: e.target.value } });
            }}
          >
            <option value="imagen">Target: Imagen</option>
            <option value="veo">Target: Veo</option>
            <option value="nanoBanana">Target: Nano Banana</option>
          </select>
        </div>

        <button
          onClick={handleRun}
          disabled={data.isRunning}
          className="w-full py-2 bg-[#0097A7] hover:bg-[#00838F] text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
        >
          {data.isRunning ? "ENHANCING..." : "RUN ENHANCER"}
        </button>

        {data.output && (
          <div className="mt-2 p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
            <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Enhanced Output:</p>
            <p className="text-[11px] text-gray-300 italic line-clamp-3">"{data.output}"</p>
          </div>
        )}
      </div>
    </BaseNode>
  );
};

export default PromptEnhancerNode;

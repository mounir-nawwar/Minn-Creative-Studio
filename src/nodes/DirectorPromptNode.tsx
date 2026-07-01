import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Clapperboard, Sparkles } from 'lucide-react';
import AskAIButton from '../components/AskAIButton';
import { NodeField, NodeInput, NodeTextArea, NodeSelect } from './ui';

const DirectorPromptNode = ({ id, data }: any) => {
  const [subject, setSubject] = useState(data.config?.subject || '');
  const [action, setAction] = useState(data.config?.action || '');
  const [style, setStyle] = useState(data.config?.style || 'Cinematic');
  const [lighting, setLighting] = useState(data.config?.lighting || 'Golden Hour');
  const [camera, setCamera] = useState(data.config?.camera || 'Static');
  
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleAISuggestion = (suggestion: any) => {
    if (suggestion.subject) setSubject(suggestion.subject);
    if (suggestion.action) setAction(suggestion.action);
    if (suggestion.style) setStyle(suggestion.style);
    if (suggestion.lighting) setLighting(suggestion.lighting);
    if (suggestion.camera) setCamera(suggestion.camera);
    
    updateNodeData(id, {
      config: {
        ...data.config,
        ...suggestion
      }
    });
  };

  const styles = ['Cinematic', 'Anime', 'Cyberpunk', 'Vintage 35mm', 'Hyper-realistic', 'Claymation', 'Digital Art'];
  const lightings = ['Golden Hour', 'Neon Noir', 'Soft Studio', 'Dramatic Chiaroscuro', 'Natural Sunlight', 'Volumetric Fog'];
  const cameras = [
    'Static', 
    'Slow Zoom In', 
    'Slow Zoom Out', 
    'Pan Left to Right', 
    'Tracking Shot', 
    'Low Angle Hero Shot', 
    'Drone Overhead',
    'Handheld Shaky'
  ];

  const generatePrompt = () => {
    const prompt = `${style} shot of ${subject} ${action}. Lighting: ${lighting}. Camera: ${camera}. High detail, 8k, professional color grading.`;
    updateNodeData(id, { output: prompt });
  };

  // Auto-generate on change
  React.useEffect(() => {
    generatePrompt();
  }, [subject, action, style, lighting, camera]);

  return (
    <BaseNode id={id} data={data} color="#0097A7" icon={Clapperboard}>
      <div className="space-y-3">
        <AskAIButton nodeType="Director's Prompt" currentConfig={{ subject, action, style, lighting, camera }} onSuggestion={handleAISuggestion} label="Ask AI for scene" />

        <NodeField label="Subject">
          <NodeInput type="text" placeholder="e.g. A majestic lion" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </NodeField>

        <NodeField label="Action / setting">
          <NodeTextArea className="h-16" placeholder="e.g. walking through a futuristic neon city" value={action} onChange={(e) => setAction(e.target.value)} />
        </NodeField>

        <div className="grid grid-cols-2 gap-2">
          <NodeField label="Style">
            <NodeSelect value={style} onChange={(e) => setStyle(e.target.value)}>{styles.map((s) => <option key={s} value={s}>{s}</option>)}</NodeSelect>
          </NodeField>
          <NodeField label="Lighting">
            <NodeSelect value={lighting} onChange={(e) => setLighting(e.target.value)}>{lightings.map((l) => <option key={l} value={l}>{l}</option>)}</NodeSelect>
          </NodeField>
        </div>

        <NodeField label="Camera movement">
          <NodeSelect value={camera} onChange={(e) => setCamera(e.target.value)}>{cameras.map((c) => <option key={c} value={c}>{c}</option>)}</NodeSelect>
        </NodeField>

        <div className="rounded-lg bg-black/30 p-2.5 ring-1 ring-white/10">
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-gray-500">
            <Sparkles className="h-3 w-3 text-[#0097A7]" /> Generated prompt
          </p>
          <p className="line-clamp-3 text-[11px] italic text-gray-400">{data.output || 'Waiting for input…'}</p>
        </div>
      </div>
    </BaseNode>
  );
};

export default DirectorPromptNode;

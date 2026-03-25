import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Clapperboard, Sparkles } from 'lucide-react';
import AskAIButton from '../components/AskAIButton';

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
    <BaseNode id={id} data={data} color="#673AB7" icon={Clapperboard}>
      <div className="space-y-3">
        <AskAIButton 
          nodeType="Director's Prompt" 
          currentConfig={{ subject, action, style, lighting, camera }}
          onSuggestion={handleAISuggestion}
          label="Ask AI for Scene"
        />

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Subject</label>
          <input
            type="text"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-[#673AB7]"
            placeholder="e.g. A majestic lion"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Action / Setting</label>
          <textarea
            className="w-full h-16 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-2 text-xs text-gray-300 focus:outline-none focus:border-[#673AB7] resize-none"
            placeholder="e.g. walking through a futuristic neon city"
            value={action}
            onChange={(e) => setAction(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Style</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            >
              {styles.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Lighting</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={lighting}
              onChange={(e) => setLighting(e.target.value)}
            >
              {lightings.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Camera Movement</label>
          <select 
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
            value={camera}
            onChange={(e) => setCamera(e.target.value)}
          >
            {cameras.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className="p-2 bg-[#1a1a1a] rounded-lg border border-[#2a2a2a]">
          <p className="text-[9px] text-gray-500 uppercase font-bold mb-1 flex items-center gap-1">
            <Sparkles className="w-2 h-2" /> Generated Prompt
          </p>
          <p className="text-[10px] text-gray-400 italic line-clamp-3">
            {data.output || 'Waiting for input...'}
          </p>
        </div>
      </div>
    </BaseNode>
  );
};

export default DirectorPromptNode;

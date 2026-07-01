import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Move } from 'lucide-react';
import AskAIButton from '../components/AskAIButton';
import { NodeField, NodeLabel, NodeSelect } from './ui';

const CameraControlNode = ({ id, data }: any) => {
  const [movement, setMovement] = useState(data.config?.movement || 'Static');
  const [speed, setSpeed] = useState(data.config?.speed || 'Normal');
  const [direction, setDirection] = useState(data.config?.direction || 'None');
  
  const updateNodeData = useStore((state) => state.updateNodeData);

  const handleAISuggestion = (suggestion: any) => {
    if (suggestion.movement) setMovement(suggestion.movement);
    if (suggestion.speed) setSpeed(suggestion.speed);
    if (suggestion.direction) setDirection(suggestion.direction);
    
    updateNodeData(id, {
      config: {
        ...data.config,
        ...suggestion
      }
    });
  };

  const movements = ['Static', 'Pan', 'Tilt', 'Zoom', 'Dolly', 'Roll', 'Crane'];
  const speeds = ['Very Slow', 'Slow', 'Normal', 'Fast', 'Dynamic'];
  const directions = {
    Pan: ['Left to Right', 'Right to Left'],
    Tilt: ['Up', 'Down'],
    Zoom: ['In', 'Out'],
    Dolly: ['In', 'Out', 'Side-to-Side'],
    Roll: ['Clockwise', 'Counter-Clockwise'],
    Crane: ['Up', 'Down'],
    Static: ['None']
  };

  const generateDescription = () => {
    const dirText = direction !== 'None' ? ` ${direction}` : '';
    const desc = `Camera ${movement}${dirText} at ${speed} speed.`;
    updateNodeData(id, { output: desc });
  };

  React.useEffect(() => {
    generateDescription();
  }, [movement, speed, direction]);

  return (
    <BaseNode id={id} data={data} color="#0097A7" icon={Move}>
      <div className="space-y-3">
        <AskAIButton nodeType="Camera Control" currentConfig={{ movement, speed, direction }} onSuggestion={handleAISuggestion} label="Ask AI for movement" />

        <div className="space-y-1.5">
          <NodeLabel>Movement type</NodeLabel>
          <div className="grid grid-cols-3 gap-1">
            {movements.map((m) => (
              <button
                key={m}
                onClick={() => { setMovement(m); setDirection(directions[m as keyof typeof directions][0]); }}
                className={`rounded-md py-1.5 text-[11px] font-medium transition-[transform,color,background-color] duration-150 active:scale-[0.98] ${movement === m ? 'bg-[#0097A7] text-white' : 'bg-white/[0.04] text-gray-400 ring-1 ring-white/10 hover:text-white'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NodeField label="Direction">
            <NodeSelect value={direction} onChange={(e) => setDirection(e.target.value)}>
              {directions[movement as keyof typeof directions].map((d) => <option key={d} value={d}>{d}</option>)}
            </NodeSelect>
          </NodeField>
          <NodeField label="Speed">
            <NodeSelect value={speed} onChange={(e) => setSpeed(e.target.value)}>{speeds.map((s) => <option key={s} value={s}>{s}</option>)}</NodeSelect>
          </NodeField>
        </div>

        <div className="rounded-lg bg-black/30 p-2.5 ring-1 ring-white/10">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-gray-500">Camera instruction</p>
          <p className="text-[11px] italic text-gray-300">"{data.output}"</p>
        </div>

        <p className="text-[10px] text-gray-600">Connect to a Prompt Concatenator to add to your main prompt.</p>
      </div>
    </BaseNode>
  );
};

export default CameraControlNode;

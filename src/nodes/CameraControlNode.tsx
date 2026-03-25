import React, { useState } from 'react';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { Video, Move, ZoomIn, RotateCw } from 'lucide-react';
import AskAIButton from '../components/AskAIButton';

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
    <BaseNode id={id} data={data} color="#03A9F4" icon={Move}>
      <div className="space-y-3">
        <AskAIButton 
          nodeType="Camera Control" 
          currentConfig={{ movement, speed, direction }}
          onSuggestion={handleAISuggestion}
          label="Ask AI for Movement"
        />

        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Movement Type</label>
          <div className="grid grid-cols-3 gap-1">
            {movements.map(m => (
              <button
                key={m}
                onClick={() => {
                  setMovement(m);
                  setDirection(directions[m as keyof typeof directions][0]);
                }}
                className={`py-1 rounded text-[9px] font-bold transition-all ${movement === m ? 'bg-[#03A9F4] text-white' : 'bg-[#1a1a1a] text-gray-500 hover:bg-[#222222]'}`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Direction</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
            >
              {directions[movement as keyof typeof directions].map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Speed</label>
            <select 
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={speed}
              onChange={(e) => setSpeed(e.target.value)}
            >
              {speeds.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="p-2 bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg">
          <p className="text-[9px] text-gray-500 uppercase font-bold mb-1">Camera Instruction:</p>
          <p className="text-[10px] text-gray-300 italic">"{data.output}"</p>
        </div>
        
        <p className="text-[8px] text-gray-600 italic">Connect this to a Prompt Concatenator to add to your main prompt.</p>
      </div>
    </BaseNode>
  );
};

export default CameraControlNode;

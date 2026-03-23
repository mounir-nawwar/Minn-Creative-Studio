import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import { X } from 'lucide-react';
import { motion } from 'motion/react';

const StickyNoteNode = ({ id, data }: any) => {
  const [text, setText] = useState(data.config?.text || 'Enter your note here...');
  const [color, setColor] = useState(data.config?.color || '#FFEB3B');
  const deleteNode = useStore((state) => state.deleteNode);
  const updateNodeData = useStore((state) => state.updateNodeData);

  const colors = [
    { name: 'Yellow', hex: '#FFEB3B' },
    { name: 'Blue', hex: '#81D4FA' },
    { name: 'Green', hex: '#A5D6A7' },
    { name: 'Pink', hex: '#F48FB1' },
    { name: 'Orange', hex: '#FFCC80' },
  ];

  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{ backgroundColor: color }}
      className="min-w-[200px] min-h-[200px] p-4 rounded-lg shadow-2xl relative group"
    >
      <button 
        onClick={() => deleteNode(id)}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 hover:bg-black/10 rounded transition-all"
      >
        <X className="w-3.5 h-3.5 text-black/50 hover:text-black" />
      </button>

      <textarea
        className="w-full h-full bg-transparent border-none text-black text-sm font-medium focus:outline-none resize-none placeholder-black/30"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          updateNodeData(id, { config: { ...data.config, text: e.target.value } });
        }}
      />

      <div className="absolute bottom-2 left-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
        {colors.map((c) => (
          <button
            key={c.hex}
            onClick={() => {
              setColor(c.hex);
              updateNodeData(id, { config: { ...data.config, color: c.hex } });
            }}
            className={`w-3 h-3 rounded-full border border-black/10 ${color === c.hex ? 'ring-1 ring-black/50' : ''}`}
            style={{ backgroundColor: c.hex }}
            title={c.name}
          />
        ))}
      </div>
    </motion.div>
  );
};

export default StickyNoteNode;

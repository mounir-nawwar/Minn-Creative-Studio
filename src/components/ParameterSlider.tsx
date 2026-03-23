import React from 'react';

interface ParameterSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  color?: string;
}

const ParameterSlider = ({ label, value, min, max, step = 1, onChange, color = '#0097A7' }: ParameterSliderProps) => {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label className="text-[10px] text-gray-500 uppercase font-bold">{label}</label>
        <span className="text-[10px] font-bold" style={{ color }}>{value}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 bg-[#1a1a1a] rounded-lg appearance-none cursor-pointer accent-[#0097A7]"
        style={{ accentColor: color }}
      />
    </div>
  );
};

export default ParameterSlider;

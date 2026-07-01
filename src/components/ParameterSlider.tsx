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
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
        <span className="text-[11px] font-medium tabular-nums" style={{ color }}>{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-white/10"
        style={{ accentColor: color }}
      />
    </div>
  );
};

export default ParameterSlider;

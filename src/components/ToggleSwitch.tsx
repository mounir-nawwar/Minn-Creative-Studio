interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'navbar' | 'node';
}

const SIZES = {
  navbar: { track: 'h-5 w-10', knob: 'h-4 w-4', on: 'translate-x-[22px]', off: 'translate-x-0.5' },
  node: { track: 'h-4 w-8', knob: 'h-3 w-3', on: 'translate-x-[18px]', off: 'translate-x-0.5' },
} as const;

const ToggleSwitch = ({ checked, onChange, size = 'navbar' }: ToggleSwitchProps) => {
  const s = SIZES[size];
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative ${s.track} shrink-0 rounded-full transition-colors duration-150 ${checked ? 'bg-[#0097A7]' : 'bg-white/15'}`}
    >
      <span
        className={`absolute top-0.5 ${s.knob} rounded-full bg-white shadow-sm transition-transform duration-150 ${checked ? s.on : s.off}`}
      />
    </button>
  );
};

export default ToggleSwitch;

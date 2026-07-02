interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  size?: 'navbar' | 'node';
}

// Knob rests at an explicit left-0.5/top-0.5 anchor (never relies on the
// absolute-position "static position" fallback, which some ancestor layouts
// resolve to a centered position instead of the left edge — that's what was
// causing the knob to render off the track). Only `on` needs a translate,
// sized so the knob lands exactly 2px from the track's right edge.
const SIZES = {
  navbar: { track: 'h-5 w-10', knob: 'h-4 w-4', on: 'translate-x-[20px]' },
  node: { track: 'h-4 w-8', knob: 'h-3 w-3', on: 'translate-x-[16px]' },
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
        className={`absolute left-0.5 top-0.5 ${s.knob} rounded-full bg-white shadow-sm transition-transform duration-150 ${checked ? s.on : 'translate-x-0'}`}
      />
    </button>
  );
};

export default ToggleSwitch;

import { Workflow, MessageSquare } from 'lucide-react';
import { useProjectStore } from '../store/useProjectStore';
import type { StudioMode } from '../store/useProjectStore';

const OPTIONS: { mode: StudioMode; label: string; Icon: typeof Workflow }[] = [
  { mode: 'canvas', label: 'Canvas', Icon: Workflow },
  { mode: 'chat', label: 'Chat', Icon: MessageSquare },
];

/** Segmented Canvas ↔ Chat switch shown in both workspace headers */
export default function StudioModeToggle() {
  const studioMode = useProjectStore((s) => s.studioMode);
  const setStudioMode = useProjectStore((s) => s.setStudioMode);

  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] p-0.5 ring-1 ring-white/10" role="tablist" aria-label="Workspace mode">
      {OPTIONS.map(({ mode, label, Icon }) => {
        const active = studioMode === mode;
        return (
          <button
            key={mode}
            role="tab"
            aria-selected={active}
            onClick={() => setStudioMode(mode)}
            className={`inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[12px] font-medium transition-[transform,color,background-color] duration-150 active:scale-[0.96] ${
              active ? 'bg-[#0097A7] text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

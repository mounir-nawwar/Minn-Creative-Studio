import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export function NodeLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-[10px] font-medium uppercase tracking-wide text-gray-500', className)}>{children}</span>;
}

export function NodeField({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <NodeLabel>{label}</NodeLabel>
      {children}
    </label>
  );
}

const controlBase =
  'w-full rounded-lg bg-black/30 text-gray-200 placeholder:text-gray-600 ring-1 ring-white/10 ' +
  'transition-shadow duration-150 focus:outline-none focus:ring-[1.5px] focus:ring-[#0097A7]/60';

export function NodeInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(controlBase, 'px-2.5 py-2 text-xs', props.className)} />;
}

export function NodeTextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(controlBase, 'resize-none px-2.5 py-2 text-xs leading-relaxed', props.className)} />;
}

export function NodeSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(controlBase, 'cursor-pointer px-2 py-1.5 text-xs', props.className)} />;
}

/** Primary teal run button — calm press, no uppercase/black. */
export function RunButton({
  onClick,
  running,
  disabled,
  children,
  icon: Icon,
}: {
  onClick: () => void;
  running?: boolean;
  disabled?: boolean;
  children: ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || running}
      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0097A7] text-[12px] font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.98] disabled:opacity-50"
    >
      {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  );
}

/** Small inline toggle switch. */
export function NodeToggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-4 w-8 shrink-0 rounded-full transition-colors duration-150 ${on ? 'bg-[#0097A7]' : 'bg-white/15'}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white transition-transform duration-150 ${on ? 'translate-x-[16px]' : 'translate-x-0'}`} />
    </button>
  );
}

/** Output preview box. */
export function NodeOutput({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1 rounded-lg bg-black/30 p-2.5 ring-1 ring-white/10">
      <NodeLabel>{label}</NodeLabel>
      <div className="text-[11px] leading-relaxed text-gray-300">{children}</div>
    </div>
  );
}

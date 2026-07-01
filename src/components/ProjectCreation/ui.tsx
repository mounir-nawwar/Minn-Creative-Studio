import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { motion } from 'motion/react';
import { cn } from '../../lib/utils';

/** Calm step transition — opacity only, no horizontal slide. */
export function StepShell({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
      className="space-y-8"
    >
      {children}
    </motion.div>
  );
}

export function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="space-y-1.5 text-center">
      <h2 className="text-2xl font-semibold tracking-tight text-white" style={{ textWrap: 'balance' }}>
        {title}
      </h2>
      <p className="text-sm text-gray-500">{subtitle}</p>
    </div>
  );
}

export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('text-[11px] font-medium uppercase tracking-wide text-gray-400', className)}>
      {children}
    </span>
  );
}

export function Field({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  );
}

const inputBase =
  'w-full rounded-xl bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-gray-600 ring-1 ring-white/10 ' +
  'transition-shadow duration-150 focus:outline-none focus:ring-[1.5px] focus:ring-[#0097A7]/60';

export function TextField(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputBase, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputBase, 'resize-none leading-relaxed', props.className)} />;
}

/** Pill toggle. `solid` = single-select accent, `soft` = multi-select tag. */
export function Chip({
  selected,
  onClick,
  children,
  variant = 'solid',
}: {
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
  variant?: 'solid' | 'soft';
}) {
  const on = variant === 'soft' ? 'bg-[#0097A7]/15 text-[#0097A7] ring-[#0097A7]/30' : 'bg-[#0097A7] text-white ring-[#0097A7]';
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium capitalize ring-1',
        'transition-[transform,color,background-color,box-shadow] duration-150 active:scale-[0.96]',
        selected ? on : 'bg-white/[0.03] text-gray-400 ring-white/10 hover:bg-white/[0.06] hover:text-white',
      )}
    >
      {children}
    </button>
  );
}

/** Larger selectable tile (project types, platforms, font styles). No hover-grow. */
export function SelectTile({
  selected,
  onClick,
  children,
}: {
  selected?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-xl p-4 text-center ring-1',
        'transition-[color,background-color,box-shadow] duration-150 active:scale-[0.98]',
        selected
          ? 'bg-[#0097A7]/[0.12] text-white ring-[#0097A7]/50'
          : 'bg-white/[0.03] text-gray-400 ring-white/10 hover:text-white hover:ring-white/20',
      )}
    >
      {children}
    </button>
  );
}

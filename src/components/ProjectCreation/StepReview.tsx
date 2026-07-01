import { PROJECT_TYPES } from '../../types/project.types';
import type { StepProps } from './types';
import { StepShell, StepHeader, FieldLabel } from './ui';

interface StepReviewProps extends StepProps {
  mode: 'create' | 'edit';
}

export default function StepReview({ formData, mode }: StepReviewProps) {
  const typeLabel = PROJECT_TYPES[formData.type as keyof typeof PROJECT_TYPES]?.label;
  const moods = formData.visualMood ?? [];

  return (
    <StepShell>
      <StepHeader
        title={mode === 'edit' ? 'Review your changes' : 'Your project is ready'}
        subtitle={mode === 'edit' ? 'Confirm everything looks right before saving.' : 'Review everything before launching.'}
      />

      <div className="mx-auto max-w-2xl space-y-6 rounded-2xl bg-white/[0.03] p-8 ring-1 ring-white/10">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#0097A7]/15 px-2.5 py-1 text-[11px] font-medium text-[#0097A7]">{typeLabel}</span>
              <span className="text-xs text-gray-500">{formData.subtype}</span>
            </div>
            <h3 className="truncate text-2xl font-semibold tracking-tight text-white">{formData.name || 'Untitled project'}</h3>
            {formData.clientName && (
              <p className="text-sm text-gray-500">
                {formData.clientName}
                {formData.clientIndustry ? ` · ${formData.clientIndustry}` : ''}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-1.5 pt-1">
            {[formData.primaryColor, formData.secondaryColor, formData.accentColor].map((c, i) => (
              <span key={i} className="h-7 w-7 rounded-full ring-1 ring-inset ring-white/10" style={{ backgroundColor: c }} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 border-t border-white/5 pt-6">
          <div className="space-y-2.5">
            <FieldLabel>Visual mood</FieldLabel>
            <div className="flex flex-wrap gap-1.5">
              {moods.length === 0 ? (
                <span className="text-sm text-gray-600">—</span>
              ) : (
                moods.map((m) => (
                  <span key={m} className="rounded-md bg-white/[0.06] px-2 py-1 text-[11px] text-gray-300">{m}</span>
                ))
              )}
            </div>
          </div>
          <div className="space-y-2.5">
            <FieldLabel>Brand tone</FieldLabel>
            <p className="text-sm text-gray-300">{formData.brandPersonality || '—'}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 border-t border-white/5 pt-6">
          <div className="space-y-2.5">
            <FieldLabel>Style keywords</FieldLabel>
            <p className="text-sm text-gray-300">{formData.styleKeywords || '—'}</p>
          </div>
          <div className="space-y-2.5">
            <FieldLabel>Avoid</FieldLabel>
            <p className="text-sm text-gray-300">{formData.negativeKeywords || '—'}</p>
          </div>
        </div>

        <div className="space-y-2.5 border-t border-white/5 pt-6">
          <FieldLabel>AI instructions</FieldLabel>
          <p className="line-clamp-4 text-sm leading-relaxed text-gray-400">
            {formData.aiInstructions || 'No instructions yet — add some on the previous step for best results.'}
          </p>
        </div>
      </div>
    </StepShell>
  );
}

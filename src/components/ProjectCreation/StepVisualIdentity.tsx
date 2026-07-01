import { Sparkles, Loader2 } from 'lucide-react';
import type { StepProps } from './types';
import { MOODS, TONES } from './types';
import type { Project } from '../../types/project.types';
import { StepShell, StepHeader, Field, FieldLabel, TextField, TextArea, Chip } from './ui';

interface StepBriefProps extends StepProps {
  onGenerate: () => void;
  isGenerating: boolean;
  aiError: string | null;
}

const COLOR_FIELDS: (keyof Project)[] = ['primaryColor', 'secondaryColor', 'accentColor'];
const COLOR_DEFAULTS: Partial<Record<keyof Project, string>> = {
  primaryColor: '#0097A7',
  secondaryColor: '#1a1a1a',
  accentColor: '#ffffff',
};

export default function StepVisualIdentity({
  formData,
  updateFormData,
  toggleItem,
  onGenerate,
  isGenerating,
  aiError,
}: StepBriefProps) {
  return (
    <StepShell>
      <StepHeader title="Creative brief" subtitle="Brand direction that guides every generation for this project." />

      <div className="mx-auto max-w-3xl space-y-8">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Colors */}
          <div className="space-y-3">
            <FieldLabel>Brand colors</FieldLabel>
            <div className="space-y-2.5">
              {COLOR_FIELDS.map((field) => (
                <div
                  key={field as string}
                  className="flex items-center gap-3 rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/10 transition-shadow duration-150 focus-within:ring-[1.5px] focus-within:ring-[#0097A7]/60"
                >
                  <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg ring-1 ring-inset ring-white/10">
                    <input
                      type="color"
                      value={formData[field] as string}
                      onChange={(e) => updateFormData({ [field]: e.target.value })}
                      className="absolute -left-1/2 -top-1/2 h-[200%] w-[200%] cursor-pointer border-none bg-transparent p-0"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <input
                      type="text"
                      value={formData[field] as string}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) updateFormData({ [field]: val });
                      }}
                      onBlur={(e) => {
                        if (!/^#[0-9A-Fa-f]{6}$/.test(e.target.value)) {
                          updateFormData({ [field]: COLOR_DEFAULTS[field] || '#000000' });
                        }
                      }}
                      className="w-full border-none bg-transparent p-0 font-mono text-sm uppercase text-white focus:outline-none"
                    />
                    <p className="mt-0.5 text-[10px] uppercase tracking-wide text-gray-600">
                      {(field as string).replace('Color', '')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual mood */}
          <div className="space-y-3">
            <FieldLabel>Visual mood</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {MOODS.map((mood) => (
                <Chip
                  key={mood}
                  variant="soft"
                  selected={formData.visualMood?.includes(mood)}
                  onClick={() => toggleItem('visualMood', mood)}
                >
                  {mood}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* Direct, high-signal generation controls — kept above softer context */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field label="Style keywords">
            <TextField
              value={formData.styleKeywords || ''}
              onChange={(e) => updateFormData({ styleKeywords: e.target.value })}
              placeholder="e.g. grainy, minimal, high contrast"
            />
          </Field>
          <Field label="Avoid (negative keywords)">
            <TextField
              value={formData.negativeKeywords || ''}
              onChange={(e) => updateFormData({ negativeKeywords: e.target.value })}
              placeholder="e.g. text, watermark, blurry"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <Field label="Target audience">
            <TextArea
              value={formData.targetAudience || ''}
              onChange={(e) => updateFormData({ targetAudience: e.target.value })}
              placeholder="Who is this for?"
              className="h-24"
            />
          </Field>
          <div className="space-y-2">
            <FieldLabel>Brand tone</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {TONES.map((tone) => (
                <Chip
                  key={tone}
                  selected={formData.brandPersonality === tone}
                  onClick={() => updateFormData({ brandPersonality: tone })}
                >
                  {tone}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        {/* AI master instructions */}
        <div className="space-y-2">
          <FieldLabel className="text-[#0097A7]">AI master instructions</FieldLabel>
          <div className="relative">
            <TextArea
              value={formData.aiInstructions || ''}
              onChange={(e) => updateFormData({ aiInstructions: e.target.value })}
              placeholder="Injected into every AI call for this project. e.g. Always keep a clean, editorial aesthetic; teal is the hero color…"
              className="h-40 pb-14 ring-[#0097A7]/25"
            />
            <button
              type="button"
              onClick={onGenerate}
              disabled={isGenerating}
              className="absolute bottom-3 right-3 inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3.5 text-[13px] font-medium text-black transition-transform duration-150 hover:bg-white/90 active:scale-[0.96] disabled:opacity-50"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {isGenerating ? 'Generating…' : 'Generate from brief'}
            </button>
          </div>
          {aiError && (
            <div className="rounded-lg bg-red-500/10 px-3.5 py-2.5 ring-1 ring-red-500/20">
              <p className="text-xs leading-relaxed text-red-400">{aiError}</p>
            </div>
          )}
        </div>
      </div>
    </StepShell>
  );
}

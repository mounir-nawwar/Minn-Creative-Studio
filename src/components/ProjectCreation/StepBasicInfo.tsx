import { PROJECT_TYPES } from '../../types/project.types';
import type { StepProps, ProjectStatus } from './types';
import { StepShell, StepHeader, Field, FieldLabel, TextField, TextArea, Chip, SelectTile } from './ui';

const STATUSES: ProjectStatus[] = ['active', 'archived', 'completed'];

export default function StepBasicInfo({ formData, updateFormData }: StepProps) {
  const subtypes = PROJECT_TYPES[formData.type as keyof typeof PROJECT_TYPES]?.subtypes ?? [];

  return (
    <StepShell>
      <StepHeader title="Set up the project" subtitle="The essentials — name it, tie it to a client, and classify it." />

      <div className="mx-auto max-w-2xl space-y-6">
        {/* 1 — Primary identifier */}
        <Field label="Project name *">
          <TextField
            value={formData.name || ''}
            onChange={(e) => updateFormData({ name: e.target.value })}
            placeholder="e.g. Summer Launch 2026"
            autoFocus
            className="text-base"
          />
        </Field>

        {/* 2 — Client context (agency priority) */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Client">
            <TextField
              value={formData.clientName || ''}
              onChange={(e) => updateFormData({ clientName: e.target.value })}
              placeholder="e.g. Nike, or Personal"
            />
          </Field>
          <Field label="Client industry">
            <TextField
              value={formData.clientIndustry || ''}
              onChange={(e) => updateFormData({ clientIndustry: e.target.value })}
              placeholder="e.g. Fashion, F&B, Tech"
            />
          </Field>
        </div>

        {/* 3 — Classification */}
        <div className="space-y-2">
          <FieldLabel>Project type</FieldLabel>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
            {Object.entries(PROJECT_TYPES).map(([key, type]) => (
              <SelectTile
                key={key}
                selected={formData.type === key}
                onClick={() => updateFormData({ type: key, subtype: type.subtypes[0] })}
              >
                <span className={`text-2xl ${formData.type === key ? '' : 'opacity-50 grayscale'}`}>{type.icon}</span>
                <span className="text-[11px] font-medium leading-tight">{type.label}</span>
              </SelectTile>
            ))}
          </div>
        </div>

        {subtypes.length > 0 && (
          <div className="space-y-2">
            <FieldLabel>Subtype</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {subtypes.map((sub) => (
                <Chip key={sub} selected={formData.subtype === sub} onClick={() => updateFormData({ subtype: sub })}>
                  {sub}
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* 4 — Supporting detail */}
        <Field label="Description">
          <TextArea
            value={formData.description || ''}
            onChange={(e) => updateFormData({ description: e.target.value })}
            placeholder="What is this project about?"
            className="h-24"
          />
        </Field>

        {/* 5 — Lowest priority: defaults to Active */}
        <div className="space-y-2">
          <FieldLabel>Status</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((status) => (
              <Chip key={status} selected={formData.status === status} onClick={() => updateFormData({ status })}>
                {status}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </StepShell>
  );
}

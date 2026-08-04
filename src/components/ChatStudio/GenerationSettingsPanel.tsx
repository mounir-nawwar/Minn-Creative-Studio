import { Type, Image as ImageIcon, Film, Music } from 'lucide-react';
import { NodeField, NodeInput, NodeSelect, NodeTextArea, NodeToggle, NodeLabel } from '../../nodes/ui';
import { getAspectRatioLabel } from '../../nodes/imagenModels';
import { modelsForMode, findModel, MAX_CHAT_SAMPLES } from '../../lib/models';
import type { GenerationMode } from '../../lib/models';
import { MUSICAL_KEYS } from '../../nodes/lyriaConstants';
import PresetsMenu from './PresetsMenu';
import type { GenerationSettings } from './useChatStudio';

interface GenerationSettingsPanelProps {
  settings: GenerationSettings;
  onChange: (update: Partial<GenerationSettings>) => void;
  disabled: boolean;
}

const MODES: { mode: GenerationMode; label: string; Icon: typeof Type }[] = [
  { mode: 'text', label: 'Text', Icon: Type },
  { mode: 'image', label: 'Image', Icon: ImageIcon },
  { mode: 'video', label: 'Video', Icon: Film },
  { mode: 'audio', label: 'Audio', Icon: Music },
];

/** Right-hand panel: what to generate, with which model, and how */
export default function GenerationSettingsPanel({ settings, onChange, disabled }: GenerationSettingsPanelProps) {
  const model = findModel(settings.model);
  const supports = model?.supports ?? {};
  const setParam = (key: string, value: unknown) =>
    onChange({ params: { ...settings.params, [key]: value } });

  return (
    <aside className={`flex w-72 shrink-0 flex-col border-l border-white/5 bg-[#0a0a0a] ${disabled ? 'pointer-events-none opacity-60' : ''}`}>
      <div className="px-4 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Generation</span>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-5">
        {/* Mode */}
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-white/[0.04] p-1 ring-1 ring-white/10">
          {MODES.map(({ mode, label, Icon }) => {
            const active = settings.mode === mode;
            return (
              <button
                key={mode}
                onClick={() => onChange({ mode })}
                className={`flex flex-col items-center gap-1 rounded-md px-1 py-2 text-[10px] font-medium transition-[transform,color,background-color] duration-150 active:scale-[0.96] ${
                  active ? 'bg-[#0097A7] text-white' : 'text-gray-500 hover:text-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            );
          })}
        </div>

        {/* Model */}
        <NodeField label="Model">
          <NodeSelect value={settings.model} onChange={(e) => onChange({ model: e.target.value })}>
            {modelsForMode(settings.mode).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}{m.priceHint ? ` · ${m.priceHint}` : ''}
              </option>
            ))}
          </NodeSelect>
        </NodeField>
        {model?.description && <p className="-mt-2 px-0.5 text-[10.5px] leading-relaxed text-gray-600">{model.description}</p>}

        {/* Text: presets + system instruction */}
        {supports.systemInstruction && (
          <div className="space-y-1.5">
            <NodeLabel>System instruction</NodeLabel>
            <PresetsMenu
              presetId={settings.presetId}
              systemInstruction={settings.systemInstruction}
              onApply={(preset) => onChange({ systemInstruction: preset.system_instruction, presetId: preset.id })}
            />
            <NodeTextArea
              rows={7}
              value={settings.systemInstruction}
              onChange={(e) => onChange({ systemInstruction: e.target.value, presetId: undefined })}
              placeholder="How should the assistant behave?"
            />
          </div>
        )}

        {supports.grounding && (
          <div className="flex items-center justify-between py-1">
            <div>
              <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Search &amp; read the web</span>
              <p className="mt-0.5 text-[10px] text-gray-600">Costs extra per search query</p>
            </div>
            <NodeToggle
              on={(settings.params.grounding as boolean) ?? false}
              onClick={() => setParam('grounding', !((settings.params.grounding as boolean) ?? false))}
            />
          </div>
        )}

        {/* Media params driven by capability flags */}
        {supports.aspectRatio && (
          <NodeField label="Aspect ratio">
            <NodeSelect
              value={(settings.params.aspectRatio as string) ?? supports.aspectRatio[0]}
              onChange={(e) => setParam('aspectRatio', e.target.value)}
            >
              {supports.aspectRatio.map((ar) => <option key={ar} value={ar}>{getAspectRatioLabel(ar)}</option>)}
            </NodeSelect>
          </NodeField>
        )}

        {supports.resolution && (
          <NodeField label="Resolution">
            <NodeSelect
              value={(settings.params.resolution as string) ?? supports.resolution[0]}
              onChange={(e) => setParam('resolution', e.target.value)}
            >
              {supports.resolution.map((r) => <option key={r} value={r}>{r}</option>)}
            </NodeSelect>
          </NodeField>
        )}

        {supports.duration && (
          <NodeField label="Duration">
            <NodeSelect
              value={String((settings.params.duration as number) ?? supports.duration[supports.duration.length - 1])}
              onChange={(e) => setParam('duration', Number(e.target.value))}
            >
              {supports.duration.map((d) => <option key={d} value={d}>{d}s</option>)}
            </NodeSelect>
          </NodeField>
        )}

        {supports.sampleCount && (
          <NodeField label="Outputs">
            <NodeSelect
              value={String((settings.params.sampleCount as number) ?? 1)}
              onChange={(e) => setParam('sampleCount', Number(e.target.value))}
            >
              {Array.from({ length: MAX_CHAT_SAMPLES }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n} image{n > 1 ? 's' : ''}</option>
              ))}
            </NodeSelect>
          </NodeField>
        )}

        {supports.voice && (
          <NodeField label="Voice">
            <NodeSelect
              value={(settings.params.voice as string) ?? supports.voice[0]}
              onChange={(e) => setParam('voice', e.target.value)}
            >
              {supports.voice.map((v) => <option key={v} value={v}>{v}</option>)}
            </NodeSelect>
          </NodeField>
        )}

        {supports.audio !== undefined && (
          <div className="flex items-center justify-between py-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-gray-500">Native audio</span>
            <NodeToggle
              on={(settings.params.audio as boolean) ?? true}
              onClick={() => setParam('audio', !((settings.params.audio as boolean) ?? true))}
            />
          </div>
        )}

        {supports.bpm && (
          <div className="grid grid-cols-2 gap-3">
            <NodeField label="BPM">
              <NodeInput
                type="number"
                min={40}
                max={220}
                value={(settings.params.bpm as number) ?? ''}
                placeholder="Auto"
                onChange={(e) => setParam('bpm', e.target.value === '' ? undefined : Number(e.target.value))}
              />
            </NodeField>
            <NodeField label="Scale">
              <NodeSelect
                value={(settings.params.scale as string) ?? ''}
                onChange={(e) => setParam('scale', e.target.value || undefined)}
              >
                <option value="">Auto</option>
                {MUSICAL_KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
              </NodeSelect>
            </NodeField>
          </div>
        )}

        {supports.negativePrompt && (
          <NodeField label="Avoid (negative prompt)">
            <NodeTextArea
              rows={2}
              value={(settings.params.negativePrompt as string) ?? ''}
              onChange={(e) => setParam('negativePrompt', e.target.value || undefined)}
              placeholder="What to keep out of the result"
            />
          </NodeField>
        )}

        {supports.seed && (
          <NodeField label="Seed">
            <NodeInput
              type="number"
              value={(settings.params.seed as number) ?? ''}
              placeholder="Random"
              onChange={(e) => setParam('seed', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </NodeField>
        )}

        {supports.temperature && settings.mode === 'text' && (
          <NodeField label="Temperature">
            <NodeInput
              type="number"
              step={0.1}
              min={0}
              max={2}
              value={(settings.params.temperature as number) ?? ''}
              placeholder="Default"
              onChange={(e) => setParam('temperature', e.target.value === '' ? undefined : Number(e.target.value))}
            />
          </NodeField>
        )}
      </div>
    </aside>
  );
}

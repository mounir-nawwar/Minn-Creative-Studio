import { motion } from 'motion/react';
import ParameterSlider from '../components/ParameterSlider';
import type { ImageModel } from './imagenModels';
import { NodeField, NodeSelect, NodeInput } from './ui';

interface ImagenAdvancedPanelProps {
  currentModelConfig: ImageModel;
  isImagen4: boolean;
  isNanoBanana: boolean;
  seed: number | undefined;
  personGeneration: string;
  enhancePrompt: boolean;
  addWatermark: boolean;
  safetySetting: string;
  temperature: number;
  topP: number;
  topK: number;
  mimeType: string;
  grounding: boolean;
  thinkingBudget: number;
  onSeedChange: (v: number | undefined) => void;
  onPersonGenerationChange: (v: string) => void;
  onEnhancePromptChange: (v: boolean) => void;
  onAddWatermarkChange: (v: boolean) => void;
  onSafetySettingChange: (v: string) => void;
  onTemperatureChange: (v: number) => void;
  onTopPChange: (v: number) => void;
  onTopKChange: (v: number) => void;
  onMimeTypeChange: (v: string) => void;
  onGroundingChange: (v: boolean) => void;
  onThinkingBudgetChange: (v: number) => void;
}

function CheckboxCard({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2 ring-1 ring-white/10 transition-shadow duration-150 hover:ring-white/20">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="accent-[#0097A7]" />
      <span className="text-[11px] text-gray-300">{label}</span>
    </label>
  );
}

export default function ImagenAdvancedPanel({
  currentModelConfig, isImagen4, isNanoBanana,
  seed, personGeneration, enhancePrompt, addWatermark, safetySetting,
  temperature, topP, topK, mimeType, grounding, thinkingBudget,
  onSeedChange, onPersonGenerationChange, onEnhancePromptChange,
  onAddWatermarkChange, onSafetySettingChange, onTemperatureChange,
  onTopPChange, onTopKChange, onMimeTypeChange, onGroundingChange,
  onThinkingBudgetChange,
}: ImagenAdvancedPanelProps) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
      className="space-y-3 overflow-hidden"
    >
      {currentModelConfig.supports.seed && (
        <NodeField label="Seed">
          <NodeInput
            type="number"
            placeholder="Random"
            value={seed ?? ''}
            onChange={(e) => onSeedChange(e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </NodeField>
      )}

      {isImagen4 && (
        <>
          <NodeField label="Person generation">
            <NodeSelect value={personGeneration} onChange={(e) => onPersonGenerationChange(e.target.value)}>
              <option value="allow_all">Allow all</option>
              <option value="allow_adult">Allow adults</option>
              <option value="dont_allow">Disallow all</option>
            </NodeSelect>
          </NodeField>

          <NodeField label="Safety setting">
            <NodeSelect value={safetySetting} onChange={(e) => onSafetySettingChange(e.target.value)}>
              <option value="block_low_and_above">Block low &amp; above</option>
              <option value="block_medium_and_above">Block medium &amp; above</option>
              <option value="block_only_high">Block only high</option>
            </NodeSelect>
          </NodeField>

          <div className="grid grid-cols-2 gap-2">
            <CheckboxCard checked={enhancePrompt} onChange={onEnhancePromptChange} label="Enhance prompt" />
            <CheckboxCard checked={addWatermark} onChange={onAddWatermarkChange} label="Watermark" />
          </div>
        </>
      )}

      {isNanoBanana && (
        <>
          <ParameterSlider label="Temperature" value={temperature} min={0} max={2} step={0.1} onChange={onTemperatureChange} />
          <ParameterSlider label="Top P" value={topP} min={0} max={1} step={0.05} onChange={onTopPChange} />
          <ParameterSlider label="Top K" value={topK} min={1} max={64} step={1} onChange={onTopKChange} />

          <div className="grid grid-cols-2 gap-2">
            <NodeField label="Format">
              <NodeSelect value={mimeType} onChange={(e) => onMimeTypeChange(e.target.value)}>
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </NodeSelect>
            </NodeField>

            {currentModelConfig.supports.grounding && (
              <div className="flex items-end">
                <CheckboxCard checked={grounding} onChange={onGroundingChange} label="Grounding" />
              </div>
            )}
          </div>

          {currentModelConfig.supports.thinkingLevel && (
            <NodeField label="Thinking budget">
              <NodeSelect value={thinkingBudget} onChange={(e) => onThinkingBudgetChange(parseInt(e.target.value))}>
                <option value={1024}>Low (1K tokens)</option>
                <option value={4096}>Medium (4K tokens)</option>
                <option value={8192}>High (8K tokens)</option>
              </NodeSelect>
            </NodeField>
          )}
        </>
      )}
    </motion.div>
  );
}

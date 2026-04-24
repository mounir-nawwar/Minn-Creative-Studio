import React from 'react';
import { motion } from 'motion/react';
import ParameterSlider from '../components/ParameterSlider';
import type { ImageModel } from './imagenModels';

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
      transition={{ duration: 0.2 }}
      className="overflow-hidden space-y-3"
    >
      {currentModelConfig.supports.seed && (
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500 uppercase font-bold">Seed</label>
          <input
            type="number"
            className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-300 focus:outline-none focus:border-[#0097A7]"
            placeholder="Random"
            value={seed ?? ''}
            onChange={(e) => onSeedChange(e.target.value ? parseInt(e.target.value) : undefined)}
          />
        </div>
      )}

      {isImagen4 && (
        <>
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Person Generation</label>
            <select
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={personGeneration}
              onChange={(e) => onPersonGenerationChange(e.target.value)}
            >
              <option value="allow_all">Allow All</option>
              <option value="allow_adult">Allow Adults</option>
              <option value="dont_allow">Disallow All</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase font-bold">Safety Setting</label>
            <select
              className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
              value={safetySetting}
              onChange={(e) => onSafetySettingChange(e.target.value)}
            >
              <option value="block_low_and_above">Block Low & Above</option>
              <option value="block_medium_and_above">Block Medium & Above</option>
              <option value="block_only_high">Block Only High</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 py-1.5 px-2 bg-[#111] rounded-lg border border-[#2a2a2a] cursor-pointer hover:border-[#0097A7]/50">
              <input
                type="checkbox"
                checked={enhancePrompt}
                onChange={(e) => onEnhancePromptChange(e.target.checked)}
                className="accent-[#0097A7]"
              />
              <span className="text-[10px] text-gray-400">Enhance Prompt</span>
            </label>
            <label className="flex items-center gap-2 py-1.5 px-2 bg-[#111] rounded-lg border border-[#2a2a2a] cursor-pointer hover:border-[#0097A7]/50">
              <input
                type="checkbox"
                checked={addWatermark}
                onChange={(e) => onAddWatermarkChange(e.target.checked)}
                className="accent-[#0097A7]"
              />
              <span className="text-[10px] text-gray-400">Watermark</span>
            </label>
          </div>
        </>
      )}

      {isNanoBanana && (
        <>
          <ParameterSlider
            label="Temperature"
            value={temperature}
            min={0}
            max={2}
            step={0.1}
            onChange={onTemperatureChange}
            color="#0097A7"
          />
          <ParameterSlider
            label="Top P"
            value={topP}
            min={0}
            max={1}
            step={0.05}
            onChange={onTopPChange}
            color="#0097A7"
          />
          <ParameterSlider
            label="Top K"
            value={topK}
            min={1}
            max={64}
            step={1}
            onChange={onTopKChange}
            color="#0097A7"
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Format</label>
              <select
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                value={mimeType}
                onChange={(e) => onMimeTypeChange(e.target.value)}
              >
                <option value="image/png">PNG</option>
                <option value="image/jpeg">JPEG</option>
                <option value="image/webp">WebP</option>
              </select>
            </div>

            {currentModelConfig.supports.grounding && (
              <label className="flex items-center gap-2 py-1.5 px-2 bg-[#111] rounded-lg border border-[#2a2a2a] cursor-pointer hover:border-[#0097A7]/50">
                <input
                  type="checkbox"
                  checked={grounding}
                  onChange={(e) => onGroundingChange(e.target.checked)}
                  className="accent-[#0097A7]"
                />
                <span className="text-[10px] text-gray-400">Grounding</span>
              </label>
            )}
          </div>

          {currentModelConfig.supports.thinkingLevel && (
            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase font-bold">Thinking Budget</label>
              <select
                className="w-full bg-[#0a0a0a] border border-[#2a2a2a] rounded-lg p-1.5 text-[10px] text-gray-400 focus:outline-none"
                value={thinkingBudget}
                onChange={(e) => onThinkingBudgetChange(parseInt(e.target.value))}
              >
                <option value={1024}>Low (1K tokens)</option>
                <option value={4096}>Medium (4K tokens)</option>
                <option value={8192}>High (8K tokens)</option>
              </select>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

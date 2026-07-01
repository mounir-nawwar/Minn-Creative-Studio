import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, ChevronRight, ChevronLeft, Sparkles, ChevronDown, Loader2, Check, CheckCircle2 } from 'lucide-react';
import { Project, FontStyle, ProjectStatus } from '../types/project.types';
import { fillProjectData, generateAIInstructions } from '../services/geminiService';
import StepBasicInfo from './ProjectCreation/StepBasicInfo';
import StepBrief from './ProjectCreation/StepVisualIdentity';
import StepReview from './ProjectCreation/StepReview';

const TOTAL_STEPS = 3;

interface ProjectCreationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: Partial<Project>) => Promise<void>;
  initialData?: Partial<Project>;
  mode?: 'create' | 'edit';
  existingProject?: Project | null;
}

export default function ProjectCreationOverlay({
  isOpen,
  onClose,
  onCreate,
  initialData,
  mode = 'create',
  existingProject,
}: ProjectCreationOverlayProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Project>>(
    existingProject || initialData || {
      type: 'marketing',
      subtype: 'Social Media Campaign',
      status: 'active' as ProjectStatus,
      visualMood: [],
      primaryColor: '#0097A7',
      secondaryColor: '#000000',
      accentColor: '#FFFFFF',
      fontStyle: 'geometric' as FontStyle,
      styleKeywords: '',
      negativeKeywords: '',
      aiInstructions: '',
    },
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [isAiAssistantExpanded, setIsAiAssistantExpanded] = useState(false);
  const [aiProjectDescription, setAiProjectDescription] = useState('');
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [aiFillSuccess, setAiFillSuccess] = useState(false);

  const updateFormData = (updates: Partial<Project>) => setFormData((prev) => ({ ...prev, ...updates }));

  const toggleItem = (field: keyof Project, item: string) => {
    const current = (formData[field] as string[]) || [];
    updateFormData({ [field]: current.includes(item) ? current.filter((i) => i !== item) : [...current, item] });
  };

  const handleGenerateAIInstructions = async () => {
    setIsGenerating(true);
    setAiError(null);
    try {
      const text = await generateAIInstructions(formData);
      if (text) updateFormData({ aiInstructions: text });
      else throw new Error('Failed to generate instructions. Please try again.');
    } catch (err: any) {
      setAiError(err.message || 'An unexpected error occurred during AI generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAiFill = async () => {
    if (!aiProjectDescription.trim()) return;
    setIsAiFilling(true);
    setAiError(null);
    setAiFillSuccess(false);
    try {
      const data = await fillProjectData(aiProjectDescription);
      updateFormData({
        type: data.projectType,
        subtype: data.projectSubtype,
        name: data.name,
        description: data.description,
        clientName: data.clientName,
        primaryColor: data.primaryColor,
        secondaryColor: data.secondaryColor,
        accentColor: data.accentColor,
        visualMood: data.visualMood,
        styleKeywords: data.styleKeywords,
        negativeKeywords: data.negativeKeywords,
        targetAudience: data.targetAudience,
        brandPersonality: data.brandPersonality?.[0],
        aiInstructions: data.aiInstructions,
      });
      setAiFillSuccess(true);
      setStep(1);
      setTimeout(() => setAiFillSuccess(false), 5000);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setIsAiFilling(false);
    }
  };

  const handleSubmit = async () => {
    await onCreate(formData);
    onClose();
  };

  const stepProps = { formData, updateFormData, toggleItem };
  const isLastStep = step === TOTAL_STEPS;
  const nextDisabled = step === 1 && !formData.name;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm data-[state=open]:[animation:overlayIn_160ms_ease-out]" />
        <Dialog.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="fixed left-1/2 top-1/2 z-[100] flex max-h-[88vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl bg-[#0b0b0b] shadow-[0_24px_80px_rgba(0,0,0,0.7)] ring-1 ring-white/10 focus:outline-none data-[state=open]:[animation:dialogIn_180ms_ease-out]"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0097A7]/15">
                <Sparkles className="h-4 w-4 text-[#0097A7]" />
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-white">
                  {mode === 'edit' ? 'Project settings' : 'Create project'}
                </Dialog.Title>
                <Dialog.Description className="text-xs tabular-nums text-gray-500">
                  Step {step} of {TOTAL_STEPS}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-[transform,color,background-color] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.96]"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* AI assistant */}
          <div className="border-b border-[#0097A7]/15 bg-[#0097A7]/[0.06]">
            <button
              type="button"
              onClick={() => setIsAiAssistantExpanded((v) => !v)}
              className="flex w-full items-center justify-between gap-3 px-6 py-2.5 text-left text-[#0097A7] transition-colors duration-150 hover:bg-[#0097A7]/[0.06]"
            >
              <span className="flex items-center gap-2 text-[13px] font-medium">
                <Sparkles className="h-4 w-4 shrink-0" />
                Describe your project and let AI fill everything in
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isAiAssistantExpanded ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence initial={false}>
              {isAiAssistantExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
                  className="overflow-hidden"
                >
                  <div className="space-y-3 px-6 pb-4">
                    <textarea
                      value={aiProjectDescription}
                      onChange={(e) => setAiProjectDescription(e.target.value)}
                      placeholder="e.g. A social media campaign for a Lebanese luxury fashion brand targeting women 25–40 — dark, editorial, minimal with gold and black tones."
                      className="h-24 w-full resize-none rounded-xl bg-black/30 px-3.5 py-2.5 text-sm leading-relaxed text-white placeholder:text-gray-600 ring-1 ring-[#0097A7]/25 transition-shadow duration-150 focus:outline-none focus:ring-[1.5px] focus:ring-[#0097A7]/60"
                    />
                    <button
                      type="button"
                      onClick={handleAiFill}
                      disabled={isAiFilling || !aiProjectDescription.trim()}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-[#0097A7] text-[13px] font-medium text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.98] disabled:opacity-50"
                    >
                      {isAiFilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      {isAiFilling ? 'Filling…' : 'Fill project for me'}
                    </button>
                    {aiFillSuccess && (
                      <p className="flex items-center gap-1.5 text-[13px] text-emerald-400">
                        <Check className="h-4 w-4" />
                        All fields filled — review and adjust anything you like.
                      </p>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Progress */}
          <div className="h-0.5 w-full bg-white/5">
            <motion.div
              className="h-full bg-[#0097A7]"
              animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
              transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
            />
          </div>

          {/* Step content */}
          <div className="custom-scrollbar flex-1 overflow-y-auto px-8 py-8">
            {step === 1 && <StepBasicInfo {...stepProps} />}
            {step === 2 && (
              <StepBrief
                {...stepProps}
                onGenerate={handleGenerateAIInstructions}
                isGenerating={isGenerating}
                aiError={aiError}
              />
            )}
            {step === 3 && <StepReview {...stepProps} mode={mode} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 border-t border-white/5 px-6 py-4">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(s - 1, 1))}
              disabled={step === 1}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-gray-400 transition-[transform,color,background-color] duration-150 hover:bg-white/5 hover:text-white active:scale-[0.96] disabled:pointer-events-none disabled:opacity-0"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </button>

            <div className="flex items-center gap-1.5">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${
                    step === i + 1 ? 'w-5 bg-[#0097A7]' : 'w-1.5 bg-white/15'
                  }`}
                />
              ))}
            </div>

            {isLastStep ? (
              <button
                type="button"
                onClick={handleSubmit}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#0097A7] px-4 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_16px_-6px_rgba(0,151,167,0.7)] transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96]"
              >
                <CheckCircle2 className="h-4 w-4" />
                {mode === 'edit' ? 'Save changes' : 'Create project'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStep((s) => Math.min(s + 1, TOTAL_STEPS))}
                disabled={nextDisabled}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0097A7] px-4 text-sm font-medium text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_6px_16px_-6px_rgba(0,151,167,0.7)] transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

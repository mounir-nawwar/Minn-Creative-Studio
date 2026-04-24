import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, ChevronRight, ChevronLeft, Sparkles,
  ChevronDown, ChevronUp, Loader2, Check, CheckCircle2
} from 'lucide-react';
import { Project, FontStyle, ProjectStatus } from '../types/project.types';
import StepIndicator from './StepIndicator';
import { fillProjectData, generateAIInstructions } from '../services/geminiService';
import StepProjectType from './ProjectCreation/StepProjectType';
import StepBasicInfo from './ProjectCreation/StepBasicInfo';
import StepVisualIdentity from './ProjectCreation/StepVisualIdentity';
import StepTargetAudience from './ProjectCreation/StepTargetAudience';
import StepAIInstructions from './ProjectCreation/StepAIInstructions';
import StepCollaborators from './ProjectCreation/StepCollaborators';
import StepReview from './ProjectCreation/StepReview';

const TOTAL_STEPS = 7;

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
  existingProject
}: ProjectCreationOverlayProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Project>>(
    existingProject || initialData || {
      type: 'marketing',
      subtype: 'Social Media Campaign',
      status: 'active' as ProjectStatus,
      visualMood: [],
      platforms: [],
      outputFormats: [],
      tags: [],
      collaborators: [],
      primaryColor: '#0097A7',
      secondaryColor: '#000000',
      accentColor: '#FFFFFF',
      fontStyle: 'geometric' as FontStyle,
      aiInstructions: '',
    }
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [newCollaborator, setNewCollaborator] = useState('');
  const [isAiAssistantExpanded, setIsAiAssistantExpanded] = useState(false);
  const [aiProjectDescription, setAiProjectDescription] = useState('');
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [aiFillSuccess, setAiFillSuccess] = useState(false);

  const updateFormData = (updates: Partial<Project>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const toggleItem = (field: keyof Project, item: string) => {
    const current = (formData[field] as string[]) || [];
    if (current.includes(item)) {
      updateFormData({ [field]: current.filter(i => i !== item) });
    } else {
      updateFormData({ [field]: [...current, item] });
    }
  };

  const handleGenerateAIInstructions = async () => {
    setIsGenerating(true);
    setAiError(null);
    try {
      const text = await generateAIInstructions(formData);
      if (text) {
        updateFormData({ aiInstructions: text });
      } else {
        throw new Error("Failed to generate instructions. Please try again.");
      }
    } catch (err: any) {
      setAiError(err.message || "An unexpected error occurred during AI generation.");
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
        fontStyle: data.fontStyle,
        visualMood: data.visualMood,
        styleKeywords: data.styleKeywords,
        negativeKeywords: data.negativeKeywords,
        targetAudience: data.targetAudience,
        brandPersonality: data.brandPersonality[0],
        platforms: data.platforms,
        outputFormats: data.outputFormats,
        aiInstructions: data.aiInstructions,
        deliverables: data.deliverables,
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-xl"
        style={{
          maskImage: 'radial-gradient(circle, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(circle, black 40%, transparent 100%)'
        }}
      />

      {/* Modal */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#0a0a0a] border border-white/10 rounded-[40px] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="p-8 flex items-center justify-between border-b border-white/5 bg-[#111111]">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-[#0097A7]/20 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#0097A7]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase">
                {mode === 'edit' ? 'Project Settings' : 'Create Project'}
              </h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Step {step} of {TOTAL_STEPS}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* AI Assistant Panel */}
        <div className="bg-[#0097A7]/10 border-b border-[#0097A7]/20">
          <button
            onClick={() => setIsAiAssistantExpanded(!isAiAssistantExpanded)}
            className="w-full px-8 py-3 flex items-center justify-between text-[#0097A7] hover:bg-[#0097A7]/5 transition-all"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              <span className="text-[10px] font-black uppercase tracking-widest">
                ✦ AI Project Assistant — describe your project and I'll fill everything in
              </span>
            </div>
            {isAiAssistantExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          <AnimatePresence>
            {isAiAssistantExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-8 pb-6 space-y-4">
                  <textarea
                    value={aiProjectDescription}
                    onChange={(e) => setAiProjectDescription(e.target.value)}
                    placeholder="e.g. I'm creating a social media campaign for a Lebanese luxury fashion brand targeting women 25-40. The aesthetic is dark, editorial, and minimal with gold and black tones. We're posting on Instagram and TikTok."
                    className="w-full bg-black/40 border border-[#0097A7]/30 rounded-2xl p-4 text-white text-xs h-24 resize-none focus:outline-none focus:border-[#0097A7] transition-all"
                  />
                  <div className="flex items-center gap-4">
                    <button
                      onClick={handleAiFill}
                      disabled={isAiFilling || !aiProjectDescription.trim()}
                      className="flex-1 py-3 bg-[#0097A7] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#00838F] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isAiFilling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {isAiFilling ? 'Processing...' : 'Fill Project For Me'}
                    </button>
                  </div>
                  {aiFillSuccess && (
                    <div className="flex items-center gap-2 text-green-500 text-[10px] font-bold uppercase tracking-widest">
                      <Check className="w-3.5 h-3.5" />
                      ✓ All fields filled — review and adjust anything you'd like
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-white/5 w-full">
          <motion.div
            className="h-full bg-[#0097A7]"
            animate={{ width: `${(step / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 && <StepProjectType {...stepProps} />}
            {step === 2 && <StepBasicInfo {...stepProps} />}
            {step === 3 && <StepVisualIdentity {...stepProps} />}
            {step === 4 && <StepTargetAudience {...stepProps} />}
            {step === 5 && (
              <StepAIInstructions
                {...stepProps}
                onGenerate={handleGenerateAIInstructions}
                isGenerating={isGenerating}
                aiError={aiError}
              />
            )}
            {step === 6 && (
              <StepCollaborators
                {...stepProps}
                newCollaborator={newCollaborator}
                onCollaboratorChange={setNewCollaborator}
              />
            )}
            {step === 7 && <StepReview {...stepProps} mode={mode} />}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/5 bg-[#111111] flex items-center justify-between">
          <button
            onClick={() => setStep(s => Math.max(s - 1, 1))}
            disabled={step === 1}
            className="flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-white disabled:opacity-0 transition-all font-black uppercase text-[11px] tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full transition-all ${step === i + 1 ? 'w-6 bg-[#0097A7]' : 'bg-white/10'}`}
                />
              ))}
            </div>
          </div>

          {step === TOTAL_STEPS ? (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-10 py-4 bg-[#0097A7] text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] hover:scale-105 transition-all shadow-[0_0_30px_rgba(0,151,167,0.3)]"
            >
              <CheckCircle2 className="w-4 h-4" />
              {mode === 'edit' ? 'Save Changes' : 'Create Project'}
            </button>
          ) : (
            <button
              onClick={() => setStep(s => Math.min(s + 1, TOTAL_STEPS))}
              disabled={step === 2 && !formData.name}
              className="flex items-center gap-2 px-10 py-4 bg-white text-black rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] hover:scale-105 transition-all disabled:opacity-50"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
}

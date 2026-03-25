import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  Sparkles, 
  Upload, 
  Palette, 
  Target, 
  Settings, 
  CheckCircle2,
  Instagram,
  Youtube,
  Globe,
  Facebook,
  Linkedin,
  Mail,
  Monitor,
  Printer,
  Smartphone,
  ChevronDown,
  ChevronUp,
  Loader2,
  Check
} from 'lucide-react';
import { Project, PROJECT_TYPES, FontStyle, ProjectStatus } from '../types/project.types';
import StepIndicator from './StepIndicator';
import { fillProjectData, generateAIInstructions } from '../services/geminiService';

interface ProjectCreationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: Partial<Project>) => Promise<void>;
  initialData?: Partial<Project>;
}

const MOODS = [
  'Minimal', 'Bold', 'Luxury', 'Playful', 'Dark', 'Vibrant', 'Soft', 'Raw', 
  'Corporate', 'Cinematic', 'Editorial', 'Futuristic', 'Natural', 'Retro', 'Abstract'
];

const TONES = [
  'Professional', 'Friendly', 'Luxurious', 'Bold', 'Playful', 'Minimalist', 
  'Authoritative', 'Warm', 'Edgy', 'Inspirational'
];

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', icon: Instagram },
  { id: 'tiktok', label: 'TikTok', icon: Smartphone },
  { id: 'youtube', label: 'YouTube', icon: Youtube },
  { id: 'facebook', label: 'Facebook', icon: Facebook },
  { id: 'linkedin', label: 'LinkedIn', icon: Linkedin },
  { id: 'website', label: 'Website', icon: Globe },
  { id: 'print', label: 'Print', icon: Printer },
  { id: 'email', label: 'Email', icon: Mail },
];

const FORMATS = [
  { id: '1:1', label: '1:1 (Square)', platform: 'Instagram' },
  { id: '9:16', label: '9:16 (Stories/Reels)', platform: 'TikTok/Reels' },
  { id: '16:9', label: '16:9 (Landscape)', platform: 'YouTube' },
  { id: '4:5', label: '4:5 (Portrait)', platform: 'Instagram' },
  { id: 'A4', label: 'A4 (Print)', platform: 'Print' },
];

export default function ProjectCreationOverlay({ isOpen, onClose, onCreate, initialData }: ProjectCreationOverlayProps) {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<Partial<Project>>(initialData || {
    type: 'marketing',
    subtype: 'Social Media Campaign',
    status: 'active' as ProjectStatus,
    visualMood: [],
    platforms: [],
    outputFormats: [],
    tags: [],
    primaryColor: '#0097A7',
    secondaryColor: '#000000',
    accentColor: '#FFFFFF',
    fontStyle: 'geometric' as FontStyle,
    aiInstructions: '',
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  
  // AI Assistant State
  const [isAiAssistantExpanded, setIsAiAssistantExpanded] = useState(false);
  const [aiProjectDescription, setAiProjectDescription] = useState('');
  const [isAiFilling, setIsAiFilling] = useState(false);
  const [aiFillSuccess, setAiFillSuccess] = useState(false);

  const handleNext = () => setStep(s => Math.min(s + 1, 6));
  const handleBack = () => setStep(s => Math.max(s - 1, 1));

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
      console.error("AI Generation failed", err);
      setAiError(err.message || "An unexpected error occurred during AI generation.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async () => {
    await onCreate(formData);
    onClose();
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
        brandPersonality: data.brandPersonality[0], // Project type expects a string for brandPersonality in Step 4
        platforms: data.platforms,
        outputFormats: data.outputFormats,
        aiInstructions: data.aiInstructions,
        deliverables: data.deliverables,
      });
      
      setAiFillSuccess(true);
      setStep(1); // Navigate to Step 1 for review
      setTimeout(() => setAiFillSuccess(false), 5000);
    } catch (err: any) {
      setAiError(err.message);
    } finally {
      setIsAiFilling(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      {/* Backdrop with Radial Blur Vignette */}
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

      {/* Modal Container */}
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
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase">Create Project</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Step {step} of 6</p>
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
                      {isAiFilling ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
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
            animate={{ width: `${(step / 6) * 100}%` }}
          />
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-4xl font-black text-white tracking-tighter">What are you working on?</h3>
                  <p className="text-gray-500 text-sm">Select the category that best fits your project.</p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {Object.entries(PROJECT_TYPES).map(([key, type]) => (
                    <button
                      key={key}
                      onClick={() => updateFormData({ type: key, subtype: type.subtypes[0] })}
                      className={`p-6 rounded-3xl border transition-all flex flex-col items-center gap-4 group ${
                        formData.type === key 
                        ? 'bg-[#0097A7]/20 border-[#0097A7] shadow-[0_0_30px_rgba(0,151,167,0.2)]' 
                        : 'bg-[#111111] border-white/5 hover:border-white/20'
                      }`}
                    >
                      <span className={`text-4xl transition-transform group-hover:scale-110 ${formData.type === key ? '' : 'grayscale opacity-40'}`}>
                        {type.icon}
                      </span>
                      <span className={`text-[10px] font-black uppercase tracking-widest text-center leading-tight ${formData.type === key ? 'text-white' : 'text-gray-500'}`}>
                        {type.label}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-4xl font-black text-white tracking-tighter">Tell us more</h3>
                  <p className="text-gray-500 text-sm">Define the basics of your creative mission.</p>
                </div>
                
                <div className="space-y-6 max-w-2xl mx-auto">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Subtype</label>
                    <div className="flex flex-wrap gap-2">
                      {PROJECT_TYPES[formData.type as keyof typeof PROJECT_TYPES]?.subtypes.map(sub => (
                        <button
                          key={sub}
                          onClick={() => updateFormData({ subtype: sub })}
                          className={`px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
                            formData.subtype === sub 
                            ? 'bg-[#0097A7] text-white' 
                            : 'bg-[#111111] text-gray-500 hover:text-white border border-white/5'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Project Name *</label>
                      <input 
                        type="text"
                        value={formData.name || ''}
                        onChange={(e) => updateFormData({ name: e.target.value })}
                        placeholder="e.g. Summer Launch 2026"
                        className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-[#0097A7] transition-all"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Client Name</label>
                      <input 
                        type="text"
                        value={formData.clientName || ''}
                        onChange={(e) => updateFormData({ clientName: e.target.value })}
                        placeholder="e.g. Nike, Apple, Personal"
                        className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white focus:outline-none focus:border-[#0097A7] transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Description</label>
                    <textarea 
                      value={formData.description || ''}
                      onChange={(e) => updateFormData({ description: e.target.value })}
                      placeholder="What is this project about?"
                      className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white h-32 resize-none focus:outline-none focus:border-[#0097A7] transition-all"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-4xl font-black text-white tracking-tighter">Visual Identity</h3>
                  <p className="text-gray-500 text-sm">Define the look and feel of the brand.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 max-w-4xl mx-auto">
                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Color Palette</label>
                      <div className="space-y-4">
                        {['primaryColor', 'secondaryColor', 'accentColor'].map((field) => (
                          <div key={field} className="flex items-center gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-3 bg-[#111111] border border-white/5 rounded-2xl p-3 focus-within:border-[#0097A7] transition-all">
                                <div className="relative w-10 h-10 rounded-full border border-white/10 overflow-hidden shrink-0 shadow-lg">
                                  <input 
                                    type="color"
                                    value={formData[field as keyof Project] as string}
                                    onChange={(e) => updateFormData({ [field]: e.target.value })}
                                    className="absolute inset-0 w-[200%] h-[200%] -top-1/2 -left-1/2 cursor-pointer border-none p-0 bg-transparent"
                                  />
                                </div>
                                <div className="flex-1">
                                  <input 
                                    type="text"
                                    value={formData[field as keyof Project] as string}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                                        updateFormData({ [field]: val });
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const val = e.target.value;
                                      if (!/^#[0-9A-Fa-f]{6}$/.test(val)) {
                                        // Reset to default if invalid on blur
                                        const defaults: any = { primaryColor: '#0097A7', secondaryColor: '#1a1a1a', accentColor: '#ffffff' };
                                        updateFormData({ [field]: defaults[field] || '#000000' });
                                      }
                                    }}
                                    className="w-full bg-transparent border-none p-0 text-xs font-mono text-white focus:outline-none uppercase"
                                  />
                                  <p className="text-[8px] font-bold text-gray-600 uppercase tracking-widest mt-0.5">
                                    {field.replace('Color', '')}
                                  </p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Font Style</label>
                      <div className="grid grid-cols-2 gap-2">
                        {['geometric', 'serif', 'handwritten', 'monospace', 'display', 'mixed'].map((font) => (
                          <button
                            key={font}
                            onClick={() => updateFormData({ fontStyle: font as FontStyle })}
                            className={`px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                              formData.fontStyle === font 
                              ? 'bg-[#0097A7] border-[#0097A7] text-white' 
                              : 'bg-[#111111] border-white/5 text-gray-500 hover:text-white'
                            }`}
                          >
                            {font}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Visual Mood</label>
                      <div className="flex flex-wrap gap-2">
                        {MOODS.map(mood => (
                          <button
                            key={mood}
                            onClick={() => toggleItem('visualMood', mood)}
                            className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all ${
                              formData.visualMood?.includes(mood)
                              ? 'bg-[#0097A7]/20 border-[#0097A7] text-[#0097A7]'
                              : 'bg-[#111111] border-white/5 text-gray-600 hover:text-gray-400'
                            }`}
                          >
                            {mood}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Style Keywords</label>
                      <input 
                        type="text"
                        value={formData.styleKeywords || ''}
                        onChange={(e) => updateFormData({ styleKeywords: e.target.value })}
                        placeholder="e.g. Grainy, Minimal, High Contrast..."
                        className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white text-xs focus:outline-none focus:border-[#0097A7]"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-4xl font-black text-white tracking-tighter">Target & Platforms</h3>
                  <p className="text-gray-500 text-sm">Who is this for and where will it live?</p>
                </div>

                <div className="max-w-3xl mx-auto space-y-10">
                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Target Audience</label>
                      <textarea 
                        value={formData.targetAudience || ''}
                        onChange={(e) => updateFormData({ targetAudience: e.target.value })}
                        placeholder="Describe your ideal viewer..."
                        className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white text-xs h-32 resize-none focus:outline-none focus:border-[#0097A7]"
                      />
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Brand Personality</label>
                      <div className="flex flex-wrap gap-2">
                        {TONES.map(tone => (
                          <button
                            key={tone}
                            onClick={() => updateFormData({ brandPersonality: tone })}
                            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                              formData.brandPersonality === tone
                              ? 'bg-[#0097A7] border-[#0097A7] text-white'
                              : 'bg-[#111111] border-white/5 text-gray-600 hover:text-gray-400'
                            }`}
                          >
                            {tone}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Platform Targets</label>
                    <div className="grid grid-cols-4 md:grid-cols-8 gap-4">
                      {PLATFORMS.map(platform => (
                        <button
                          key={platform.id}
                          onClick={() => toggleItem('platforms', platform.id)}
                          className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${
                            formData.platforms?.includes(platform.id)
                            ? 'bg-[#0097A7]/20 border-[#0097A7] text-[#0097A7]'
                            : 'bg-[#111111] border-white/5 text-gray-600 hover:text-white'
                          }`}
                        >
                          <platform.icon className="w-6 h-6" />
                          <span className="text-[8px] font-black uppercase tracking-tighter">{platform.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 5 && (
              <motion.div
                key="step5"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-4xl font-black text-white tracking-tighter">Brief the AI</h3>
                  <p className="text-gray-500 text-sm">Master instructions injected into every AI call.</p>
                </div>

                <div className="max-w-3xl mx-auto space-y-8">
                  <div className="relative">
                    <div className="absolute -top-3 left-6 px-3 bg-[#0a0a0a] z-10">
                      <label className="text-[10px] font-black text-[#0097A7] uppercase tracking-widest">AI Master Instructions</label>
                    </div>
                    <textarea 
                      value={formData.aiInstructions || ''}
                      onChange={(e) => updateFormData({ aiInstructions: e.target.value })}
                      placeholder="e.g. Always maintain a clean minimal aesthetic. The brand uses teal as its hero color..."
                      className="w-full bg-[#111111] border border-[#0097A7]/30 rounded-[32px] p-8 pt-10 text-white text-sm h-64 resize-none focus:outline-none focus:border-[#0097A7] transition-all leading-relaxed"
                    />
                    {aiError && (
                      <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl">
                        <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest leading-relaxed">
                          {aiError}
                        </p>
                      </div>
                    )}
                    <button
                      onClick={handleGenerateAIInstructions}
                      disabled={isGenerating}
                      className="absolute bottom-6 right-6 flex items-center gap-2 px-4 py-2 bg-white text-black rounded-full text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all disabled:opacity-50"
                    >
                      {isGenerating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      {isGenerating ? 'Generating...' : 'Generate from my inputs'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Deliverables</label>
                      <input 
                        type="text"
                        value={formData.deliverables || ''}
                        onChange={(e) => updateFormData({ deliverables: e.target.value })}
                        placeholder="e.g. 10 Reels, 5 Feed Posts"
                        className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white text-xs focus:outline-none focus:border-[#0097A7]"
                      />
                    </div>
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Budget</label>
                      <input 
                        type="text"
                        value={formData.budget || ''}
                        onChange={(e) => updateFormData({ budget: e.target.value })}
                        placeholder="e.g. $5,000"
                        className="w-full bg-[#111111] border border-white/5 rounded-2xl p-4 text-white text-xs focus:outline-none focus:border-[#0097A7]"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 6 && (
              <motion.div
                key="step6"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center space-y-2">
                  <h3 className="text-4xl font-black text-white tracking-tighter">Your project is ready</h3>
                  <p className="text-gray-500 text-sm">Review everything before launching.</p>
                </div>

                <div className="max-w-2xl mx-auto bg-[#111111] border border-white/5 rounded-[40px] p-10 space-y-8 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-3 py-1 bg-[#0097A7]/20 text-[#0097A7] rounded-full text-[9px] font-black uppercase tracking-widest">
                          {PROJECT_TYPES[formData.type as keyof typeof PROJECT_TYPES]?.label}
                        </span>
                        <span className="text-[10px] text-gray-600 uppercase font-bold">{formData.subtype}</span>
                      </div>
                      <h4 className="text-3xl font-black text-white tracking-tighter">{formData.name}</h4>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-8 h-8 rounded-full border border-white/10" style={{ backgroundColor: formData.primaryColor }} />
                      <div className="w-8 h-8 rounded-full border border-white/10" style={{ backgroundColor: formData.secondaryColor }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Visual Mood</label>
                      <div className="flex flex-wrap gap-2">
                        {formData.visualMood?.map(m => (
                          <span key={m} className="px-3 py-1 bg-white/5 text-gray-400 rounded-lg text-[9px] font-bold uppercase">{m}</span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Platforms</label>
                      <div className="flex flex-wrap gap-3">
                        {formData.platforms?.map(p => {
                          const PlatformIcon = PLATFORMS.find(pl => pl.id === p)?.icon || Globe;
                          return <PlatformIcon key={p} className="w-5 h-5 text-gray-500" />;
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">AI Instructions Preview</label>
                    <p className="text-xs text-gray-400 leading-relaxed italic line-clamp-3">
                      "{formData.aiInstructions || 'No instructions generated yet.'}"
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="p-8 border-t border-white/5 bg-[#111111] flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-2 px-6 py-3 text-gray-500 hover:text-white disabled:opacity-0 transition-all font-black uppercase text-[11px] tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          <div className="flex items-center gap-4">
            <div className="flex gap-1.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`w-1.5 h-1.5 rounded-full transition-all ${step === i + 1 ? 'w-6 bg-[#0097A7]' : 'bg-white/10'}`} 
                />
              ))}
            </div>
          </div>

          {step === 6 ? (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 px-10 py-4 bg-[#0097A7] text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] hover:scale-105 transition-all shadow-[0_0_30px_rgba(0,151,167,0.3)]"
            >
              <CheckCircle2 className="w-4 h-4" />
              Create Project
            </button>
          ) : (
            <button
              onClick={handleNext}
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



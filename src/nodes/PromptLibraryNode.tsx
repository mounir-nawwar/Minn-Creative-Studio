import React, { useState, useEffect } from 'react';
import { Search, Tag, Sparkles, BookOpen, Check } from 'lucide-react';
import { API_BASE } from '../constants';
import { authHeader } from '../lib/api';
import BaseNode from './BaseNode';
import { useStore } from '../store/useStore';
import { NodeOutput, RunButton } from './ui';
import AskAIButton from '../components/AskAIButton';

const PRESET_TEMPLATES = [
  {
    id: 'fashion-editorial',
    category: 'Fashion & Models',
    text: 'A professional high-fashion editorial photo of a model wearing a luxurious evening outfit, studio lighting, crisp 8k detail, Vogue style.',
    tags: ['fashion', 'model', 'editorial', 'clothing']
  },
  {
    id: 'fashion-tryon',
    category: 'Fashion & Models',
    text: 'A full-body studio portrait of an elegant model wearing the garment, neutral studio backdrop, soft key lighting, 8k luxury fashion lookbook.',
    tags: ['model', 'try-on', 'clothing', 'lookbook']
  },
  {
    id: 'product-studio',
    category: 'E-commerce & Products',
    text: 'A clean commercial studio photography shot of the product centered on a smooth reflective acrylic surface, soft diffused rim light, 8k e-commerce hero shot.',
    tags: ['product', 'studio', 'e-commerce', 'clean']
  },
  {
    id: 'product-lifestyle',
    category: 'E-commerce & Products',
    text: 'A warm aesthetic lifestyle photo of the product placed on a sunlit marble table with organic shadows, minimalist decor, Instagram aesthetic.',
    tags: ['lifestyle', 'product', 'social', 'aesthetic']
  },
  {
    id: 'cinematic-video',
    category: 'Video & Motion',
    text: 'A cinematic slow-motion tracking shot, shallow depth of field, anamorphic lens flare, dramatic volumetric lighting, 4k 60fps film look.',
    tags: ['video', 'cinematic', 'slow-motion', 'veo']
  },
  {
    id: 'luxury-jewelry',
    category: 'E-commerce & Products',
    text: 'Macro photography of luxury jewelry on a dark matte pedestal, sharp sparkling caustics, cinematic golden hour light, high detail 8k.',
    tags: ['jewelry', 'macro', 'luxury', 'product']
  },
];

const CATEGORIES = ['All', 'Fashion & Models', 'E-commerce & Products', 'Video & Motion', 'Saved'];

const PromptLibraryNode = ({ data, id }: any) => {
  const [prompts, setPrompts] = useState<any[]>(PRESET_TEMPLATES);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [selectedText, setSelectedText] = useState<string>(data.output || data.config?.prompt || PRESET_TEMPLATES[0].text);
  const updateNodeData = useStore((state) => state.updateNodeData);

  useEffect(() => {
    fetchSavedPrompts();
  }, []);

  const fetchSavedPrompts = async () => {
    try {
      const response = await fetch(`${API_BASE}/prompts`, { headers: { ...authHeader() } });
      if (response.ok) {
        const result = await response.json();
        if (Array.isArray(result) && result.length > 0) {
          const userPrompts = result.map((p: any) => ({
            id: p.id || `saved-${Date.now()}`,
            category: 'Saved',
            text: p.text || p.content || p.prompt,
            tags: Array.isArray(p.tags) ? p.tags : ['saved']
          }));
          setPrompts([...PRESET_TEMPLATES, ...userPrompts]);
        }
      }
    } catch (err) {
      console.warn('Could not fetch backend prompts, using built-in library:', err);
    }
  };

  const handleSelectPrompt = (promptText: string) => {
    setSelectedText(promptText);
    updateNodeData(id, {
      output: promptText,
      config: { ...data.config, prompt: promptText }
    });
  };

  const handleAISuggestion = (suggestion: any) => {
    if (suggestion.prompt || suggestion.text) {
      const newPromptText = suggestion.prompt || suggestion.text;
      const newTemplate = {
        id: `ai-${Date.now()}`,
        category: 'Saved',
        text: newPromptText,
        tags: ['ai-generated', 'custom']
      };
      setPrompts((prev) => [newTemplate, ...prev]);
      handleSelectPrompt(newPromptText);
    }
  };

  const filteredPrompts = prompts.filter(p => {
    const matchesCategory = category === 'All' || p.category === category;
    const q = search.toLowerCase();
    const tags = Array.isArray(p.tags) ? p.tags : [];
    const matchesSearch = !q || p.text?.toLowerCase().includes(q) || tags.some((t: string) => t.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  return (
    <BaseNode id={id} data={data} inputs={false} outputs={true} icon={BookOpen}>
      <div className="nodrag nowheel space-y-3">
        {/* Ask AI to generate custom prompt */}
        <AskAIButton
          nodeType="Prompt Library"
          currentConfig={{ prompt: selectedText }}
          onSuggestion={handleAISuggestion}
          label="Ask AI for Custom Prompt Template"
        />

        {/* Category Pills */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              className={`shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                category === cat
                  ? 'bg-[#0097A7] text-white font-semibold'
                  : 'bg-white/[0.04] text-gray-400 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates & tags..."
            className="w-full bg-black/50 border border-white/10 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-[#0097A7]/60"
          />
        </div>

        {/* Template List */}
        <div className="max-h-52 overflow-y-auto space-y-1.5 pr-0.5 custom-scrollbar">
          {filteredPrompts.length > 0 ? (
            filteredPrompts.map((p) => {
              const isSelected = selectedText === p.text;
              const tags = Array.isArray(p.tags) ? p.tags : [];
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleSelectPrompt(p.text)}
                  className={`w-full text-left p-2.5 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-[#0097A7]/15 border-[#0097A7]/60 text-white ring-1 ring-[#0097A7]/30'
                      : 'bg-white/[0.02] border-white/5 text-gray-300 hover:bg-white/[0.05] hover:border-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[11px] leading-relaxed line-clamp-2 flex-1">{p.text}</p>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#0097A7] shrink-0 mt-0.5" />}
                  </div>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {tags.map((tag: string, idx: number) => (
                        <span key={idx} className="px-1.5 py-0.5 bg-black/40 rounded text-[9px] text-gray-400 flex items-center gap-1 border border-white/5">
                          <Tag className="w-2 h-2 text-[#0097A7]" /> {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              );
            })
          ) : (
            <div className="text-center py-6 text-gray-600 text-xs italic">No matching templates found</div>
          )}
        </div>

        <RunButton onClick={() => handleSelectPrompt(selectedText)} icon={BookOpen}>
          Apply Selected Prompt
        </RunButton>

        {data.output && (
          <NodeOutput label="Active Prompt Output">
            <p className="text-xs text-gray-300 line-clamp-3">{data.output}</p>
          </NodeOutput>
        )}
      </div>
    </BaseNode>
  );
};

export default PromptLibraryNode;
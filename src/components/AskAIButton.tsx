import React, { useState } from 'react';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { suggestNodeConfig } from '../services/geminiService';
import { useProjectStore } from '../store/useProjectStore';

interface AskAIButtonProps {
  nodeType: string;
  currentConfig: any;
  onSuggestion: (suggestion: any) => void;
  label?: string;
}

export default function AskAIButton({ nodeType, currentConfig, onSuggestion, label = "Ask AI to Fill" }: AskAIButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentProject } = useProjectStore();

  const handleAsk = async () => {
    if (!goal.trim()) return;
    setLoading(true);
    try {
      const suggestion = await suggestNodeConfig({
        nodeType,
        userGoal: goal,
        currentConfig,
        projectId: currentProject?.id,
      });
      onSuggestion(suggestion);
      setIsOpen(false);
      setGoal('');
    } catch (err) {
      console.error("Ask AI failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-full py-1.5 px-3 bg-[#0097A7]/10 hover:bg-[#0097A7]/20 border border-[#0097A7]/30 rounded-lg flex items-center justify-center gap-2 text-[10px] text-[#0097A7] font-black uppercase tracking-widest transition-all"
        >
          <Sparkles className="w-3 h-3" />
          {label}
        </button>
      ) : (
        <div className="p-2 bg-[#111111] border border-[#0097A7]/30 rounded-xl space-y-2 shadow-2xl animate-in fade-in zoom-in duration-200">
          <div className="flex items-center justify-between">
            <p className="text-[9px] text-[#0097A7] font-black uppercase tracking-widest">What's your goal?</p>
            <button onClick={() => setIsOpen(false)} className="text-[10px] text-gray-600 hover:text-white">Cancel</button>
          </div>
          <div className="relative">
            <input
              autoFocus
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
              placeholder="e.g. A dramatic space battle"
              className="w-full bg-black border border-[#2a2a2a] rounded-lg p-2 pr-10 text-[11px] text-white focus:outline-none focus:border-[#0097A7]"
            />
            <button
              onClick={handleAsk}
              disabled={loading || !goal.trim()}
              className="absolute right-1 top-1 bottom-1 px-2 bg-[#0097A7] text-white rounded-md disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ArrowRight className="w-3 h-3" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

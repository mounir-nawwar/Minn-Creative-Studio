import { useState } from 'react';
import { Sparkles, Loader2, ArrowRight } from 'lucide-react';
import { suggestNodeConfig } from '../services/geminiService';
import { useProjectStore } from '../store/useProjectStore';

interface AskAIButtonProps {
  nodeType: string;
  currentConfig: any;
  onSuggestion: (suggestion: any) => void;
  label?: string;
}

export default function AskAIButton({ nodeType, currentConfig, onSuggestion, label = 'Ask AI to fill' }: AskAIButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [goal, setGoal] = useState('');
  const [loading, setLoading] = useState(false);
  const { currentProject } = useProjectStore();

  const handleAsk = async () => {
    if (!goal.trim()) return;
    setLoading(true);
    try {
      const suggestion = await suggestNodeConfig({ nodeType, userGoal: goal, currentConfig, projectId: currentProject?.id });
      onSuggestion(suggestion);
      setIsOpen(false);
      setGoal('');
    } catch (err) {
      console.error('Ask AI failed', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-[#0097A7]/10 text-[12px] font-medium text-[#0097A7] ring-1 ring-[#0097A7]/25 transition-[transform,background-color] duration-150 hover:bg-[#0097A7]/15 active:scale-[0.98]"
      >
        <Sparkles className="h-3.5 w-3.5" />
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-xl bg-[#0d0d0d] p-2 ring-1 ring-[#0097A7]/25">
      <div className="flex items-center justify-between px-0.5">
        <p className="text-[11px] font-medium text-[#0097A7]">What's your goal?</p>
        <button onClick={() => setIsOpen(false)} className="text-[11px] text-gray-500 transition-colors hover:text-white">Cancel</button>
      </div>
      <div className="relative">
        <input
          autoFocus
          type="text"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          placeholder="e.g. A dramatic space battle"
          className="w-full rounded-lg bg-black/40 py-2 pl-2.5 pr-10 text-[12px] text-white placeholder:text-gray-600 ring-1 ring-white/10 transition-shadow duration-150 focus:outline-none focus:ring-[1.5px] focus:ring-[#0097A7]/60"
        />
        <button
          onClick={handleAsk}
          disabled={loading || !goal.trim()}
          className="absolute bottom-1 right-1 top-1 inline-flex w-8 items-center justify-center rounded-md bg-[#0097A7] text-white transition-[transform,background-color] duration-150 hover:bg-[#00a9bb] active:scale-[0.96] disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
        </button>
      </div>
    </div>
  );
}

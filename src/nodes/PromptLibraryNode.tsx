import React, { useState, useEffect } from 'react';
import { Search, Tag, Plus, Loader2 } from 'lucide-react';
import { API_BASE } from '../constants';
import { authHeader } from '../lib/api';
import BaseNode from './BaseNode';

const PromptLibraryNode = ({ data, id }: any) => {
  const [prompts, setPrompts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);

  useEffect(() => {
    fetchPrompts();
  }, []);

  const fetchPrompts = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/prompts`, { headers: { ...authHeader() } });
      const result = await response.json();
      setPrompts(result);
    } catch (err) {
      console.error('Fetch Prompts Error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = (text: string) => {
    setSelectedPrompt(text);
    // In a real app, we'd update the node data to output this prompt
  };

  const filteredPrompts = prompts.filter(p => 
    p.text.toLowerCase().includes(search.toLowerCase()) || 
    p.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <BaseNode id={id} data={{ ...data, label: 'Prompt Library' }} inputs={false} outputs={true} className="border-amber-500">
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search prompts or tags..."
            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50"
          />
        </div>

        <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
            </div>
          ) : filteredPrompts.length > 0 ? (
            filteredPrompts.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p.text)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selectedPrompt === p.text 
                    ? 'bg-amber-500/10 border-amber-500/50 text-amber-200' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
                }`}
              >
                <p className="text-xs line-clamp-2 mb-2">{p.text}</p>
                <div className="flex flex-wrap gap-1">
                  {p.tags.map((tag: string, idx: number) => (
                    <span key={idx} className="px-1.5 py-0.5 bg-zinc-800 rounded text-[9px] text-zinc-500 flex items-center gap-1">
                      <Tag className="w-2 h-2" /> {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-zinc-600 text-xs italic">No prompts found</div>
          )}
        </div>

        <div className="pt-4 border-t border-zinc-800">
          <button className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-300 text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-2">
            <Plus className="w-3 h-3" /> Add Current Prompt
          </button>
        </div>
      </div>
    </BaseNode>
  );
};

export default PromptLibraryNode;

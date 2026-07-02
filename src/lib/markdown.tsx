/**
 * Shared lightweight markdown renderer for chat surfaces
 * (ChatDrawer + Chat Studio). Handles bold/italic/inline code,
 * headings, bullet lists, and fenced code blocks with a copy button.
 */
import React from 'react';
import { Copy, Check } from 'lucide-react';

export function parseInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i} className="italic">{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="rounded bg-white/10 px-1 font-mono text-[11px] text-[#0097A7]">{part.slice(1, -1)}</code>;
    return part;
  });
}

export function CodeCanvas({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="mb-1 mt-2 overflow-hidden rounded-xl ring-1 ring-white/10 bg-[#1c1c1e]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#111111] px-3 py-2">
        <span className="text-[11px] font-medium text-[#0097A7]">{label || 'Prompt'}</span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2 py-1 text-[11px] font-medium text-gray-400 transition-[transform,color,background-color] duration-150 hover:bg-white/10 hover:text-white active:scale-[0.96]"
        >
          {copied
            ? <><Check className="h-3 w-3 text-emerald-400" /><span className="text-emerald-400">Copied</span></>
            : <><Copy className="h-3 w-3" /><span>Copy</span></>}
        </button>
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap p-3 font-sans text-[12px] leading-relaxed text-gray-200">{code.trim()}</pre>
    </div>
  );
}

export function renderMarkdown(text: string): React.ReactNode {
  const segments = text.split(/(```[\w]*\n[\s\S]*?```)/g);
  return (
    <div className="space-y-0.5">
      {segments.map((seg, si) => {
        const fenceMatch = seg.match(/^```([\w]*)\n([\s\S]*?)```$/);
        if (fenceMatch) {
          const lang = fenceMatch[1];
          const code = fenceMatch[2];
          const label = lang === 'prompt' ? 'Prompt' : lang ? lang : 'Prompt';
          return <CodeCanvas key={si} code={code} label={label} />;
        }
        const lines = seg.split('\n');
        return lines.map((line, i) => {
          if (line.startsWith('### ')) return <p key={`${si}-${i}`} className="mb-0.5 mt-2 text-[13px] font-semibold text-white">{parseInline(line.slice(4))}</p>;
          if (line.startsWith('## ')) return <p key={`${si}-${i}`} className="mb-0.5 mt-2 text-[14px] font-semibold text-white">{parseInline(line.slice(3))}</p>;
          if (line.startsWith('# ')) return <p key={`${si}-${i}`} className="mb-0.5 mt-2 text-[15px] font-semibold text-white">{parseInline(line.slice(2))}</p>;
          if (line.startsWith('- ') || line.startsWith('* '))
            return (
              <p key={`${si}-${i}`} className="flex items-start gap-2">
                <span className="mt-0.5 leading-none text-[#0097A7]">•</span>
                <span>{parseInline(line.slice(2))}</span>
              </p>
            );
          if (/^\d+\. /.test(line)) return <p key={`${si}-${i}`}>{parseInline(line)}</p>;
          if (line.trim() === '') return <div key={`${si}-${i}`} className="h-2" />;
          return <p key={`${si}-${i}`}>{parseInline(line)}</p>;
        });
      })}
    </div>
  );
}

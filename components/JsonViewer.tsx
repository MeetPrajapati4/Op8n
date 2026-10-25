'use client';

import { memo, useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface JsonViewerProps {
  json: string | null;
}

function syntaxHighlight(json: string): string {
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          // JSON key
          return `<span class="json-key">${match}</span>`;
        }
        // String value
        return `<span class="json-string">${match}</span>`;
      }
      if (/true|false|null/.test(match)) {
        return `<span class="json-bool">${match}</span>`;
      }
      // Number
      return `<span class="json-number">${match}</span>`;
    }
  );
}

function JsonViewer({ json }: JsonViewerProps) {
  const highlighted = useMemo(() => {
    if (!json) return '';
    return syntaxHighlight(json);
  }, [json]);

  const jsonSizeKb = useMemo(() => {
    if (!json) return '0.0';
    return (new Blob([json]).size / 1024).toFixed(1);
  }, [json]);

  if (!json) return null;

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-xl border border-white/[0.07] overflow-hidden bg-[#060608]/90 shadow-inner [transform:translateZ(0)]">
      {/* File Header */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#0C0C0F]/90 backdrop-blur-md border-b border-white/[0.07] flex-shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FF6D5A]/80 shadow-[0_0_6px_rgba(255,109,90,0.5)]" />
          <span className="text-xs text-zinc-200 font-mono">workflow.json</span>
        </div>
        <span className="text-xs text-zinc-400 font-mono">
          {jsonSizeKb} KB
        </span>
      </div>

      {/* Scrollable code block using shadcn ScrollArea */}
      <ScrollArea className="flex-1 w-full p-3.5 sm:p-4" data-lenis-prevent="true">
        <pre
          className="text-xs font-mono leading-relaxed [contain:content] [transform:translateZ(0)]"
          style={{ fontFamily: 'var(--font-geist-mono), monospace' }}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </ScrollArea>

      <style jsx global>{`
        .json-key {
          color: #60a5fa;
        }
        .json-string {
          color: #34d399;
        }
        .json-number {
          color: #fbbf24;
        }
        .json-bool {
          color: #f472b6;
        }
      `}</style>
    </div>
  );
}

export default memo(JsonViewer);

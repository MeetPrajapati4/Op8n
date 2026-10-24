'use client';

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

export default function JsonViewer({ json }: JsonViewerProps) {
  if (!json) return null;

  const highlighted = syntaxHighlight(json);

  return (
    <div className="flex flex-col flex-1 min-h-0 rounded-lg border border-[#2e2e35] overflow-hidden bg-[#0d0d0f]">
      {/* File Header */}
      <div className="flex items-center justify-between px-3.5 py-1.5 bg-[#141416] border-b border-[#2e2e35] flex-shrink-0 select-none">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
          <span className="text-xs text-zinc-400 font-mono">workflow.json</span>
        </div>
        <span className="text-[11px] text-zinc-600 font-mono">
          {(new Blob([json]).size / 1024).toFixed(1)} KB
        </span>
      </div>

      {/* Scrollable code block using shadcn ScrollArea */}
      <ScrollArea className="flex-1 w-full p-4">
        <pre
          className="text-xs font-mono leading-relaxed"
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

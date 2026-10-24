'use client';

export default function Footer() {
  return (
    <footer className="h-8 px-4 md:px-6 border-t border-[#2e2e35] bg-[#0e0e10] flex items-center justify-between text-[11px] text-zinc-500 flex-shrink-0 select-none">
      <div className="truncate max-w-[70%]">
        <span>Op8n is an independent tool and is not affiliated with or endorsed by n8n GmbH.</span>
      </div>
      <div className="flex items-center gap-3 text-zinc-500 flex-shrink-0">
        <span>Original core by Puneeth Raj (MIT)</span>
        <span className="text-zinc-700">&bull;</span>
        <span className="font-mono text-zinc-400">v0.1.0</span>
      </div>
    </footer>
  );
}

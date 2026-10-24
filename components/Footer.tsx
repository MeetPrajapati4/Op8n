'use client';

import Image from 'next/image';
import { Sparkles, Terminal, Heart, ExternalLink } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="h-9 px-3 md:px-6 border-t border-[#27272a] bg-[#0c0c0e] flex items-center justify-between text-[11px] text-zinc-400 flex-shrink-0 select-none z-10">
      {/* Left: Brand, Live Engine Status & Disclaimer */}
      <div className="flex items-center gap-2.5 truncate max-w-[65%] sm:max-w-[70%]">
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <div className="relative w-3.5 h-3.5 rounded-sm overflow-hidden flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Op8n"
              width={14}
              height={14}
              className="w-full h-full object-contain"
            />
          </div>
          <span className="font-semibold text-zinc-300">Op8n</span>
        </div>

        <span className="text-zinc-700 hidden sm:inline">&bull;</span>

        {/* Live Engine Indicator */}
        <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-950/60 border border-emerald-800/40 text-[10px] text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Fast Engine (~3.5s)</span>
        </div>

        <span className="text-zinc-700 hidden md:inline">&bull;</span>

        {/* Legal Disclaimer */}
        <span className="truncate text-zinc-500 hidden md:inline">
          Independent open-source tool &bull; Not affiliated with or endorsed by n8n GmbH
        </span>
      </div>

      {/* Center Pro-Tip (Visible on Large Screens) */}
      <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-zinc-400 bg-[#18181b] border border-[#27272a] px-2.5 py-0.5 rounded-md">
        <Terminal className="w-3 h-3 text-[#FF6D5A]" />
        <span>Import to n8n canvas: hit <kbd className="px-1 py-0.2 bg-[#27272a] rounded text-[10px] text-zinc-200 font-mono">Ctrl+V</kbd></span>
      </div>

      {/* Right: Attribution, License & Version */}
      <div className="flex items-center gap-2.5 sm:gap-3 text-zinc-400 flex-shrink-0">
        <div className="hidden sm:inline-flex items-center gap-1 text-zinc-400 hover:text-zinc-200 transition-colors">
          <span>Original core by</span>
          <span className="font-medium text-zinc-300">Puneeth Raj</span>
          <span className="text-[10px] text-zinc-500 font-mono">(MIT)</span>
        </div>

        <span className="text-zinc-700 hidden sm:inline">&bull;</span>

        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#18181b] border border-[#2e2e35] font-mono text-[10px] text-zinc-300 font-semibold">
          v0.1.0
        </span>
      </div>
    </footer>
  );
}

'use client';

import Image from 'next/image';
import { Settings, History } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  historyCount?: number;
}

export default function Header({
  onOpenSettings,
  onOpenHistory,
  historyCount = 0,
}: HeaderProps) {
  return (
    <header className="h-16 px-4 md:px-6 border-b border-[#2e2e35] bg-[#111113] flex items-center justify-between flex-shrink-0 select-none">
      <div className="flex items-center gap-3">
        <div className="relative w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#18181b] to-[#27272a] border border-[#2e2e35] p-1">
          <Image
            src="/logo.png"
            alt="Op8n Logo"
            width={32}
            height={32}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span
              className="text-xl font-bold tracking-tight text-white"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Op8n
            </span>
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-semibold bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white uppercase tracking-wider">
              Studio
            </span>
          </div>
          <p className="hidden md:block text-xs text-zinc-400">
            Describe any automation in plain English → get importable n8n JSON
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenHistory}
          className="relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#2e2e35] bg-[#18181b] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF6D5A]"
          title="Workflow History & Backups"
        >
          <History className="w-3.5 h-3.5 text-zinc-400" />
          <span>History</span>
          {historyCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-[#27272a] text-zinc-300 border border-[#3f3f46]">
              {historyCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#2e2e35] bg-[#18181b] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF6D5A]"
          title="Provider & API Key Settings"
        >
          <Settings className="w-3.5 h-3.5 text-zinc-400" />
          <span>Settings</span>
        </button>
      </div>
    </header>
  );
}

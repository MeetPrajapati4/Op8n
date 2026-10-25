'use client';

import Image from 'next/image';
import { motion } from 'framer-motion';
import { Sliders, History, Sparkles, ShieldCheck, Plus } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenHistory: () => void;
  onNewSession?: () => void;
  historyCount?: number;
  activeMode?: 'studio' | 'audit';
  onModeChange?: (mode: 'studio' | 'audit') => void;
}

export default function Header({
  onOpenSettings,
  onOpenHistory,
  onNewSession,
  historyCount = 0,
  activeMode = 'studio',
  onModeChange,
}: HeaderProps) {
  return (
    <header className="h-14 px-4 md:px-6 border-b border-white/[0.07] bg-[#0C0C0F]/80 backdrop-blur-xl flex items-center justify-between flex-shrink-0 select-none z-30 gap-4 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.04)]">
      {/* Left Branding */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <motion.div
          whileHover={{ scale: 1.05, rotate: 2 }}
          whileTap={{ scale: 0.95 }}
          className="relative w-7 h-7 rounded-lg overflow-hidden flex items-center justify-center bg-gradient-to-br from-[#16161b] to-[#202028] border border-white/[0.08] p-1 shadow-sm flex-shrink-0 cursor-pointer"
        >
          <Image
            src="/logo.png"
            alt="Op8n Logo"
            width={28}
            height={28}
            className="w-full h-full object-contain"
            priority
          />
        </motion.div>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="text-sm font-bold tracking-tight text-white leading-none"
              style={{ fontFamily: 'var(--font-syne)' }}
            >
              Op8n
            </span>
            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] text-white uppercase tracking-wider shadow-sm shadow-[#0387FE]/25">
              Studio
            </span>
          </div>
          <span className="hidden xl:inline-block h-3.5 w-px bg-white/[0.1]" />
          <span className="hidden xl:inline text-xs text-zinc-300 font-normal truncate">
            Describe any automation in plain English → get importable n8n JSON
          </span>
        </div>
      </div>

      {/* Center Segmented Mode Switcher (Studio vs Audit & Explain) */}
      {onModeChange && (
        <nav
          aria-label="Mode Switcher"
          className="relative flex items-center p-0.5 rounded-full bg-[#111116] border border-white/[0.08] shadow-inner flex-shrink-0"
        >
          <button
            type="button"
            onClick={() => onModeChange('studio')}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer focus:outline-none focus-visible:ring-0 outline-none select-none transition-colors duration-150 ${
              activeMode === 'studio' ? 'text-white font-semibold' : 'text-zinc-300 hover:text-white'
            }`}
          >
            {activeMode === 'studio' && (
              <motion.div
                layoutId="header-active-pill"
                className="absolute inset-0 bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] rounded-full shadow-[0_2px_14px_rgba(3,135,254,0.4)]"
                transition={{ type: 'spring', stiffness: 480, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Studio</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => onModeChange('audit')}
            className={`relative inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer focus:outline-none focus-visible:ring-0 outline-none select-none transition-colors duration-150 ${
              activeMode === 'audit' ? 'text-white font-semibold' : 'text-zinc-300 hover:text-white'
            }`}
          >
            {activeMode === 'audit' && (
              <motion.div
                layoutId="header-active-pill"
                className="absolute inset-0 bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] rounded-full shadow-[0_2px_14px_rgba(3,135,254,0.4)]"
                transition={{ type: 'spring', stiffness: 480, damping: 32 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Audit &amp; Explain</span>
              <span className="sm:hidden">Audit</span>
            </span>
          </button>
        </nav>
      )}

      {/* Right Action Bar */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-1 min-w-0">
        {onNewSession && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.12 }}
            onClick={onNewSession}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-[#01B6FE]/15 hover:bg-[#01B6FE]/25 border border-[#01B6FE]/40 hover:border-[#01B6FE]/70 text-white transition-all duration-150 cursor-pointer shadow-sm focus:outline-none focus:border-[#01B6FE]/50 focus:ring-4 focus:ring-[#01B6FE]/15 hover:-translate-y-[1px] active:translate-y-0 will-change-transform flex-shrink-0"
            title="Start a new blank workflow session (Alt+N)"
          >
            <Plus className="w-3.5 h-3.5 text-[#02F7C8]" />
            <span className="hidden sm:inline">New Session</span>
            <kbd className="hidden lg:inline text-[10px] font-mono ml-1 px-1.5 py-0.5 rounded bg-[#01B6FE]/25 text-white font-semibold border border-[#01B6FE]/30">
              Alt+N
            </kbd>
          </motion.button>
        )}

        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.12 }}
          onClick={onOpenHistory}
          className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/[0.15] text-zinc-200 hover:text-white transition-all duration-150 cursor-pointer shadow-sm focus:outline-none focus:border-[#01B6FE]/50 focus:ring-4 focus:ring-[#01B6FE]/15 hover:-translate-y-[1px] active:translate-y-0 will-change-transform flex-shrink-0"
          title="Workflow History & Backups"
        >
          <History className="w-3.5 h-3.5 text-zinc-300" />
          <span className="hidden sm:inline">History</span>
          {historyCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[#01B6FE]/20 text-[#01B6FE] border border-[#01B6FE]/35 shadow-xs">
              {historyCount}
            </span>
          )}
        </motion.button>

        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={{ duration: 0.12 }}
          onClick={onOpenSettings}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.08] hover:border-white/[0.15] text-zinc-200 hover:text-white transition-all duration-150 cursor-pointer shadow-sm focus:outline-none focus:border-[#01B6FE]/50 focus:ring-4 focus:ring-[#01B6FE]/15 hover:-translate-y-[1px] active:translate-y-0 will-change-transform flex-shrink-0"
          title="Workflow Engine Preferences & Models"
        >
          <Sliders className="w-3.5 h-3.5 text-zinc-300" />
          <span className="hidden sm:inline">Preferences</span>
        </motion.button>
      </div>
    </header>
  );
}

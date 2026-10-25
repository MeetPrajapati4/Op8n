'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Server, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function SettingsPage() {
  const [status, setStatus] = useState<{
    status: string;
    cloudEngineActive: boolean;
    provider: string | null;
    model: string | null;
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/status', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setStatus(data);
        setLoading(false);
      })
      .catch(() => {
        setStatus({
          status: 'error',
          cloudEngineActive: false,
          provider: null,
          model: null,
          message: 'Unable to query backend status',
        });
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-[#070709] text-zinc-100 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg flex flex-col items-center text-center gap-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-white/[0.08] bg-[#141416] text-xs font-medium text-zinc-200 hover:text-white hover:border-[#FF6D5A] transition-all duration-150 hover:-translate-y-[1px] active:scale-[0.98]"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Return to Studio</span>
        </Link>

        <div className="w-full p-5 sm:p-6 rounded-2xl bg-[#0C0C0F]/85 backdrop-blur-xl border border-white/[0.08] flex flex-col gap-4 text-left shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
          <div className="flex items-center gap-3.5 pb-3.5 border-b border-white/[0.07]">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#FF6D5A]/20 to-[#EE4F7B]/20 border border-[#FF6D5A]/30 flex items-center justify-center">
              <Server className="w-5 h-5 text-[#FF6D5A]" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Vercel Serverless Architecture</h2>
              <p className="text-xs text-zinc-400">Server-Only Environment Configuration</p>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="p-3 rounded-xl bg-[#141416]/90 border border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-zinc-300">Engine Status</span>
              {loading ? (
                <span className="text-zinc-400">Checking…</span>
              ) : status?.cloudEngineActive ? (
                <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Cloud Engine Active</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-amber-400 font-medium">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Unconfigured</span>
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-[#141416]/90 border border-white/[0.06] flex items-center justify-between text-xs">
              <span className="text-zinc-400">Security Mode</span>
              <span className="text-zinc-200 font-mono flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Client Keys</span>
              </span>
            </div>

            {status?.provider && (
              <div className="p-3 rounded-xl bg-[#141416]/90 border border-white/[0.06] flex items-center justify-between text-xs">
                <span className="text-zinc-400">Active Provider</span>
                <span className="text-[#FF6D5A] font-mono font-semibold uppercase">
                  {status.provider}
                </span>
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-[#060608]/90 border border-white/[0.06] text-xs text-zinc-300 leading-relaxed">
            API keys are configured strictly via Vercel server-only environment variables (<code>AI_API_KEY</code>). Plaintext credentials never touch client bundles, browser storage, or network payloads.
          </div>
        </div>
      </div>
    </div>
  );
}

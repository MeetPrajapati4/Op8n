'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Server, ExternalLink, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { N8nWorkflow } from '@/lib/n8n-types';
import { getStoredPreferences, saveStoredPreferences } from '@/lib/settings';

interface DeployDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: N8nWorkflow | null;
}

export default function DeployDialog({
  open,
  onOpenChange,
  workflow,
}: DeployDialogProps) {
  const [n8nUrl, setN8nUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isDeploying, setIsDeploying] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const prefs = getStoredPreferences();
      if (prefs.n8nBaseUrl) setN8nUrl(prefs.n8nBaseUrl);
      if (prefs.n8nApiKey) setApiKey(prefs.n8nApiKey);
      setCreatedUrl(null);
      setDeployError(null);
    }
  }, [open]);

  if (!workflow) return null;

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!n8nUrl.trim() || !apiKey.trim() || isDeploying) return;

    setIsDeploying(true);
    setDeployError(null);
    setCreatedUrl(null);

    // Save credentials to local preferences for next time
    const prefs = getStoredPreferences();
    saveStoredPreferences({
      ...prefs,
      n8nBaseUrl: n8nUrl.trim(),
      n8nApiKey: apiKey.trim(),
    });

    try {
      const res = await fetch('/api/n8n/deploy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          n8nUrl: n8nUrl.trim(),
          apiKey: apiKey.trim(),
          workflow,
        }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Deployment failed');
      }

      setCreatedUrl(data.workflowUrl);
      toast.success('Workflow pushed to your n8n instance!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to deploy';
      setDeployError(msg);
      toast.error(msg);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[94vw] sm:max-w-[520px] max-h-[90vh] overflow-y-auto no-scrollbar bg-[#0C0C0F]/95 backdrop-blur-2xl border border-white/[0.12] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_25px_50px_-12px_rgba(0,0,0,0.85)] rounded-2xl text-zinc-100 p-6 sm:p-7 smooth-scroll-momentum"
        data-lenis-prevent="true"
      >
        <DialogHeader className="pb-1 border-b border-white/[0.08]">
          <DialogTitle className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2.5">
            <Server className="w-4 h-4 text-[#01B6FE]" />
            Send to my n8n Instance
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-zinc-200 mt-1 leading-relaxed">
            Deploy this workflow directly to your self-hosted or cloud n8n workspace via official API.
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3.5 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-[0_0_20px_rgba(52,211,153,0.35)]">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Deployed Successfully!</h4>
              <p className="text-xs sm:text-sm text-zinc-200 mt-1">
                Your workflow &ldquo;{workflow.name}&rdquo; was created in n8n.
              </p>
            </div>
            <a
              href={createdUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] hover:brightness-110 text-white shadow-[0_0_20px_rgba(3,135,254,0.35)] transition-all duration-150 hover:-translate-y-[1px] active:scale-[0.98]"
            >
              <span>Open in n8n Canvas</span>
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <form onSubmit={handleDeploy} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-2">
              <label className="text-xs sm:text-sm font-semibold text-white">
                n8n Instance URL
              </label>
              <input
                type="url"
                value={n8nUrl}
                onChange={(e) => setN8nUrl(e.target.value)}
                placeholder="https://n8n.yourcompany.com"
                required
                className="w-full h-11 px-3.5 py-2.5 rounded-xl bg-[#181820] border border-white/[0.15] text-xs sm:text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:border-[#01B6FE]/60 focus:ring-4 focus:ring-[#01B6FE]/20 transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs sm:text-sm font-semibold text-white">
                n8n API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Generate in n8n Settings → API"
                required
                className="w-full h-11 px-3.5 py-2.5 rounded-xl bg-[#181820] border border-white/[0.15] text-xs sm:text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:border-[#01B6FE]/60 focus:ring-4 focus:ring-[#01B6FE]/20 transition-all duration-200"
              />
            </div>

            {deployError && (
              <div className="p-3 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-2.5 text-xs sm:text-sm text-red-200">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="leading-snug">{deployError}</p>
              </div>
            )}

            <div className="p-3 rounded-xl bg-[#121217] border border-white/[0.12] text-xs sm:text-sm text-zinc-200 leading-relaxed">
              <strong className="text-white font-semibold">SSRF Protected:</strong> Loopback &amp; local private networks are rejected by default for safety.
            </div>

            <div className="flex justify-end gap-2.5 mt-2 pt-2 border-t border-white/[0.08]">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onOpenChange(false)}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-white/[0.15] bg-white/[0.06] hover:bg-white/[0.12] text-zinc-100 hover:text-white transition-all duration-150 cursor-pointer"
              >
                Cancel
              </motion.button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                disabled={!n8nUrl.trim() || !apiKey.trim() || isDeploying}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] hover:brightness-110 text-white shadow-[0_0_22px_rgba(3,135,254,0.45)] disabled:opacity-40 disabled:shadow-none transition-all duration-150 cursor-pointer flex items-center gap-2"
              >
                {isDeploying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deploying…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-[#02F7C8]" />
                    <span>Deploy Workflow</span>
                  </>
                )}
              </motion.button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

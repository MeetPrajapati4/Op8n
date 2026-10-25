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
        className="w-[92vw] sm:max-w-[460px] max-h-[88vh] overflow-y-auto bg-[#0C0C0F]/95 backdrop-blur-2xl border border-white/[0.08] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_25px_50px_-12px_rgba(0,0,0,0.7)] rounded-2xl text-zinc-100 p-5 sm:p-6 smooth-scroll-momentum"
        data-lenis-prevent="true"
      >
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold tracking-tight text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-[#01B6FE]" />
            Send to my n8n Instance
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Deploy this workflow directly to your self-hosted or cloud n8n workspace via official API.
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="flex flex-col items-center justify-center py-5 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(52,211,153,0.3)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Deployed Successfully!</h4>
              <p className="text-xs text-zinc-300 mt-1">
                Your workflow &ldquo;{workflow.name}&rdquo; was created in n8n.
              </p>
            </div>
            <a
              href={createdUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] hover:brightness-110 text-white shadow-[0_0_20px_rgba(3,135,254,0.35)] transition-all duration-150 hover:-translate-y-[1px] active:scale-[0.98]"
            >
              <span>Open in n8n Canvas</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <form onSubmit={handleDeploy} className="flex flex-col gap-3 mt-1.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-200">
                n8n Instance URL
              </label>
              <input
                type="url"
                value={n8nUrl}
                onChange={(e) => setN8nUrl(e.target.value)}
                placeholder="https://n8n.yourcompany.com"
                required
                className="w-full px-3 py-2 rounded-xl bg-[#060608]/90 border border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#01B6FE]/50 focus:ring-4 focus:ring-[#01B6FE]/15 transition-all duration-200"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-200">
                n8n API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Generate in n8n Settings → API"
                required
                className="w-full px-3 py-2 rounded-xl bg-[#060608]/90 border border-white/[0.08] text-xs text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:border-[#01B6FE]/50 focus:ring-4 focus:ring-[#01B6FE]/15 transition-all duration-200"
              />
            </div>

            {deployError && (
              <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 flex items-start gap-2 text-xs text-red-300">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="leading-snug">{deployError}</p>
              </div>
            )}

            <div className="p-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-xs text-zinc-300 leading-relaxed">
              <strong className="text-zinc-100">SSRF Protected:</strong> Loopback &amp; local private networks are rejected by default for safety.
            </div>

            <div className="flex justify-end gap-2 mt-1.5">
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => onOpenChange(false)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-medium border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-zinc-200 hover:text-white transition-all duration-150 cursor-pointer"
              >
                Cancel
              </motion.button>
              <motion.button
                type="submit"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                disabled={!n8nUrl.trim() || !apiKey.trim() || isDeploying}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] hover:brightness-110 text-white shadow-[0_0_20px_rgba(3,135,254,0.35)] disabled:opacity-40 disabled:shadow-none transition-all duration-150 cursor-pointer flex items-center gap-2"
              >
                {isDeploying ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deploying…</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
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

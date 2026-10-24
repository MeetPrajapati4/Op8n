'use client';

import { useState, useEffect } from 'react';
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
      <DialogContent className="sm:max-w-[460px] bg-[#18181b] border-[#2e2e35] text-zinc-100">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <Server className="w-4 h-4 text-[#FF6D5A]" />
            Send to my n8n Instance
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400">
            Deploy this workflow directly to your self-hosted or cloud n8n workspace via official API.
          </DialogDescription>
        </DialogHeader>

        {createdUrl ? (
          <div className="flex flex-col items-center justify-center py-6 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-white">Deployed Successfully!</h4>
              <p className="text-xs text-zinc-400 mt-1">
                Your workflow &ldquo;{workflow.name}&rdquo; was created in n8n.
              </p>
            </div>
            <a
              href={createdUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white hover:opacity-90 transition-opacity"
            >
              <span>Open in n8n Canvas</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ) : (
          <form onSubmit={handleDeploy} className="flex flex-col gap-3 mt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300">
                n8n Instance URL
              </label>
              <input
                type="url"
                value={n8nUrl}
                onChange={(e) => setN8nUrl(e.target.value)}
                placeholder="https://n8n.yourcompany.com"
                required
                className="w-full px-3 py-2 rounded-lg bg-[#111113] border border-[#2e2e35] text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF6D5A]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300">
                n8n API Key
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Generate in n8n Settings → API"
                required
                className="w-full px-3 py-2 rounded-lg bg-[#111113] border border-[#2e2e35] text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF6D5A]"
              />
            </div>

            {deployError && (
              <div className="p-2.5 rounded-lg bg-red-950/40 border border-red-900/50 flex items-start gap-2 text-xs text-red-300">
                <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="leading-snug">{deployError}</p>
              </div>
            )}

            <div className="p-2.5 rounded-lg bg-[#111113] border border-[#2e2e35] text-[11px] text-zinc-400">
              <strong className="text-zinc-200">SSRF Protected:</strong> Loopback &amp; local private networks are rejected by default for safety.
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-[#2e2e35] text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!n8nUrl.trim() || !apiKey.trim() || isDeploying}
                className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5"
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
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

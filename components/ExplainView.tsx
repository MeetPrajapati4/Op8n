'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  CheckCircle2,
  FileCode2,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  getUserApiKey,
  getUserProvider,
  getUserActiveModel,
  purgeUserApiKey,
} from '@/lib/client/user-keys';

interface ExplainViewProps {
  activeWorkflowJson?: string | null;
}

interface AnalysisResult {
  title: string;
  summary: string;
  trigger: string;
  steps: Array<{ node: string; role: string }>;
  securityFindings: Array<{ level: 'info' | 'warning' | 'critical'; message: string }>;
  reliabilityFindings: Array<{ level: 'info' | 'warning' | 'critical'; message: string }>;
  recommendations: string[];
}

const SAMPLE_WORKFLOW = JSON.stringify(
  {
    name: 'Sample Shopify to Slack with DB',
    nodes: [
      {
        id: 'node-1',
        name: 'Shopify Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 1,
        position: [250, 300],
        parameters: { path: 'order-create' },
      },
      {
        id: 'node-2',
        name: 'Transform Payload',
        type: 'n8n-nodes-base.code',
        typeVersion: 1,
        position: [470, 300],
        parameters: { jsCode: 'return items;' },
      },
      {
        id: 'node-3',
        name: 'Postgres Record',
        type: 'n8n-nodes-base.postgres',
        typeVersion: 1,
        position: [690, 300],
        parameters: { operation: 'insert' },
      },
      {
        id: 'node-4',
        name: 'Slack Alert',
        type: 'n8n-nodes-base.slack',
        typeVersion: 1,
        position: [910, 300],
        parameters: { channel: '#orders', text: 'New order received' },
      },
    ],
    connections: {
      'Shopify Webhook': {
        main: [[{ node: 'Transform Payload', type: 'main', index: 0 }]],
      },
      'Transform Payload': {
        main: [[{ node: 'Postgres Record', type: 'main', index: 0 }]],
      },
      'Postgres Record': {
        main: [[{ node: 'Slack Alert', type: 'main', index: 0 }]],
      },
    },
    active: false,
    settings: {},
    tags: [],
  },
  null,
  2
);

export default function ExplainView({ activeWorkflowJson }: ExplainViewProps) {
  const [jsonInput, setJsonInput] = useState(activeWorkflowJson || '');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [mobileTab, setMobileTab] = useState<'input' | 'audit'>('input');

  useEffect(() => {
    if (activeWorkflowJson && !jsonInput) {
      setJsonInput(activeWorkflowJson);
    }
  }, [activeWorkflowJson]);

  const handleAnalyze = async () => {
    if (!jsonInput.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysis(null);

    const userKey = getUserApiKey();
    const userProvider = getUserProvider();
    const userModel = getUserActiveModel();

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(userKey
            ? {
                'x-user-api-key': userKey,
                'x-user-provider': userProvider,
                'x-user-model': userModel,
              }
            : {}),
        },
        body: JSON.stringify({ workflowJson: jsonInput.trim() }),
      });

      const data = await res.json();

      if (res.status === 401 || (data.error && data.error.toLowerCase().includes('api key'))) {
        // Auto-purge invalid/expired key
        purgeUserApiKey();
        toast.error('API key expired or invalid. Key purged. Please reconnect in Preferences.');
        return;
      }

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to analyze workflow');
      }

      setAnalysis(data.analysis);
      setMobileTab('audit');
      if (data.autoRecovered && data.modelUsed) {
        toast.success(`Workflow audited successfully! (Auto-optimized with ${data.modelUsed})`);
      } else {
        toast.success('Workflow audited and explained!');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      toast.error(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const inputPanel = (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0C0C0F]/85 backdrop-blur-xl p-4 sm:p-5 lg:p-6 flex flex-col h-full overflow-hidden shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] gap-3 min-w-0 min-h-0">
      <div className="flex items-start justify-between gap-2 flex-shrink-0">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold tracking-tight text-white">
            Audit &amp; Explain Workflow
          </h3>
          <p className="text-xs text-zinc-300 truncate">
            Security, structure, and reliability analysis for n8n JSON
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {activeWorkflowJson && (
            <button
              type="button"
              onClick={() => {
                setJsonInput(activeWorkflowJson);
                setMobileTab('input');
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#01B6FE]/40 bg-[#01B6FE]/10 text-sky-300 hover:text-white hover:bg-[#01B6FE]/20 transition-all duration-150 ease-out cursor-pointer hover:-translate-y-[1px] active:translate-y-0 flex-shrink-0"
            >
              Use Active
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setJsonInput(SAMPLE_WORKFLOW);
              setMobileTab('input');
            }}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] text-zinc-200 hover:text-white transition-all duration-150 ease-out cursor-pointer hover:-translate-y-[1px] active:translate-y-0 flex-shrink-0"
          >
            Load Sample
          </button>
        </div>
      </div>

      {/* Clean Monospace JSON input */}
      <textarea
        value={jsonInput}
        onChange={(e) => setJsonInput(e.target.value)}
        placeholder="Paste full n8n workflow JSON here…"
        className="flex-1 w-full rounded-xl bg-[#060608]/90 shadow-inner border border-white/[0.12] text-xs sm:text-sm font-mono text-zinc-100 placeholder:text-zinc-400 p-3.5 sm:p-4 resize-none focus:outline-none focus:border-[#01B6FE]/60 focus:ring-4 focus:ring-[#01B6FE]/20 transition-all duration-200 leading-relaxed min-h-0"
        disabled={isAnalyzing}
      />

      <motion.button
        type="button"
        onClick={handleAnalyze}
        disabled={!jsonInput.trim() || isAnalyzing}
        whileHover={{ scale: !jsonInput.trim() || isAnalyzing ? 1 : 1.01 }}
        whileTap={{ scale: !jsonInput.trim() || isAnalyzing ? 1 : 0.99 }}
        transition={{ duration: 0.15 }}
        className="py-3 px-5 rounded-xl font-bold text-xs sm:text-sm text-white disabled:bg-[#121217] disabled:text-zinc-400 disabled:border-white/[0.08] disabled:shadow-none disabled:cursor-not-allowed bg-gradient-to-r from-[#01B6FE] via-[#0387FE] to-[#7501FD] shadow-[0_0_25px_-5px_rgba(3,135,254,0.45)] hover:shadow-[0_0_32px_-2px_rgba(117,1,253,0.65)] hover:brightness-110 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer"
      >
        {isAnalyzing ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            <span>Auditing &amp; Explaining…</span>
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4" />
            <span>Audit &amp; Explain Workflow</span>
          </>
        )}
      </motion.button>
    </div>
  );

  const outputPanel = (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0C0C0F]/85 backdrop-blur-xl p-4 sm:p-5 lg:p-6 flex flex-col h-full overflow-hidden shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] min-w-0 min-h-0">
      <AnimatePresence mode="wait">
        {analysis ? (
          <motion.div
            key="audit-report"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="h-full flex flex-col min-h-0 flex-1 overflow-hidden min-w-0"
          >
            <ScrollArea
              className="flex-1 min-h-0 h-full w-full pr-2 sm:pr-3.5 custom-scrollbar smooth-scroll-momentum"
              data-lenis-prevent="true"
            >
              <div className="flex flex-col gap-4 pb-6 overscroll-contain">
                {/* Header card */}
                <div className="p-4 rounded-xl bg-[#141416]/90 border border-white/[0.08] flex flex-col gap-2 shadow-sm min-w-0">
                  <span className="text-xs uppercase tracking-wider font-bold text-[#01B6FE]">
                    Workflow Summary
                  </span>
                  <h3 className="text-sm font-bold text-white tracking-tight leading-snug break-words">
                    {analysis.title}
                  </h3>
                  <p className="text-xs text-zinc-200 leading-relaxed break-words">
                    {analysis.summary}
                  </p>
                  <div className="mt-1 pt-2.5 border-t border-white/[0.07] text-xs text-zinc-200 flex items-center gap-2 flex-wrap">
                    <span className="text-zinc-200 font-semibold">Trigger:</span>
                    <span className="px-2 py-0.5 rounded bg-[#02F7C8]/15 border border-[#02F7C8]/30 text-[#02F7C8] font-mono text-xs font-semibold break-all">
                      {analysis.trigger}
                    </span>
                  </div>
                </div>

                {/* Execution Flow Steps */}
                <div className="flex flex-col gap-2.5 min-w-0">
                  <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[#01B6FE]" />
                    Execution Flow Breakdown
                  </span>
                  <div className="flex flex-col gap-2">
                    {analysis.steps.map((step, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-[#141416]/90 border border-white/[0.08] flex items-start gap-3 transition-colors duration-150 hover:border-[#01B6FE]/40 min-w-0"
                      >
                        <span className="w-5 h-5 rounded-full bg-[#27272a] text-zinc-200 flex items-center justify-center font-bold text-xs flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="font-semibold text-xs text-zinc-100 break-words">
                            {step.node}
                          </span>
                          <span className="text-zinc-300 text-xs leading-relaxed break-words">
                            {step.role}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Security & Reliability Audit */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 min-w-0">
                  {/* Security */}
                  <div className="p-3 rounded-xl bg-[#141416]/90 border border-white/[0.08] flex flex-col gap-2 min-w-0">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      Security Audit
                    </span>
                    <div className="flex flex-col gap-2">
                      {analysis.securityFindings.map((f, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-[#1c1c20] text-xs text-zinc-200 leading-relaxed border border-white/[0.04] break-words"
                        >
                          {f.message}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Reliability */}
                  <div className="p-3 rounded-xl bg-[#141416]/90 border border-white/[0.08] flex flex-col gap-2 min-w-0">
                    <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      Reliability &amp; Errors
                    </span>
                    <div className="flex flex-col gap-2">
                      {analysis.reliabilityFindings.map((f, i) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-lg bg-[#1c1c20] text-xs text-zinc-200 leading-relaxed border border-white/[0.04] break-words"
                        >
                          {f.message}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Recommendations */}
                <div className="p-3 rounded-xl bg-[#141416]/90 border border-white/[0.08] flex flex-col gap-2 min-w-0">
                  <span className="text-xs font-semibold text-zinc-200 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                    Architect Recommendations
                  </span>
                  <ul className="flex flex-col gap-2 text-xs text-zinc-200">
                    {analysis.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2.5 leading-relaxed break-words">
                        <span className="text-[#01B6FE] font-bold mt-0.5 flex-shrink-0">&bull;</span>
                        <span className="break-words">{rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScrollArea>
          </motion.div>
        ) : (
          <motion.div
            key="audit-placeholder"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center justify-center flex-1 text-center gap-3 bg-[radial-gradient(#ffffff12_1px,transparent_1px)] [background-size:20px_20px] rounded-xl h-full"
          >
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-white/[0.07] to-transparent border border-white/[0.08] shadow-2xl flex items-center justify-center text-zinc-300 animate-pulse">
              <FileCode2 className="w-7 h-7 stroke-1 text-[#01B6FE]" />
            </div>
            <div className="flex flex-col gap-1.5 max-w-sm px-4">
              <h4 className="text-sm font-semibold text-zinc-100">No workflow audited yet</h4>
              <p className="text-zinc-300 text-xs leading-relaxed">
                Paste any n8n workflow JSON on the left to receive an instant security, architecture, and reliability audit.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="h-full w-full max-w-[1920px] mx-auto min-h-0 flex flex-col overflow-hidden">
      {/* Mobile View: Two Tabs (< 768px) */}
      <div className="md:hidden h-full flex flex-col min-h-0 overflow-hidden">
        <Tabs
          value={mobileTab}
          onValueChange={(val) => setMobileTab(val as 'input' | 'audit')}
          className="h-full flex flex-col min-h-0"
        >
          <TabsList className="grid grid-cols-2 w-full mb-3 flex-shrink-0 bg-[#111116] border border-white/[0.07] p-1 rounded-xl">
            <TabsTrigger value="input">JSON Input</TabsTrigger>
            <TabsTrigger value="audit">
              Audit Report {analysis ? '✓' : ''}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="input" className="flex-1 min-h-0 mt-0">
            {inputPanel}
          </TabsContent>

          <TabsContent value="audit" className="flex-1 min-h-0 mt-0 flex flex-col">
            {outputPanel}
          </TabsContent>
        </Tabs>
      </div>

      {/* Desktop View: Two-Column Side-by-Side (>= 768px) */}
      <div className="hidden md:grid md:grid-cols-2 gap-4 lg:gap-6 h-full w-full overflow-hidden min-h-0 flex-1 px-1">
        {inputPanel}
        {outputPanel}
      </div>
    </div>
  );
}

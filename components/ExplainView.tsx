'use client';

import { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Zap,
  Activity,
  CheckCircle2,
  FileCode2,
  Lightbulb,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { N8nWorkflow } from '@/lib/n8n-types';

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

  const handleAnalyze = async () => {
    if (!jsonInput.trim() || isAnalyzing) return;

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowJson: jsonInput.trim() }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || 'Failed to analyze workflow');
      }

      setAnalysis(data.analysis);
      toast.success('Workflow audited and explained!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Analysis failed';
      toast.error(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6 h-full max-w-7xl mx-auto overflow-hidden">
      {/* Left: Input Editor */}
      <div className="rounded-xl border border-[#2e2e35] bg-[#18181b] p-5 flex flex-col h-full overflow-hidden shadow-lg gap-3">
        <div className="flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-white">Paste n8n Workflow JSON</h3>
            <p className="text-[11px] text-zinc-400">
              Audit any community, template, or production n8n workflow
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeWorkflowJson && (
              <button
                type="button"
                onClick={() => setJsonInput(activeWorkflowJson)}
                className="text-[11px] px-2 py-1 rounded border border-[#2e2e35] text-[#FF6D5A] hover:bg-[#221f20]"
              >
                Use Active
              </button>
            )}
            <button
              type="button"
              onClick={() => setJsonInput(SAMPLE_WORKFLOW)}
              className="text-[11px] px-2 py-1 rounded border border-[#2e2e35] text-zinc-400 hover:text-white"
            >
              Load Sample
            </button>
          </div>
        </div>

        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          placeholder="Paste full n8n workflow JSON here…"
          className="flex-1 w-full rounded-lg bg-[#111113] border border-[#2e2e35] text-xs font-mono text-zinc-200 p-3 resize-none focus:outline-none focus:border-[#FF6D5A]"
          disabled={isAnalyzing}
        />

        <button
          type="button"
          onClick={handleAnalyze}
          disabled={!jsonInput.trim() || isAnalyzing}
          className="py-2.5 px-4 rounded-lg font-semibold text-xs bg-gradient-to-r from-[#FF6D5A] to-[#EE4F7B] text-white hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center justify-center gap-2 flex-shrink-0"
        >
          {isAnalyzing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span>Auditing &amp; Explaining… (3-5s)</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Audit &amp; Explain Workflow</span>
            </>
          )}
        </button>
      </div>

      {/* Right: Audit Report Output */}
      <div className="rounded-xl border border-[#2e2e35] bg-[#18181b] p-5 flex flex-col h-full overflow-hidden shadow-lg">
        {analysis ? (
          <ScrollArea className="h-full pr-3">
            <div className="flex flex-col gap-4 pb-4">
              {/* Header card */}
              <div className="p-3.5 rounded-lg bg-[#141416] border border-[#2e2e35] flex flex-col gap-1.5">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-[#FF6D5A]">
                  Workflow Summary
                </span>
                <h3 className="text-sm font-bold text-white">{analysis.title}</h3>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  {analysis.summary}
                </p>
                <div className="mt-1 pt-2 border-t border-[#232328] text-xs text-zinc-400 flex items-center gap-2">
                  <span className="text-zinc-500 font-medium">Trigger:</span>
                  <span className="text-blue-400 font-mono text-[11px]">
                    {analysis.trigger}
                  </span>
                </div>
              </div>

              {/* Execution Flow Steps */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#FF6D5A]" />
                  Execution Flow Breakdown
                </span>
                <div className="flex flex-col gap-1.5">
                  {analysis.steps.map((step, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-[#141416] border border-[#2e2e35] text-xs flex items-start gap-2.5"
                    >
                      <span className="w-5 h-5 rounded-full bg-[#27272a] text-zinc-300 flex items-center justify-center font-bold text-[10px] flex-shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <div className="flex flex-col">
                        <span className="font-semibold text-zinc-200">{step.node}</span>
                        <span className="text-zinc-400 text-[11px] leading-snug">
                          {step.role}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Security & Reliability Audit */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Security */}
                <div className="p-3 rounded-lg bg-[#141416] border border-[#2e2e35] flex flex-col gap-2">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                    Security Audit
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {analysis.securityFindings.map((f, i) => (
                      <div
                        key={i}
                        className="p-1.5 rounded bg-[#1c1c20] text-[11px] text-zinc-300 leading-tight"
                      >
                        {f.message}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reliability */}
                <div className="p-3 rounded-lg bg-[#141416] border border-[#2e2e35] flex flex-col gap-2">
                  <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    Reliability &amp; Errors
                  </span>
                  <div className="flex flex-col gap-1.5">
                    {analysis.reliabilityFindings.map((f, i) => (
                      <div
                        key={i}
                        className="p-1.5 rounded bg-[#1c1c20] text-[11px] text-zinc-300 leading-tight"
                      >
                        {f.message}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recommendations */}
              <div className="p-3 rounded-lg bg-[#141416] border border-[#2e2e35] flex flex-col gap-2">
                <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                  <Lightbulb className="w-3.5 h-3.5 text-yellow-400" />
                  Architect Recommendations
                </span>
                <ul className="flex flex-col gap-1.5 text-xs text-zinc-300">
                  {analysis.recommendations.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px]">
                      <span className="text-[#FF6D5A] mt-0.5">&bull;</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center flex-1 text-center gap-3">
            <div className="w-12 h-12 rounded-xl border border-[#2e2e35] bg-[#111113] flex items-center justify-center text-zinc-500">
              <FileCode2 className="w-6 h-6 stroke-1" />
            </div>
            <div className="flex flex-col gap-1 max-w-xs">
              <p className="text-zinc-300 text-sm font-medium">No workflow audited yet</p>
              <p className="text-zinc-500 text-xs">
                Paste any n8n workflow JSON on the left to receive an instant security, architecture, and reliability audit.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

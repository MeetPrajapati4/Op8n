'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, AlertCircle, FileCode2 } from 'lucide-react';
import { toast } from 'sonner';

import Header from '@/components/Header';
import Footer from '@/components/Footer';
import WorkflowForm from '@/components/WorkflowForm';
import NodePreview from '@/components/NodePreview';
import JsonViewer from '@/components/JsonViewer';
import OutputToolbar from '@/components/OutputToolbar';
import SettingsDialog from '@/components/SettingsDialog';
import HistorySheet from '@/components/HistorySheet';
import RefineBar from '@/components/RefineBar';
import DeployDialog from '@/components/DeployDialog';
import ExplainView from '@/components/ExplainView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { N8nWorkflow } from '@/lib/n8n-types';
import { ValidationResult, validateAndRepairWorkflow } from '@/lib/validator';
import { getStoredPreferences, WorkflowPreferences } from '@/lib/settings';
import {
  SavedWorkflow,
  getAllSavedWorkflows,
  saveWorkflowToHistory,
} from '@/lib/db';

type Status = 'idle' | 'loading' | 'success' | 'error';

export default function Home() {
  const [activeMode, setActiveMode] = useState<'studio' | 'audit'>('studio');
  const [status, setStatus] = useState<Status>('idle');
  const [generationStep, setGenerationStep] = useState<string>('');
  const [workflow, setWorkflow] = useState<N8nWorkflow | null>(null);
  const [jsonString, setJsonString] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [activePrompt, setActivePrompt] = useState<string>('');

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deployOpen, setDeployOpen] = useState(false);
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([]);
  const [mobileTab, setMobileTab] = useState<'describe' | 'output'>('describe');

  const abortControllerRef = useRef<AbortController | null>(null);

  // Load history from IndexedDB
  const reloadHistory = useCallback(async () => {
    try {
      const list = await getAllSavedWorkflows();
      setSavedWorkflows(list);
    } catch {
      // Ignore if IndexedDB is unavailable
    }
  }, []);

  useEffect(() => {
    reloadHistory();
  }, [reloadHistory]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus('idle');
    setGenerationStep('');
    toast.info('Generation cancelled');
  };

  const handleGenerate = async (description: string) => {
    setStatus('loading');
    setWorkflow(null);
    setJsonString('');
    setValidation(null);
    setErrorMsg('');
    setActivePrompt(description);
    setGenerationStep('Analyzing automation requirements…');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const preferences: WorkflowPreferences = getStoredPreferences();

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ description, preferences }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        let errDesc = 'Failed to generate workflow';
        try {
          const errData = await res.json();
          errDesc = errData.error || errDesc;
        } catch {
          errDesc = await res.text();
        }
        setErrorMsg(errDesc);
        setStatus('error');
        toast.error(errDesc);
        return;
      }

      // Read SSE stream
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('Failed to open streaming reader');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let currentEvent = 'message';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const rawData = line.slice(6).trim();
            if (!rawData) continue;

            try {
              const data = JSON.parse(rawData);

              if (currentEvent === 'step') {
                setGenerationStep(data as string);
              } else if (currentEvent === 'chunk') {
                setJsonString((prev) => (prev || '') + data);
              } else if (currentEvent === 'done') {
                const finalWorkflow: N8nWorkflow = data.workflow;
                const finalValidation: ValidationResult =
                  data.validation || validateAndRepairWorkflow(finalWorkflow, preferences);
                const prettyJson = JSON.stringify(finalWorkflow, null, 2);

                setWorkflow(finalWorkflow);
                setValidation(finalValidation);
                setJsonString(prettyJson);
                setStatus('success');
                setMobileTab('output');

                // Persist to IndexedDB History
                saveWorkflowToHistory({
                  prompt: description,
                  workflow: finalWorkflow,
                  jsonString: prettyJson,
                  provider: 'gemini',
                  model: 'gemini-2.5-flash',
                  nodeCount: finalWorkflow.nodes?.length || 0,
                }).then(() => {
                  reloadHistory();
                });

                toast.success(
                  `Workflow generated with ${finalWorkflow.nodes.length} nodes!`
                );
              } else if (currentEvent === 'error') {
                setErrorMsg(data.error || 'Generation error');
                setStatus('error');
                toast.error(data.error || 'Generation error');
              }
            } catch {
              // Ignore non-json chunk error
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      const msg = err instanceof Error ? err.message : 'Network error. Please try again.';
      setErrorMsg(msg);
      setStatus('error');
      toast.error(msg);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleApplyRefinement = (
    newWorkflow: N8nWorkflow,
    newValidation: ValidationResult,
    prompt: string
  ) => {
    const prettyJson = JSON.stringify(newWorkflow, null, 2);
    setWorkflow(newWorkflow);
    setValidation(newValidation);
    setJsonString(prettyJson);

    saveWorkflowToHistory({
      prompt: `[Refined] ${prompt}`,
      workflow: newWorkflow,
      jsonString: prettyJson,
      provider: 'gemini',
      model: 'gemini-2.5-flash',
      nodeCount: newWorkflow.nodes?.length || 0,
    }).then(() => {
      reloadHistory();
    });
  };

  const handleSelectFromHistory = (item: SavedWorkflow) => {
    setWorkflow(item.workflow);
    setJsonString(item.jsonString);
    setActivePrompt(item.prompt);
    setValidation(validateAndRepairWorkflow(item.workflow));
    setStatus('success');
    setActiveMode('studio');
    setMobileTab('output');
    toast.info(`Opened "${item.customName || item.workflow.name}"`);
  };

  return (
    <div className="h-dvh max-h-dvh overflow-hidden flex flex-col bg-[#0e0e10] text-zinc-100">
      {/* Top Header */}
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        historyCount={savedWorkflows.length}
        activeMode={activeMode}
        onModeChange={setActiveMode}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 min-h-0 p-3 md:p-6 overflow-hidden">
        {activeMode === 'audit' ? (
          <ExplainView activeWorkflowJson={jsonString} />
        ) : (
          <>
            {/* Mobile View: Two Tabs (< 768px) */}
            <div className="md:hidden h-full flex flex-col">
              <Tabs
                value={mobileTab}
                onValueChange={(val) => setMobileTab(val as 'describe' | 'output')}
                className="h-full flex flex-col"
              >
                <TabsList className="grid grid-cols-2 w-full mb-3 flex-shrink-0">
                  <TabsTrigger value="describe">Describe</TabsTrigger>
                  <TabsTrigger value="output">
                    Output {workflow ? `(${workflow.nodes.length})` : ''}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="describe" className="flex-1 min-h-0 mt-0">
                  <div className="h-full rounded-xl border border-[#2e2e35] bg-[#18181b] p-4 flex flex-col">
                    <WorkflowForm
                      onGenerate={handleGenerate}
                      isLoading={status === 'loading'}
                      onStop={handleStop}
                      externalDescription={activePrompt}
                      generationStep={generationStep}
                    />
                  </div>
                </TabsContent>

                <TabsContent value="output" className="flex-1 min-h-0 mt-0 flex flex-col">
                  <div className="h-full rounded-xl border border-[#2e2e35] bg-[#18181b] p-4 flex flex-col gap-3 overflow-hidden">
                    <OutputToolbar
                      workflow={workflow}
                      jsonString={jsonString}
                      validation={validation}
                      onOpenDeploy={() => setDeployOpen(true)}
                    />
                    {status === 'loading' && (
                      <div className="flex flex-col items-center justify-center flex-1 gap-3">
                        <div className="w-8 h-8 border-2 border-[#FF6D5A]/30 border-t-[#FF6D5A] rounded-full animate-spin" />
                        <p className="text-zinc-400 text-xs font-medium">
                          {generationStep || 'Building your workflow…'}
                        </p>
                      </div>
                    )}
                    {status === 'success' && workflow && jsonString && (
                      <>
                        <NodePreview workflow={workflow} />
                        <JsonViewer json={jsonString} />
                        <RefineBar
                          currentWorkflow={workflow}
                          onApplyRefinement={handleApplyRefinement}
                        />
                      </>
                    )}
                    {(status === 'idle' || status === 'error') && !workflow && (
                      <div className="flex flex-col items-center justify-center flex-1 text-center gap-2">
                        <FileCode2 className="w-8 h-8 text-zinc-600 stroke-1" />
                        <p className="text-zinc-500 text-xs">
                          {status === 'error' ? errorMsg : 'Generate a workflow to view output'}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Desktop View: Two-Column Side-by-Side (>= 768px) */}
            <div className="hidden md:grid md:grid-cols-2 gap-4 lg:gap-6 h-full max-w-7xl mx-auto">
              {/* Left Column: Input Form */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border border-[#2e2e35] bg-[#18181b] p-5 lg:p-6 flex flex-col h-full overflow-hidden shadow-lg"
              >
                <WorkflowForm
                  onGenerate={handleGenerate}
                  isLoading={status === 'loading'}
                  onStop={handleStop}
                  externalDescription={activePrompt}
                  generationStep={generationStep}
                />

                {/* Status / Error Toast Area */}
                <div className="mt-3 min-h-[24px] flex-shrink-0">
                  <AnimatePresence mode="wait">
                    {status === 'loading' && (
                      <motion.p
                        key="step"
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs text-zinc-400 flex items-center gap-2 font-mono"
                      >
                        <span className="w-2 h-2 rounded-full bg-[#FF6D5A] animate-ping" />
                        <span>{generationStep || 'Generating workflow…'}</span>
                      </motion.p>
                    )}

                    {status === 'success' && workflow && (
                      <motion.p
                        key="success"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-emerald-400 font-medium flex items-center gap-1.5"
                      >
                        <span>✓</span>
                        <span>
                          Generated {workflow.nodes.length} nodes successfully (ready in seconds)
                        </span>
                      </motion.p>
                    )}

                    {status === 'error' && (
                      <motion.div
                        key="err"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 flex items-center gap-2"
                      >
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <p className="text-xs text-red-300 line-clamp-2">{errorMsg}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>

              {/* Right Column: Output Pane */}
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-xl border border-[#2e2e35] bg-[#18181b] p-5 lg:p-6 flex flex-col h-full overflow-hidden shadow-lg gap-3"
              >
                {/* Toolbar */}
                {workflow && (
                  <OutputToolbar
                    workflow={workflow}
                    jsonString={jsonString}
                    validation={validation}
                    onOpenDeploy={() => setDeployOpen(true)}
                  />
                )}

                {/* Empty State */}
                {status === 'idle' && !workflow && (
                  <div className="flex flex-col items-center justify-center flex-1 text-center gap-3">
                    <div className="w-12 h-12 rounded-xl border border-[#2e2e35] bg-[#111113] flex items-center justify-center text-xl text-zinc-400 shadow-inner">
                      <Zap className="w-6 h-6 text-zinc-500 stroke-1" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-zinc-300 text-sm font-medium">
                        Your generated n8n workflow will appear here
                      </p>
                      <p className="text-zinc-500 text-xs max-w-xs">
                        Responses are generated and validated in 3-5 seconds.
                      </p>
                    </div>
                  </div>
                )}

                {/* Streaming Loading State */}
                {status === 'loading' && (
                  <div className="flex flex-col items-center justify-center flex-1 gap-4">
                    <div className="relative">
                      <div className="w-10 h-10 border-2 border-[#FF6D5A]/20 border-t-[#FF6D5A] rounded-full animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-mono text-[#FF6D5A]">
                        AI
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 text-center">
                      <p className="text-zinc-200 text-sm font-medium">
                        {generationStep || 'Building your workflow…'}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        High-speed generation active &bull; ~3-5 seconds response
                      </p>
                    </div>
                  </div>
                )}

                {/* Workflow Output Result */}
                {status === 'success' && workflow && jsonString && (
                  <div className="flex flex-col flex-1 min-h-0 gap-3 overflow-hidden">
                    <NodePreview workflow={workflow} />
                    <JsonViewer json={jsonString} />
                    <RefineBar
                      currentWorkflow={workflow}
                      onApplyRefinement={handleApplyRefinement}
                    />
                  </div>
                )}

                {/* Error State */}
                {status === 'error' && !workflow && (
                  <div className="flex flex-col items-center justify-center flex-1 text-center gap-3">
                    <div className="w-12 h-12 rounded-xl border border-red-900/50 bg-red-950/30 flex items-center justify-center text-red-400">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <p className="text-red-400 text-sm font-medium">
                        Generation couldn&apos;t complete
                      </p>
                      <p className="text-zinc-500 text-xs max-w-sm">
                        {errorMsg || 'Please adjust your prompt and retry.'}
                      </p>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          </>
        )}
      </main>

      {/* Footer Disclaimer & Attribution */}
      <Footer />

      {/* Modals & Drawers */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />

      <DeployDialog
        open={deployOpen}
        onOpenChange={setDeployOpen}
        workflow={workflow}
      />

      <HistorySheet
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        workflows={savedWorkflows}
        onReload={reloadHistory}
        onSelectWorkflow={handleSelectFromHistory}
      />
    </div>
  );
}

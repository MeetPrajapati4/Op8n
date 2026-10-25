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
import {
  getUserApiKey,
  getUserProvider,
  getUserActiveModel,
  purgeUserApiKey,
  onUserKeyChange,
  ActiveModelSelection,
} from '@/lib/client/user-keys';

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
  const [cloudEngineActive, setCloudEngineActive] = useState<boolean>(true);
  const [activeModel, setActiveModel] = useState<ActiveModelSelection>({
    provider: 'gemini',
    model: 'gemini-2.5-flash',
  });
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

  // Sync client storage and check cloud engine status on mount
  useEffect(() => {
    reloadHistory();
    const userProv = getUserProvider();
    const userMod = getUserActiveModel();
    if (userProv && userMod) {
      setActiveModel({ provider: userProv, model: userMod });
    }

    fetch('/api/status', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        setCloudEngineActive(!!data.cloudEngineActive);
      })
      .catch(() => {
        setCloudEngineActive(false);
      });

    return onUserKeyChange((e) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.activeModel) {
        setActiveModel({
          provider: detail.provider || getUserProvider(),
          model: detail.activeModel,
        });
      }
    });
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

    const userKey = getUserApiKey();
    const userProvider = getUserProvider();
    const userModel = getUserActiveModel();

    try {
      const res = await fetch('/api/generate', {
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
        body: JSON.stringify({
          description,
          preferences,
          provider: activeModel.provider || userProvider,
          model: activeModel.model || userModel,
        }),
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

        if (res.status === 401 || errDesc.toLowerCase().includes('api key')) {
          purgeUserApiKey();
          toast.error('API key expired or invalid. Key purged. Please reconnect in Preferences.');
        } else {
          toast.error(errDesc);
        }

        setErrorMsg(errDesc);
        setStatus('error');
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
                  provider: activeModel.provider || userProvider,
                  model: activeModel.model || userModel,
                  nodeCount: finalWorkflow.nodes?.length || 0,
                }).then(() => {
                  reloadHistory();
                });

                toast.success(
                  `Workflow generated with ${finalWorkflow.nodes.length} nodes!`
                );
              } else if (currentEvent === 'error') {
                const errText = data.error || 'Generation error';
                if (data.status === 401 || errText.toLowerCase().includes('api key')) {
                  purgeUserApiKey();
                  toast.error('API key expired or invalid. Key purged. Please reconnect in Preferences.');
                } else {
                  toast.error(errText);
                }
                setErrorMsg(errText);
                setStatus('error');
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

  const handleNewSession = useCallback(() => {
    // If generation is active, abort it
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Reset workflow, canvas, prompts, and status
    setWorkflow(null);
    setJsonString(null);
    setValidation(null);
    setActivePrompt('');
    setStatus('idle');
    setGenerationStep('');
    setErrorMsg('');
    setMobileTab('describe');
    setActiveMode('studio');

    toast.success('Started a new workflow session');
  }, []);

  // Keyboard shortcut: Alt+N or Ctrl+Shift+N for New Session
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && e.key.toLowerCase() === 'n') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'n')
      ) {
        e.preventDefault();
        handleNewSession();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNewSession]);

  return (
    <div className="relative h-dvh max-h-dvh overflow-hidden flex flex-col bg-[#070709] text-zinc-100">
      {/* Soft Ambient Glow from Logo Palette */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[380px] bg-[radial-gradient(ellipse_at_top,rgba(1,182,254,0.08),rgba(117,1,253,0.04)_45%,transparent_70%)] z-10" />

      {/* Top Header */}
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenHistory={() => setHistoryOpen(true)}
        onNewSession={handleNewSession}
        historyCount={savedWorkflows.length}
        activeMode={activeMode}
        onModeChange={setActiveMode}
      />

      {/* Main Workspace Area */}
      <main className="flex-1 min-h-0 p-3 md:p-5 overflow-hidden relative z-20 w-full max-w-[1920px] mx-auto">
        <AnimatePresence mode="wait">
          {activeMode === 'audit' ? (
            <motion.div
              key="audit-mode"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="h-full"
            >
              <ExplainView activeWorkflowJson={jsonString} />
            </motion.div>
          ) : (
            <motion.div
              key="studio-mode"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="h-full"
            >
              {/* Mobile View: Two Tabs (< 768px) */}
              <div className="md:hidden h-full flex flex-col">
                <Tabs
                  value={mobileTab}
                  onValueChange={(val) => setMobileTab(val as 'describe' | 'output')}
                  className="h-full flex flex-col"
              >
                <TabsList className="grid grid-cols-2 w-full mb-3 flex-shrink-0 bg-[#111116] border border-white/[0.07] p-1 rounded-xl">
                  <TabsTrigger value="describe">Describe</TabsTrigger>
                  <TabsTrigger value="output">
                    Output {workflow ? `(${workflow.nodes.length})` : ''}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="describe" className="flex-1 min-h-0 mt-0">
                  <div className="h-full rounded-2xl border border-white/[0.07] bg-[#0C0C0F]/85 backdrop-blur-xl p-4 flex flex-col shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]">
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
                  <div className="h-full rounded-2xl border border-white/[0.07] bg-[#0C0C0F]/85 backdrop-blur-xl p-4 flex flex-col gap-3 overflow-hidden shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:20px_20px]">
                    <OutputToolbar
                      workflow={workflow}
                      jsonString={jsonString}
                      validation={validation}
                      onOpenDeploy={() => setDeployOpen(true)}
                      onNewSession={handleNewSession}
                    />
                    {status === 'loading' && (
                      <div className="flex flex-col items-center justify-center flex-1 gap-3">
                        <div className="w-8 h-8 border-2 border-[#01B6FE]/30 border-t-[#01B6FE] rounded-full animate-spin" />
                        <p className="text-zinc-300 text-xs font-medium">
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
                      <div className="flex flex-col items-center justify-center flex-1 text-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-white/[0.07] to-transparent border border-white/[0.08] shadow-2xl flex items-center justify-center animate-pulse">
                          <FileCode2 className="w-7 h-7 text-[#01B6FE] stroke-[1.5]" />
                        </div>
                        <p className="text-zinc-300 text-xs">
                          {status === 'error' ? errorMsg : 'Generate a workflow to view output'}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Desktop View: Two-Column Side-by-Side (>= 768px) */}
            <div className="hidden md:grid md:grid-cols-2 gap-4 lg:gap-6 h-full w-full max-w-[1920px] mx-auto px-1">
              {/* Left Column: Input Form */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl border border-white/[0.08] bg-[#0C0C0F]/85 backdrop-blur-xl p-5 lg:p-6 flex flex-col h-full overflow-hidden shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
              >
                <WorkflowForm
                  onGenerate={handleGenerate}
                  isLoading={status === 'loading'}
                  onStop={handleStop}
                  externalDescription={activePrompt}
                  generationStep={generationStep}
                />

                {/* Status / Error Toast Area */}
                <div className="mt-3 min-h-[28px] flex-shrink-0">
                  <AnimatePresence mode="wait">
                    {status === 'loading' && (
                      <motion.p
                        key="step"
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -3 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs text-zinc-300 flex items-center gap-2 font-mono"
                      >
                        <span className="w-2.5 h-2.5 rounded-full bg-[#02F7C8] animate-ping" />
                        <span>{generationStep || 'Generating workflow…'}</span>
                      </motion.p>
                    )}

                    {status === 'success' && workflow && (
                      <motion.p
                        key="success"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-xs text-emerald-400 font-medium flex items-center gap-2"
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
                        initial={{ opacity: 0, y: 3 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="rounded-xl border border-rose-500/30 bg-rose-950/20 px-3.5 py-2.5 flex items-start gap-2.5 shadow-sm"
                      >
                        <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-rose-200 leading-relaxed break-words">{errorMsg}</p>
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
                className="rounded-2xl border border-white/[0.08] bg-[#0C0C0F]/85 backdrop-blur-xl p-5 lg:p-6 flex flex-col h-full overflow-hidden shadow-2xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] gap-3 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:20px_20px]"
              >
                {/* Toolbar */}
                {workflow && (
                  <OutputToolbar
                    workflow={workflow}
                    jsonString={jsonString}
                    validation={validation}
                    onOpenDeploy={() => setDeployOpen(true)}
                    onNewSession={handleNewSession}
                  />
                )}

                <AnimatePresence mode="wait">
                  {/* Empty State */}
                  {status === 'idle' && !workflow && (
                    <motion.div
                      key="idle-empty"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center justify-center flex-1 text-center gap-3"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-b from-white/[0.07] to-transparent border border-white/[0.08] shadow-2xl flex items-center justify-center animate-pulse">
                        <Zap className="w-6 h-6 text-[#02F7C8] stroke-[1.5]" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-white text-sm font-semibold tracking-tight">
                          Your generated n8n workflow will appear here
                        </p>
                        <p className="text-zinc-300 text-xs max-w-sm leading-relaxed">
                          Responses are generated and validated in 3-5 seconds.
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Streaming Loading State */}
                  {status === 'loading' && (
                    <motion.div
                      key="loading-spinner"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center justify-center flex-1 gap-3.5"
                    >
                      <div className="relative">
                        <div className="w-10 h-10 border-2 border-[#01B6FE]/20 border-t-[#01B6FE] rounded-full animate-spin" />
                        <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-[#01B6FE] font-semibold">
                          AI
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1 text-center">
                        <p className="text-white text-sm font-semibold">
                          {generationStep || 'Building your workflow…'}
                        </p>
                        <p className="text-zinc-300 text-xs">
                          High-speed generation active &bull; ~3-5 seconds response
                        </p>
                      </div>
                    </motion.div>
                  )}

                  {/* Workflow Output Result */}
                  {status === 'success' && workflow && jsonString && (
                    <motion.div
                      key="workflow-output"
                      initial={{ opacity: 0, scale: 0.99 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.99 }}
                      transition={{ duration: 0.22 }}
                      className="flex flex-col flex-1 min-h-0 gap-3 overflow-hidden"
                    >
                      <NodePreview workflow={workflow} />
                      <JsonViewer json={jsonString} />
                      <RefineBar
                        currentWorkflow={workflow}
                        onApplyRefinement={handleApplyRefinement}
                      />
                    </motion.div>
                  )}

                  {/* Error State */}
                  {status === 'error' && !workflow && (
                    <motion.div
                      key="error-box"
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.2 }}
                      className="flex flex-col items-center justify-center flex-1 text-center gap-3"
                    >
                      <div className="w-12 h-12 rounded-2xl border border-red-900/50 bg-red-950/30 flex items-center justify-center text-red-400 shadow-xl">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <div className="flex flex-col gap-1">
                        <p className="text-red-400 text-sm font-semibold tracking-tight">
                          Generation couldn&apos;t complete
                        </p>
                        <p className="text-zinc-300 text-xs max-w-sm leading-relaxed">
                          {errorMsg || 'Please adjust your prompt and retry.'}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </main>

      {/* Footer Disclaimer & Attribution */}
      <Footer cloudEngineActive={cloudEngineActive} />

      {/* Modals & Drawers */}
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        cloudEngineActive={cloudEngineActive}
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


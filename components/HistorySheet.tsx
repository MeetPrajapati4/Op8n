'use client';

import { useState, useRef, useMemo } from 'react';
import {
  Search,
  Star,
  Trash2,
  Edit2,
  Check,
  Download,
  Upload,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  SavedWorkflow,
  updateSavedWorkflow,
  deleteSavedWorkflow,
  exportHistoryBackup,
  importHistoryBackup,
} from '@/lib/db';

interface HistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflows: SavedWorkflow[];
  onReload: () => void;
  onSelectWorkflow: (item: SavedWorkflow) => void;
}

export default function HistorySheet({
  open,
  onOpenChange,
  workflows,
  onReload,
  onSelectWorkflow,
}: HistorySheetProps) {
  const [search, setSearch] = useState('');
  const [filterFavorites, setFilterFavorites] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredWorkflows = useMemo(() => {
    return workflows.filter((w) => {
      const matchSearch =
        (w.customName || '').toLowerCase().includes(search.toLowerCase()) ||
        w.prompt.toLowerCase().includes(search.toLowerCase());
      const matchFav = filterFavorites ? w.favorite : true;
      return matchSearch && matchFav;
    });
  }, [workflows, search, filterFavorites]);

  const handleToggleFavorite = async (item: SavedWorkflow, e: React.MouseEvent) => {
    e.stopPropagation();
    await updateSavedWorkflow(item.id, { favorite: !item.favorite });
    onReload();
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteSavedWorkflow(id);
    toast.success('Workflow removed from history');
    onReload();
  };

  const handleStartRename = (item: SavedWorkflow, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(item.id);
    setEditName(item.customName || item.workflow.name || '');
  };

  const handleSaveRename = async (id: string, e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (editName.trim()) {
      await updateSavedWorkflow(id, { customName: editName.trim() });
      toast.success('Renamed workflow');
      onReload();
    }
    setEditingId(null);
  };

  const handleExport = async () => {
    try {
      const backupJson = await exportHistoryBackup();
      const blob = new Blob([backupJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `op8n-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported history backup file');
    } catch {
      toast.error('Failed to export backup');
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const count = await importHistoryBackup(text);
      toast.success(`Imported ${count} workflows successfully!`);
      onReload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Invalid backup JSON file';
      toast.error(`Import failed: ${msg}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md bg-[#18181b] border-l border-[#2e2e35] p-0 flex flex-col text-zinc-100 h-full"
      >
        <SheetHeader className="p-4 border-b border-[#2e2e35] flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FF6D5A]" />
              Saved Workflows
            </SheetTitle>
            <div className="flex items-center gap-1.5 mr-6">
              <button
                type="button"
                onClick={handleExport}
                className="p-1.5 rounded-md border border-[#2e2e35] bg-[#111113] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                title="Export Backup .json"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 rounded-md border border-[#2e2e35] bg-[#111113] text-zinc-400 hover:text-white hover:border-zinc-500 transition-colors"
                title="Import Backup .json"
              >
                <Upload className="w-3.5 h-3.5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportFile}
              />
            </div>
          </div>
          <SheetDescription className="text-xs text-zinc-400 mt-1">
            Persisted in browser IndexedDB. Search, re-open, or backup anytime.
          </SheetDescription>

          {/* Search bar & Favorite toggle */}
          <div className="flex items-center gap-2 mt-3">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search prompt or name…"
                className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#111113] border border-[#2e2e35] text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-[#FF6D5A] focus:ring-1 focus:ring-[#FF6D5A]"
              />
            </div>
            <button
              type="button"
              onClick={() => setFilterFavorites(!filterFavorites)}
              className={`p-1.5 rounded-lg border text-xs flex items-center gap-1 transition-colors ${
                filterFavorites
                  ? 'border-amber-500/50 bg-amber-500/20 text-amber-300'
                  : 'border-[#2e2e35] bg-[#111113] text-zinc-400 hover:text-white'
              }`}
              title="Show Favorites Only"
            >
              <Star className="w-3.5 h-3.5" fill={filterFavorites ? 'currentColor' : 'none'} />
            </button>
          </div>
        </SheetHeader>

        {/* Scrollable List */}
        <ScrollArea className="flex-1 p-4">
          {filteredWorkflows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-zinc-500 text-xs">
              <Clock className="w-8 h-8 text-zinc-600 mb-2 stroke-1" />
              <p>No saved workflows found</p>
              <p className="text-[11px] text-zinc-600 mt-0.5">
                Generated workflows are automatically stored here.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pb-6">
              {filteredWorkflows.map((item) => (
                <div
                  key={item.id}
                  onClick={() => {
                    onSelectWorkflow(item);
                    onOpenChange(false);
                  }}
                  className="group relative p-3 rounded-lg border border-[#2e2e35] bg-[#111113] hover:border-[#FF6D5A]/50 hover:bg-[#1c1c20] cursor-pointer transition-all flex flex-col gap-2"
                >
                  {/* Top line: Name & Actions */}
                  <div className="flex items-center justify-between gap-2">
                    {editingId === item.id ? (
                      <form
                        onSubmit={(e) => handleSaveRename(item.id, e)}
                        className="flex items-center gap-1 flex-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          className="px-2 py-0.5 rounded bg-[#18181b] border border-[#FF6D5A] text-xs text-white flex-1 focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="submit"
                          className="p-1 rounded bg-[#FF6D5A] text-white hover:opacity-90"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      </form>
                    ) : (
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        <span className="font-semibold text-xs text-zinc-200 truncate">
                          {item.customName || item.workflow.name}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => handleStartRename(item, e)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-zinc-300 transition-opacity"
                          title="Rename"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handleToggleFavorite(item, e)}
                        className={`p-1 rounded transition-colors ${
                          item.favorite
                            ? 'text-amber-400 hover:text-amber-300'
                            : 'text-zinc-600 hover:text-zinc-300'
                        }`}
                        title={item.favorite ? 'Unstar' : 'Star'}
                      >
                        <Star
                          className="w-3.5 h-3.5"
                          fill={item.favorite ? 'currentColor' : 'none'}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => handleDelete(item.id, e)}
                        className="p-1 rounded text-zinc-600 hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Prompt snippet */}
                  <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">
                    {item.prompt}
                  </p>

                  {/* Footer metadata */}
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-[#232328]">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 font-mono">
                        <Layers className="w-3 h-3" />
                        {item.nodeCount || item.workflow.nodes?.length || 0} nodes
                      </span>
                      <span>&bull;</span>
                      <span className="capitalize">{item.provider}</span>
                    </div>
                    <span className="flex items-center gap-1 text-[#FF6D5A] opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                      Open <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

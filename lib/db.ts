import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { N8nWorkflow } from './n8n-types';

export interface SavedWorkflow {
  id: string;
  prompt: string;
  workflow: N8nWorkflow;
  jsonString: string;
  provider: string;
  model: string;
  timestamp: number;
  favorite: boolean;
  customName?: string;
  nodeCount: number;
}

interface Op8nDB extends DBSchema {
  workflows: {
    key: string;
    value: SavedWorkflow;
    indexes: {
      'by-timestamp': number;
      'by-favorite': number;
    };
  };
}

const DB_NAME = 'op8n_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<Op8nDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<Op8nDB>> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is only accessible in the browser'));
  }

  if (!dbPromise) {
    dbPromise = openDB<Op8nDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('workflows')) {
          const store = db.createObjectStore('workflows', { keyPath: 'id' });
          store.createIndex('by-timestamp', 'timestamp');
          store.createIndex('by-favorite', 'favorite');
        }
      },
    });
  }

  return dbPromise;
}

export async function saveWorkflowToHistory(
  item: Omit<SavedWorkflow, 'id' | 'timestamp' | 'favorite'> & {
    favorite?: boolean;
    customName?: string;
  }
): Promise<SavedWorkflow> {
  const db = await getDB();
  const id = `wf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const saved: SavedWorkflow = {
    ...item,
    id,
    timestamp: Date.now(),
    favorite: item.favorite ?? false,
    customName: item.customName || item.workflow.name || 'Untitled Workflow',
  };

  await db.put('workflows', saved);
  return saved;
}

export async function getAllSavedWorkflows(): Promise<SavedWorkflow[]> {
  const db = await getDB();
  const list = await db.getAllFromIndex('workflows', 'by-timestamp');
  return list.reverse(); // Newest first
}

export async function updateSavedWorkflow(
  id: string,
  updates: Partial<SavedWorkflow>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get('workflows', id);
  if (!existing) return;

  const updated: SavedWorkflow = { ...existing, ...updates };
  await db.put('workflows', updated);
}

export async function deleteSavedWorkflow(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('workflows', id);
}

export async function clearAllSavedWorkflows(): Promise<void> {
  const db = await getDB();
  await db.clear('workflows');
}

export async function exportHistoryBackup(): Promise<string> {
  const items = await getAllSavedWorkflows();
  const payload = {
    app: 'Op8n',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    count: items.length,
    workflows: items,
  };
  return JSON.stringify(payload, null, 2);
}

export async function importHistoryBackup(jsonString: string): Promise<number> {
  const parsed = JSON.parse(jsonString);
  const workflows: SavedWorkflow[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.workflows)
    ? parsed.workflows
    : [];

  if (workflows.length === 0) {
    throw new Error('No valid workflows found in the imported file');
  }

  const db = await getDB();
  const tx = db.transaction('workflows', 'readwrite');
  let importedCount = 0;

  for (const item of workflows) {
    if (item.prompt && item.workflow) {
      await tx.store.put({
        ...item,
        id: item.id || `imported_${Date.now()}_${importedCount}`,
        timestamp: item.timestamp || Date.now(),
        favorite: !!item.favorite,
        customName: item.customName || item.workflow?.name || 'Imported Workflow',
        nodeCount: item.workflow?.nodes?.length || 0,
      });
      importedCount++;
    }
  }

  await tx.done;
  return importedCount;
}

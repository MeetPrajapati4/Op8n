export interface WorkflowPreferences {
  targetVersion: 'v1' | 'v0';
  injectPinData: boolean;
  errorHandling: 'none' | 'continue' | 'retry';
  layoutSpacing: 180 | 220 | 280;
  addStickyNote: boolean;
  timezone: string;
  n8nBaseUrl?: string;
  n8nApiKey?: string;
}

export const DEFAULT_PREFERENCES: WorkflowPreferences = {
  targetVersion: 'v1',
  injectPinData: true,
  errorHandling: 'none',
  layoutSpacing: 220,
  addStickyNote: false,
  timezone: 'UTC',
  n8nBaseUrl: '',
  n8nApiKey: '',
};

export const PREFERENCES_STORAGE_KEY = 'op8n_preferences';

export function getStoredPreferences(): WorkflowPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFERENCES;
  }

  try {
    const raw = localStorage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
    }
  } catch {
    // Ignore parse error
  }

  return DEFAULT_PREFERENCES;
}

export function saveStoredPreferences(prefs: WorkflowPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(prefs));
  } catch (err) {
    console.error('Failed to save preferences to localStorage', err);
  }
}

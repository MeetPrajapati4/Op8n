'use client';

import { useState, useEffect, useCallback } from 'react';
import { RankedSuggestion, rankSuggestions, ActionRecord } from '../recommendations/ranking';
import { DEFAULT_SUGGESTIONS_CATALOG } from '../recommendations/catalog';

const STORAGE_KEY_USER_ID = 'op8n_user_id';
const STORAGE_KEY_ACTIONS = 'op8n_local_actions_v1';

/**
 * Returns or generates a persistent unique anonymous user ID in localStorage
 */
export function getOrInitUserId(): string {
  if (typeof window === 'undefined') return 'anonymous_ssr';

  try {
    let uid = localStorage.getItem(STORAGE_KEY_USER_ID);
    if (!uid) {
      uid = 'usr_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem(STORAGE_KEY_USER_ID, uid);
    }
    return uid;
  } catch {
    return 'anonymous_fallback';
  }
}

/**
 * Reads locally buffered actions from localStorage
 */
function getLocalActions(): ActionRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ACTIONS);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Saves an action locally for instant client-side ranking & offline resilience
 */
function appendLocalAction(action: ActionRecord) {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalActions();
    // Keep up to 100 most recent actions
    const updated = [action, ...existing].slice(0, 100);
    localStorage.setItem(STORAGE_KEY_ACTIONS, JSON.stringify(updated));
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Client-side hook for dynamic personalized suggestions
 */
export function usePersonalizedSuggestions(limit = 16) {
  const [suggestions, setSuggestions] = useState<RankedSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string>('anonymous');

  useEffect(() => {
    setUserId(getOrInitUserId());
  }, []);

  const loadSuggestions = useCallback(async () => {
    setIsLoading(true);
    const uid = getOrInitUserId();

    try {
      const res = await fetch(`/api/suggestions?userId=${encodeURIComponent(uid)}&limit=${limit}`);
      const json = await res.json();

      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        // If MongoDB provided personalized data or defaults
        if (json.source === 'mongodb') {
          setSuggestions(json.data);
          setIsLoading(false);
          return;
        }
      }

      // If backend was in catalog_fallback or offline, combine with client-side local actions
      const localActions = getLocalActions();
      const clientRanked = rankSuggestions(localActions, DEFAULT_SUGGESTIONS_CATALOG, limit);
      setSuggestions(clientRanked);
    } catch {
      // Offline fallback: pure client-side mathematical ranking
      const localActions = getLocalActions();
      const clientRanked = rankSuggestions(localActions, DEFAULT_SUGGESTIONS_CATALOG, limit);
      setSuggestions(clientRanked);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadSuggestions();
  }, [loadSuggestions]);

  /**
   * Tracks a user interaction and updates client state
   */
  const trackAction = useCallback(
    async (
      itemId: string,
      actionType: 'view' | 'click' | 'generate' | 'refine' | 'deploy',
      category = 'General',
      tags: string[] = []
    ) => {
      const uid = getOrInitUserId();
      const record: ActionRecord = {
        itemId,
        actionType,
        category,
        tags,
        timestamp: Date.now(),
      };

      // 1. Immediately store in local storage for instant re-ranking
      appendLocalAction(record);

      // 2. Asynchronously transmit to backend / MongoDB
      try {
        fetch('/api/suggestions/track', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: uid,
            itemId,
            actionType,
            category,
            tags,
          }),
        }).catch(() => {
          // Silent non-blocking fail
        });
      } catch {
        // Non-blocking telemetry
      }
    },
    []
  );

  return {
    userId,
    suggestions,
    isLoading,
    trackAction,
    refreshSuggestions: loadSuggestions,
  };
}

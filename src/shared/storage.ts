// Kimi Web Assistant — Storage API Wrapper

import type { CachedConversation, CachedMessage } from './messages';

/** Max conversations to cache (LRU eviction) */
const MAX_CACHED_CONVERSATIONS = 50;

export const Storage = {
  async get<T>(key: string, fallback: T | null = null): Promise<T | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return (result[key] as T) ?? fallback;
    } catch (e) {
      console.error('[Storage] get failed:', e);
      return fallback;
    }
  },

  async set<T>(key: string, value: T): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (e) {
      console.error('[Storage] set failed:', e);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (e) {
      console.error('[Storage] remove failed:', e);
    }
  },

  async exportData(): Promise<Record<string, unknown>> {
    return chrome.storage.local.get(null);
  },

  async importData(data: Record<string, unknown>): Promise<void> {
    await chrome.storage.local.clear();
    await chrome.storage.local.set(data);
  },

  // --- Conversation Cache ---

  async cacheConversation(conv: CachedConversation): Promise<void> {
    const key = `cache:${conv.id}`;
    const all = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(all).filter((k) => k.startsWith('cache:'));
    cacheKeys.sort(
      (a, b) =>
        ((all[a] as CachedConversation).updatedAt || 0) -
        ((all[b] as CachedConversation).updatedAt || 0)
    );

    // Simple size guard: evict oldest if too many entries
    while (cacheKeys.length >= MAX_CACHED_CONVERSATIONS) {
      const oldest = cacheKeys.shift();
      if (oldest) await chrome.storage.local.remove(oldest);
    }

    await chrome.storage.local.set({ [key]: conv });
  },

  async getCachedConversation(id: string): Promise<CachedConversation | null> {
    const result = await chrome.storage.local.get(`cache:${id}`);
    return (result[`cache:${id}`] as CachedConversation) || null;
  },

  async searchCachedConversations(
    query: string,
    limit = 20
  ): Promise<Array<{ conversation: CachedConversation; matches: CachedMessage[] }>> {
    const all = await chrome.storage.local.get(null);
    const q = query.toLowerCase();
    const results: Array<{ conversation: CachedConversation; matches: CachedMessage[] }> = [];

    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith('cache:')) continue;
      const conv = value as CachedConversation;
      const matches = conv.messages.filter((m) => m.content.toLowerCase().includes(q));
      if (matches.length > 0) {
        results.push({ conversation: conv, matches });
      }
    }

    results.sort((a, b) => b.conversation.updatedAt - a.conversation.updatedAt);
    return results.slice(0, limit);
  },

  async clearConversationCache(): Promise<void> {
    const all = await chrome.storage.local.get(null);
    const cacheKeys = Object.keys(all).filter((k) => k.startsWith('cache:'));
    await chrome.storage.local.remove(cacheKeys);
  },

  async getCacheStats(): Promise<{ count: number; oldest: number; newest: number }> {
    const all = await chrome.storage.local.get(null);
    const items = Object.entries(all)
      .filter(([k]) => k.startsWith('cache:'))
      .map(([, v]) => v as CachedConversation);

    if (items.length === 0) return { count: 0, oldest: 0, newest: 0 };

    const timestamps = items.map((i) => i.updatedAt);
    return {
      count: items.length,
      oldest: Math.min(...timestamps),
      newest: Math.max(...timestamps),
    };
  },
};

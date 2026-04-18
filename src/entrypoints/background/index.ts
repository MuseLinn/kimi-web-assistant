import { defineBackground } from 'wxt/utils/define-background';
import type { ExtensionMessage, ExtensionResponse } from '@/shared/messages';
import { DEFAULT_SETTINGS } from '@/shared/messages';
import { Storage } from '@/shared/storage';

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener((details: chrome.runtime.InstalledDetails) => {
    console.log('[KWA] Extension installed.', details.reason);

    // Initialize default settings on first install
    if (details.reason === 'install') {
      Storage.set('settings', DEFAULT_SETTINGS);
    }
  });

  chrome.runtime.onMessage.addListener(
    (
      message: ExtensionMessage,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: unknown) => void
    ) => {
      handleMessage(message)
        .then(sendResponse)
        .catch((err) => sendResponse({ ok: false, error: String(err) }));
      return true; // async response
    }
  );
});

async function handleMessage(msg: ExtensionMessage): Promise<ExtensionResponse> {
  switch (msg.type) {
    case 'GET_SETTINGS': {
      const data = await Storage.get('settings', DEFAULT_SETTINGS);
      return { ok: true, data };
    }
    case 'SET_SETTINGS': {
      const current = await Storage.get('settings', DEFAULT_SETTINGS);
      const next = { ...current, ...msg.payload };
      await Storage.set('settings', next);
      return { ok: true, data: next };
    }
    case 'GET_COLLECTIONS': {
      const data = await Storage.get('collections', []);
      return { ok: true, data };
    }
    case 'SET_COLLECTION': {
      const list = (await Storage.get('collections', [])) as { id: string }[];
      const idx = list.findIndex((c) => c.id === msg.payload.id);
      if (idx >= 0) {
        list[idx] = msg.payload;
      } else {
        list.push(msg.payload);
      }
      await Storage.set('collections', list);
      return { ok: true, data: list };
    }
    case 'DELETE_COLLECTION': {
      const list = ((await Storage.get('collections', [])) as { id: string }[]).filter(
        (c) => c.id !== msg.payload.id
      );
      await Storage.set('collections', list);
      return { ok: true, data: list };
    }
    case 'GET_FAVORITES': {
      const data = await Storage.get('favorites', {});
      return { ok: true, data };
    }
    case 'TOGGLE_FAVORITE': {
      const favs = (await Storage.get('favorites', {})) as Record<string, unknown>;
      const id = msg.payload.id;
      if (favs[id]) {
        delete favs[id];
      } else {
        favs[id] = msg.payload;
      }
      await Storage.set('favorites', favs);
      return { ok: true, data: favs };
    }
    case 'EXPORT_DATA': {
      const data = await Storage.exportData();
      return { ok: true, data };
    }
    case 'IMPORT_DATA': {
      await Storage.importData(msg.payload);
      return { ok: true };
    }
    case 'COPY_TO_CLIPBOARD': {
      // Content scripts handle clipboard directly with clipboardWrite permission.
      // This message acts as an acknowledgement for cross-context coordination.
      return { ok: true };
    }
    case 'CACHE_CONVERSATION': {
      await Storage.cacheConversation(msg.payload);
      return { ok: true };
    }
    case 'GET_CONVERSATION_CACHE': {
      const data = await Storage.getCachedConversation(msg.payload.id);
      return { ok: true, data };
    }
    case 'SEARCH_CONVERSATION_CACHE': {
      const data = await Storage.searchCachedConversations(msg.payload.query, msg.payload.limit);
      return { ok: true, data };
    }
    case 'CLEAR_CONVERSATION_CACHE': {
      await Storage.clearConversationCache();
      return { ok: true };
    }
    case 'GET_CACHE_STATS': {
      const data = await Storage.getCacheStats();
      return { ok: true, data };
    }
    default:
      return { ok: false, error: 'Unknown message type' };
  }
}

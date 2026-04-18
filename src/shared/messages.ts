// Kimi Web Assistant — Cross-Context Message Protocol

export interface Collection {
  id: string;
  name: string;
  conversationIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ConversationMeta {
  id: string;
  title: string;
  url: string;
  timestamp: number;
}

export interface Settings {
  navigator: boolean;
  latexCopier: boolean;
  collectionInject: boolean;
  conversationCache: boolean;
  theme: 'light' | 'dark' | 'system';
}

export const DEFAULT_SETTINGS: Settings = {
  navigator: true,
  latexCopier: true,
  collectionInject: true,
  conversationCache: true,
  theme: 'system',
};

export interface CachedMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface CachedConversation {
  id: string;
  title: string;
  url: string;
  messages: CachedMessage[];
  updatedAt: number;
}

export type ExtensionMessage =
  | { type: 'GET_COLLECTIONS' }
  | { type: 'SET_COLLECTION'; payload: Collection }
  | { type: 'DELETE_COLLECTION'; payload: { id: string } }
  | { type: 'TOGGLE_FAVORITE'; payload: ConversationMeta }
  | { type: 'GET_FAVORITES' }
  | { type: 'GET_SETTINGS' }
  | { type: 'SET_SETTINGS'; payload: Partial<Settings> }
  | { type: 'EXPORT_DATA' }
  | { type: 'IMPORT_DATA'; payload: Record<string, unknown> }
  | { type: 'COPY_TO_CLIPBOARD'; payload: { text: string } }
  | { type: 'CACHE_CONVERSATION'; payload: CachedConversation }
  | { type: 'GET_CONVERSATION_CACHE'; payload: { id: string } }
  | { type: 'SEARCH_CONVERSATION_CACHE'; payload: { query: string; limit?: number } }
  | { type: 'CLEAR_CONVERSATION_CACHE' }
  | { type: 'GET_CACHE_STATS' };

export type ExtensionResponse = { ok: true; data?: unknown } | { ok: false; error: string };

export async function sendMessage(message: ExtensionMessage): Promise<ExtensionResponse> {
  try {
    const response = await chrome.runtime.sendMessage(message);
    return response as ExtensionResponse;
  } catch (e) {
    console.error('[Messaging] sendMessage failed:', e);
    return { ok: false, error: String(e) };
  }
}

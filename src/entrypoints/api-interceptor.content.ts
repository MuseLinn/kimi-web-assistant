// Kimi Web Assistant — API Interceptor (MAIN world)
// Intercepts Kimi API calls to capture conversation data for search indexing

import { defineContentScript } from 'wxt/utils/define-content-script';
import type { CachedConversation, CachedMessage } from '@/shared/messages';

export default defineContentScript({
  matches: ['https://kimi.moonshot.cn/*', 'https://www.kimi.com/*', 'https://kimi.com/*'],
  runAt: 'document_start',
  world: 'MAIN', // Run in page context to intercept fetch/XHR

  main() {
    console.log('[KWA] API interceptor loaded in MAIN world');

    const originalFetch = window.fetch;
    const originalXHR = window.XMLHttpRequest;

    // Extract conversation ID from current URL
    // Patterns: /chat/{id}, /c/{id}, /conversation/{id}
    function getConversationIdFromUrl(): string | null {
      const path = window.location.pathname;
      const patterns = [/^\/chat\/([^\/]+)/, /^\/c\/([^\/]+)/, /^\/conversation\/([^\/]+)/];
      for (const p of patterns) {
        const m = path.match(p);
        if (m) return m[1];
      }
      return null;
    }

    // Extract conversation title from page
    function getConversationTitle(): string {
      // Try to find title in DOM or document.title
      const titleEl = document.querySelector('[data-testid="chat-title"], .chat-title, h1');
      if (titleEl?.textContent) return titleEl.textContent.trim();
      // Remove suffix from document title
      return document.title.replace(/\s*-\s*Kimi\s*$/i, '').trim() || '未命名对话';
    }

    // Parse Kimi API response into cached messages
    function parseMessages(data: unknown): CachedMessage[] | null {
      if (!data || typeof data !== 'object') return null;

      // Handle array directly
      if (Array.isArray(data)) {
        return extractMessagesFromArray(data);
      }

      // Handle { items: [...] } or { messages: [...] } or { data: { items: [...] } }
      const obj = data as Record<string, unknown>;
      const arr = obj.items || obj.messages || obj.data;
      if (Array.isArray(arr)) {
        return extractMessagesFromArray(arr);
      }

      return null;
    }

    function extractMessagesFromArray(arr: unknown[]): CachedMessage[] | null {
      const messages: CachedMessage[] = [];
      for (const item of arr) {
        if (!item || typeof item !== 'object') continue;
        const m = item as Record<string, unknown>;

        // Detect role
        const role = m.role || m.sender || m.type;
        const content = m.content || m.text || m.message;
        const id = (m.id as string) || `msg_${messages.length}`;

        if (role && content) {
          const normalizedRole: 'user' | 'assistant' =
            role === 'user' || role === 'human' ? 'user' : 'assistant';
          messages.push({
            id,
            role: normalizedRole,
            content: String(content),
            timestamp: Date.now(),
          });
        }
      }
      return messages.length > 0 ? messages : null;
    }

    // Send captured conversation to extension
    async function sendConversationToExtension(messages: CachedMessage[]) {
      const convId = getConversationIdFromUrl();
      if (!convId) return;

      const conversation: CachedConversation = {
        id: convId,
        title: getConversationTitle(),
        url: window.location.href,
        messages,
        updatedAt: Date.now(),
      };

      try {
        // In MAIN world, chrome.runtime should be available in Chrome MV3
        await chrome.runtime.sendMessage({
          type: 'CACHE_CONVERSATION',
          payload: conversation,
        });
        console.log('[KWA] Cached conversation:', convId, messages.length, 'messages');
      } catch (e) {
        // Silently fail if extension context is not ready
      }
    }

    // Determine if a URL is a conversation/message API we care about
    function isConversationEndpoint(url: string): boolean {
      const u = url.toLowerCase();
      // Only intercept known conversation/history/message endpoints
      const patterns = [
        '/chat/',
        '/conversation/',
        '/message/',
        '/history/',
        '/api/chat',
        '/api/conversation',
        '/api/message',
        '/api/history',
      ];
      return patterns.some((p) => u.includes(p));
    }

    // Intercept fetch
    window.fetch = async function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const response = await originalFetch.apply(this, [input, init]);

      // Only intercept Kimi API calls that look like conversation endpoints
      if (
        (!url.includes('kimi.moonshot.cn') && !url.includes('kimi.com')) ||
        !isConversationEndpoint(url)
      ) {
        return response;
      }

      // Skip streaming / SSE responses
      const respContentType = response.headers.get('content-type') || '';
      if (respContentType.includes('text/event-stream')) {
        return response;
      }

      // Clone response to read body without consuming original
      try {
        const cloned = response.clone();
        const clonedContentType = cloned.headers.get('content-type') || '';
        if (clonedContentType.includes('application/json')) {
          const data = await cloned.json();
          const messages = parseMessages(data);
          if (messages) {
            sendConversationToExtension(messages);
          }
        }
      } catch {
        // Ignore parsing errors
      }

      return response;
    };

    // Intercept XMLHttpRequest
    class InterceptedXHR extends originalXHR {
      private _url = '';

      open(
        method: string,
        url: string | URL,
        async = true,
        username?: string | null,
        password?: string | null
      ): void {
        this._url = typeof url === 'string' ? url : url.href;
        super.open(method, url, async, username, password);
      }

      send(body?: Document | XMLHttpRequestBodyInit | null): void {
        const url = this._url;
        const originalOnLoad = this.onload;
        this.onload = function (this: XMLHttpRequest, ev: ProgressEvent) {
          try {
            if (
              (this.responseType === '' || this.responseType === 'text') &&
              (url.includes('kimi.moonshot.cn') || url.includes('kimi.com')) &&
              isConversationEndpoint(url)
            ) {
              const contentType = this.getResponseHeader('content-type') || '';
              if (contentType.includes('application/json')) {
                const data = JSON.parse(this.responseText);
                const messages = parseMessages(data);
                if (messages) {
                  sendConversationToExtension(messages);
                }
              }
            }
          } catch {
            // Ignore parsing errors
          }
          if (originalOnLoad) originalOnLoad.call(this, ev);
        };
        super.send(body);
      }
    }

    window.XMLHttpRequest = InterceptedXHR as typeof XMLHttpRequest;

    console.log('[KWA] Fetch/XHR interceptors installed');
  },
});

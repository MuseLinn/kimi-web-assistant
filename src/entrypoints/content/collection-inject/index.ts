// Content Script feature: collection-inject
// Injects star/heart buttons into sidebar conversation items

import { debounce } from '@/shared/utils';
import { sendMessage } from '@/shared/messages';
import type { DomObserver } from '../observer';

const INJECTED_ATTR = 'data-kwa-injected';
const STAR_BTN_CLASS = 'kwa-star-btn';

interface ConversationItem {
  element: Element;
  id: string;
  title: string;
  url: string;
}

function parseConversationItem(el: Element): ConversationItem | null {
  // Kimi DOM: history items are <a class="chat-info-item"> containing <div class="chat-info">
  const link =
    el.tagName === 'A' ? (el as HTMLAnchorElement) : el.querySelector('a[href*="/chat/"]');
  if (!link) return null;

  const href = link.getAttribute('href');
  if (!href) return null;

  // Extract conversation ID from URL
  // URLs: /chat/{id} or /c/{id}
  // Skip the history index page itself (e.g. /chat/history)
  try {
    const urlObj = new URL(href, window.location.href);
    if (urlObj.pathname === '/chat/history') return null;
  } catch {
    // fallback for relative URLs
    if (href.startsWith('/chat/history')) return null;
  }

  const match = href.match(/\/(chat|c)\/([^/?#]+)/);
  if (!match) return null;

  const id = match[2];
  const url = href.startsWith('http') ? href : `https://www.kimi.com${href}`;

  // Try to find title from chat-name element or link text
  let title = '';
  const titleEl =
    link.querySelector('.chat-name') ||
    link.querySelector('[class*="title"]') ||
    link.querySelector('h3, h4, .title');
  if (titleEl) {
    title = titleEl.textContent?.trim() || '';
  }

  // Fallback to link text (strip out any extra whitespace)
  if (!title) {
    title = link.textContent?.trim() || '未命名对话';
  }

  return { element: el, id, title, url };
}

function createStarButton(isActive: boolean): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = STAR_BTN_CLASS;
  btn.setAttribute('aria-label', isActive ? '取消收藏' : '收藏');
  btn.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="${isActive ? 'currentColor' : 'none'}" 
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  `;
  if (isActive) {
    btn.classList.add('active');
  }
  return btn;
}

/**
 * Detect whether a link is inside a wide card (history page main content)
 * vs a narrow sidebar item.
 */
function isCardLayout(link: Element): boolean {
  const parentLi = link.closest('li');
  if (parentLi) {
    const rect = parentLi.getBoundingClientRect();
    // Sidebar items are narrow (~200px), cards are wide (> 400px)
    if (rect.width > 400) return true;
  }

  // Also detect by parent container width
  const container = link.parentElement;
  if (container) {
    const rect = container.getBoundingClientRect();
    if (rect.width > 400) return true;
  }

  return false;
}

async function injectStarButton(conv: ConversationItem, favorites: Set<string>) {
  const link =
    conv.element.tagName === 'A'
      ? (conv.element as HTMLAnchorElement)
      : conv.element.querySelector('a[href*="/chat/"]') ||
        conv.element.querySelector('a[href*="/c/"]');
  if (!link) return;

  if (link.hasAttribute(INJECTED_ATTR)) return;
  link.setAttribute(INJECTED_ATTR, 'true');

  const isActive = favorites.has(conv.id);
  const btn = createStarButton(isActive);

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const willFavorite = !btn.classList.contains('active');
    btn.classList.toggle('active');
    btn.setAttribute('aria-label', willFavorite ? '取消收藏' : '收藏');
    const svg = btn.querySelector('svg');
    if (svg) {
      svg.setAttribute('fill', willFavorite ? 'currentColor' : 'none');
    }

    const res = await sendMessage({
      type: 'TOGGLE_FAVORITE',
      payload: {
        id: conv.id,
        title: conv.title,
        url: conv.url,
        timestamp: Date.now(),
      },
    });

    if (!res.ok) {
      btn.classList.toggle('active');
      btn.setAttribute('aria-label', !willFavorite ? '取消收藏' : '收藏');
      if (svg) {
        svg.setAttribute('fill', !willFavorite ? 'currentColor' : 'none');
      }
      console.error('[KWA] Failed to toggle favorite:', res.error);
    }
  });

  const card = isCardLayout(link);

  if (card) {
    // --- Wide card (history page main content) ---
    // Try: append to title-wrapper for stable positioning beside the title
    const titleWrapper = link.querySelector('.title-wrapper');
    if (titleWrapper) {
      btn.classList.add('kwa-star-btn--title');
      titleWrapper.appendChild(btn);
      return;
    }

    // Fallback: append to action-wrapper (bottom action bar)
    const actionWrapper = link.querySelector('.action-wrapper');
    if (actionWrapper) {
      btn.classList.add('kwa-star-btn--toolbar');
      actionWrapper.appendChild(btn);
      return;
    }

    // Last resort: absolute position inside the link
    if (window.getComputedStyle(link).position === 'static') {
      (link as HTMLElement).style.position = 'relative';
    }
    btn.classList.add('kwa-star-btn--card');
    link.appendChild(btn);
    return;
  }

  // --- Sidebar / narrow list items: inline, hidden until hover ---
  if (window.getComputedStyle(link).position === 'static') {
    (link as HTMLElement).style.position = 'relative';
  }
  link.appendChild(btn);
}

export async function initCollectionInject(observer: DomObserver) {
  console.log('[KWA] Initializing collection-inject');

  // Load current favorites
  const favsRes = await sendMessage({ type: 'GET_FAVORITES' });
  const favorites = new Set<string>(
    favsRes.ok ? Object.keys((favsRes.data as Record<string, unknown>) || {}) : []
  );

  // Function to scan and inject
  const scanAndInject = async () => {
    // Collect all matching items across selectors (deduplicated)
    const selectors = [
      // History page main content — actual Kimi DOM: .history-link inside .history-item-container
      '.history-item-container a.history-link',
      'a.history-link[href*="/chat/"]',
      'a.history-link[href*="/c/"]',
      // Sidebar (chat page & history page sidebar)
      '.history-part a.chat-info-item',
      'a.chat-info-item[href*="/chat/"]',
      'a.chat-info-item[href*="/c/"]',
      // Legacy / generic fallbacks
      '.chat-history-item a[href*="/chat/"]',
      '.history-list a[href*="/chat/"]',
      '.history-page a[href*="/chat/"]',
      '.chat-list a[href*="/chat/"]',
      '[data-testid="conversation-item"]',
      '.conversation-item',
      // Broad fallback
      'a[href*="/chat/"]',
      'a[href*="/c/"]',
    ];

    const seen = new Set<Element>();
    const items: Element[] = [];
    for (const sel of selectors) {
      try {
        document.querySelectorAll(sel).forEach((el) => {
          if (!seen.has(el)) {
            seen.add(el);
            items.push(el);
          }
        });
      } catch {
        // Ignore invalid selectors
      }
    }

    if (items.length === 0) return;

    for (const item of items) {
      const link =
        item.tagName === 'A'
          ? (item as HTMLAnchorElement)
          : item.querySelector('a[href*="/chat/"]') || item.querySelector('a[href*="/c/"]');
      if (!link || link.hasAttribute(INJECTED_ATTR)) continue;

      const conv = parseConversationItem(item);
      if (conv) {
        await injectStarButton(conv, favorites);
      }
    }
  };

  // Debounced version for observer callbacks
  const debouncedScan = debounce(scanAndInject, 400);

  // Initial scan (delayed to allow SPA async rendering)
  setTimeout(() => scanAndInject(), 800);

  // Some pages (e.g. /chat/history) load content lazily; re-scan a few times
  const retryTimers = [1500, 3000, 6000].map((ms) => setTimeout(() => scanAndInject(), ms));

  // Watch for new items - use debounce to ensure DOM settles
  const unsubscribe = observer.subscribe(() => {
    debouncedScan();
  });

  return () => {
    unsubscribe();
    retryTimers.forEach(clearTimeout);
    // Clean up injected buttons
    document.querySelectorAll(`.${STAR_BTN_CLASS}`).forEach((btn) => btn.remove());
    document
      .querySelectorAll(`[${INJECTED_ATTR}]`)
      .forEach((el) => el.removeAttribute(INJECTED_ATTR));
  };
}

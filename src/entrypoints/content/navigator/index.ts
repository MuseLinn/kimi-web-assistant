import { throttle } from '@/shared/utils';
import type { DomObserver } from '../observer';

const NAV_ID = 'kwa-navigator';
const SEGMENT_CLASS = 'kwa-nav-segment';

interface TurnInfo {
  element: Element;
  role: 'user' | 'assistant';
  previewText: string;
}

function detectTurns(): TurnInfo[] {
  // Kimi actual DOM: .chat-content-item-user and .chat-content-item-assistant
  // These are the outermost message containers. We avoid .segment-* because
  // they might match nested children and create duplicates.
  let userElements = Array.from(document.querySelectorAll('.chat-content-item-user'));
  let assistantElements = Array.from(document.querySelectorAll('.chat-content-item-assistant'));

  // If the primary selectors don't find anything, fall back to .segment-*
  if (userElements.length === 0 && assistantElements.length === 0) {
    userElements = Array.from(document.querySelectorAll('.segment-user'));
    assistantElements = Array.from(document.querySelectorAll('.segment-assistant'));
  }

  // Combine all message elements and sort by DOM position
  const allElements: Array<{ el: Element; role: 'user' | 'assistant' }> = [
    ...userElements.map((el) => ({ el, role: 'user' as const })),
    ...assistantElements.map((el) => ({ el, role: 'assistant' as const })),
  ];

  // Sort by document position
  allElements.sort((a, b) => {
    const cmp = a.el.compareDocumentPosition(b.el);
    return cmp & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });

  // Remove nested duplicates: if element A contains element B, keep only A (the outermost)
  const filtered: typeof allElements = [];
  for (const item of allElements) {
    const hasParent = allElements.some(
      (other) => other.el !== item.el && other.el.contains(item.el)
    );
    if (!hasParent) {
      filtered.push(item);
    }
  }

  return filtered
    .map(({ el, role }) => {
      // Try to find preview text from message content
      let previewText = '';
      const textSelectors = [
        '.user-content',
        '.segment-content-box .markdown',
        '.segment-content',
        'p',
        '.text',
      ];

      for (const sel of textSelectors) {
        const textEl = el.querySelector(sel);
        if (textEl) {
          previewText = textEl.textContent?.trim().slice(0, 80) || '';
          if (previewText) break;
        }
      }

      // Fallback to element's own text
      if (!previewText) {
        previewText = el.textContent?.trim().slice(0, 80) || '';
      }

      return { element: el, role, previewText };
    })
    .filter((t) => t.previewText.length > 0 || t.element.scrollHeight > 40);
}

function renderNavigator(turns: TurnInfo[]) {
  const existing = document.getElementById(NAV_ID);
  if (existing) existing.remove();

  if (turns.length === 0) return;

  const container = document.createElement('div');
  container.id = NAV_ID;

  // Collapse toggle
  let collapsed = false;
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'kwa-nav-toggle';
  toggleBtn.setAttribute('aria-label', '收起/展开');
  toggleBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  toggleBtn.addEventListener('click', () => {
    collapsed = !collapsed;
    container.classList.toggle('collapsed', collapsed);
    toggleBtn.innerHTML = collapsed
      ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`
      : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
  });
  container.appendChild(toggleBtn);

  const track = document.createElement('div');
  track.className = 'kwa-nav-track';

  turns.forEach((turn, idx) => {
    const seg = document.createElement('div');
    seg.className = `${SEGMENT_CLASS} ${turn.role}`;
    seg.title = `${turn.role === 'user' ? '用户' : 'Kimi'}: ${turn.previewText}`;
    // Use a smaller, consistent height per segment
    seg.style.height = Math.max(8, Math.min(32, turn.element.scrollHeight / 30)) + 'px';

    seg.addEventListener('click', () => {
      turn.element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      highlightActiveSegment(idx);
    });

    track.appendChild(seg);
  });

  container.appendChild(track);
  document.body.appendChild(container);

  return container;
}

function highlightActiveSegment(activeIndex: number) {
  const segs = document.querySelectorAll(`.${SEGMENT_CLASS}`);
  segs.forEach((s, i) => {
    s.classList.toggle('active', i === activeIndex);
  });
}

function updateActiveSegmentOnScroll(turns: TurnInfo[]) {
  const handler = throttle(() => {
    const viewportCenter = window.innerHeight / 2;
    let bestIndex = 0;
    let bestDistance = Infinity;

    turns.forEach((turn, idx) => {
      const rect = turn.element.getBoundingClientRect();
      const center = rect.top + rect.height / 2;
      const dist = Math.abs(center - viewportCenter);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestIndex = idx;
      }
    });

    highlightActiveSegment(bestIndex);
  }, 150);

  window.addEventListener('scroll', handler, { passive: true });
  handler();
  return () => window.removeEventListener('scroll', handler);
}

export function initNavigator(observer: DomObserver) {
  console.log('[KWA] Initializing navigator');

  let cleanupScroll: (() => void) | null = null;

  const scanAndRender = throttle(() => {
    const turns = detectTurns();
    if (turns.length > 0) {
      renderNavigator(turns);
      if (cleanupScroll) cleanupScroll();
      cleanupScroll = updateActiveSegmentOnScroll(turns);
    }
  }, 300);

  scanAndRender();
  const unsubscribe = observer.subscribe(() => scanAndRender());

  return () => {
    unsubscribe();
    document.getElementById(NAV_ID)?.remove();
    if (cleanupScroll) cleanupScroll();
  };
}

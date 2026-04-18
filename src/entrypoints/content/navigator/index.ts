import { throttle } from '@/shared/utils';
import type { DomObserver } from '../observer';

const NAV_ID = 'kwa-navigator';
const SEGMENT_CLASS = 'kwa-nav-segment';
const DEBUG = true;

interface TurnInfo {
  element: Element;
  role: 'user' | 'assistant';
  previewText: string;
  index: number;
}

/** Cached position info for a turn */
interface PositionCache {
  scrollTop: number;
  offsetTop: number;
  height: number;
  timestamp: number;
}

const positionMap = new Map<number, PositionCache>();

function log(...args: unknown[]) {
  if (DEBUG) console.log('[KWA:Nav]', ...args);
}

/** Find the scrollable chat container by checking overflow and scrollable metrics */
function findScrollContainer(): Element | null {
  // First: try known selectors
  const selectors = [
    '[data-testid="virtuoso-scroller"]',
    '[data-testid="virtuoso-item-list"]',
    '.chat-detail-content',
    '.chat-content',
    '.message-list',
    'main',
  ];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const style = window.getComputedStyle(el);
      const isScrollable =
        style.overflow === 'auto' ||
        style.overflow === 'scroll' ||
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll';
      if (isScrollable && el.scrollHeight > el.clientHeight) {
        log('Found scroll container by selector:', sel, el.tagName, el.className);
        return el;
      }
    }
  }

  // Second: walk up from first message element to find scrollable ancestor
  const firstMsg = document.querySelector(
    '.chat-content-item-user, .chat-content-item-assistant, .segment-user, .segment-assistant'
  );
  if (firstMsg) {
    let el: Element | null = firstMsg;
    while (el) {
      const style = window.getComputedStyle(el);
      const isScrollable =
        style.overflow === 'auto' ||
        style.overflow === 'scroll' ||
        style.overflowY === 'auto' ||
        style.overflowY === 'scroll';
      if (isScrollable && el.scrollHeight > el.clientHeight) {
        log('Found scroll container by ancestor walk:', el.tagName, el.className);
        return el;
      }
      el = el.parentElement;
    }
  }

  // Third: find any element with large scrollHeight and overflow
  const allElements = document.querySelectorAll('div, main, section, article');
  for (const el of allElements) {
    const style = window.getComputedStyle(el);
    const isScrollable =
      style.overflow === 'auto' ||
      style.overflow === 'scroll' ||
      style.overflowY === 'auto' ||
      style.overflowY === 'scroll';
    if (isScrollable && el.scrollHeight > el.clientHeight + 200) {
      log(
        'Found scroll container by scan:',
        el.tagName,
        el.className,
        'scrollHeight=',
        el.scrollHeight
      );
      return el;
    }
  }

  log('No scroll container found, falling back to window');
  return null;
}

function detectTurns(): TurnInfo[] {
  let userElements = Array.from(document.querySelectorAll('.chat-content-item-user'));
  let assistantElements = Array.from(document.querySelectorAll('.chat-content-item-assistant'));

  if (userElements.length === 0 && assistantElements.length === 0) {
    userElements = Array.from(document.querySelectorAll('.segment-user'));
    assistantElements = Array.from(document.querySelectorAll('.segment-assistant'));
  }

  const allElements: Array<{ el: Element; role: 'user' | 'assistant' }> = [
    ...userElements.map((el) => ({ el, role: 'user' as const })),
    ...assistantElements.map((el) => ({ el, role: 'assistant' as const })),
  ];

  allElements.sort((a, b) => {
    const cmp = a.el.compareDocumentPosition(b.el);
    return cmp & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
  });

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
    .map(({ el, role }, index) => {
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

      if (!previewText) {
        previewText = el.textContent?.trim().slice(0, 80) || '';
      }

      return { element: el, role, previewText, index };
    })
    .filter((t) => t.previewText.length > 0 || t.element.scrollHeight > 40);
}

function renderNavigator(turns: TurnInfo[]) {
  const existing = document.getElementById(NAV_ID);
  if (existing) existing.remove();

  if (turns.length === 0) return;

  const container = document.createElement('div');
  container.id = NAV_ID;

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

  // Estimate average turn height for virtual-scroll position guessing
  const avgHeight = turns.reduce((sum, t) => sum + t.element.scrollHeight, 0) / turns.length || 80;

  turns.forEach((turn, idx) => {
    const seg = document.createElement('div');
    seg.className = `${SEGMENT_CLASS} ${turn.role}`;
    seg.title = `${turn.role === 'user' ? '用户' : 'Kimi'}: ${turn.previewText}`;
    seg.style.height = Math.max(8, Math.min(32, turn.element.scrollHeight / 30)) + 'px';

    seg.addEventListener('click', () => {
      scrollToTurn(idx, turn.role, avgHeight);
      highlightActiveSegment(idx);
    });

    track.appendChild(seg);
  });

  container.appendChild(track);
  document.body.appendChild(container);

  return container;
}

/** Try to find a turn element by index and role */
function findTurnElement(idx: number, role: 'user' | 'assistant'): Element | null {
  const selector =
    role === 'user'
      ? '.chat-content-item-user, .segment-user'
      : '.chat-content-item-assistant, .segment-assistant';
  const elements = Array.from(document.querySelectorAll(selector));
  return elements[idx] || null;
}

/** Get the effective scrollTop of a target element within a scroll container */
function getElementScrollTop(el: Element, scroller: Element | null): number {
  if (!scroller || scroller === document.documentElement || scroller === document.body) {
    const rect = el.getBoundingClientRect();
    return window.scrollY + rect.top;
  }
  // Use getBoundingClientRect for accurate relative position (handles transforms, positioned ancestors)
  const scrollerRect = scroller.getBoundingClientRect();
  const elRect = el.getBoundingClientRect();
  return scroller.scrollTop + (elRect.top - scrollerRect.top);
}

/** Robust scroll to a turn that may be unmounted by virtual scroll */
function scrollToTurn(idx: number, role: 'user' | 'assistant', avgHeight: number) {
  const scroller = findScrollContainer();
  const isWindowScroller = !scroller;
  log('scrollToTurn:', idx, role, 'scroller=', scroller?.tagName || 'window');

  // 1. Try direct element lookup first
  const target = findTurnElement(idx, role);
  if (target) {
    const targetScrollTop = getElementScrollTop(target, scroller);
    log('Found element directly, scrollTop=', targetScrollTop);
    positionMap.set(idx, {
      scrollTop: targetScrollTop,
      offsetTop: targetScrollTop,
      height: target.scrollHeight,
      timestamp: Date.now(),
    });

    if (isWindowScroller) {
      window.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    } else {
      scroller.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
    }
    return;
  }

  // 2. Use cached position if available
  const cached = positionMap.get(idx);
  if (cached) {
    log('Using cached position:', cached.scrollTop);
    if (isWindowScroller) {
      window.scrollTo({ top: cached.scrollTop, behavior: 'smooth' });
    } else {
      scroller.scrollTo({ top: cached.scrollTop, behavior: 'smooth' });
    }

    // After scrolling, try to find element again with polling
    pollForElement(idx, role, scroller, cached.scrollTop);
    return;
  }

  // 3. Find nearest cached positions for interpolation
  let lower: PositionCache | null = null;
  let upper: PositionCache | null = null;
  let lowerIdx = -1;
  let upperIdx = -1;

  for (const [i, pos] of positionMap) {
    if (i < idx && (!lower || pos.scrollTop > lower.scrollTop)) {
      lower = pos;
      lowerIdx = i;
    }
    if (i > idx && (!upper || pos.scrollTop < upper.scrollTop)) {
      upper = pos;
      upperIdx = i;
    }
  }

  let estimatedTop: number;
  if (lower && upper) {
    // Linear interpolation between known positions
    const ratio = (idx - lowerIdx) / (upperIdx - lowerIdx);
    estimatedTop = lower.scrollTop + ratio * (upper.scrollTop - lower.scrollTop);
    log('Interpolated position between', lowerIdx, 'and', upperIdx, ':', estimatedTop);
  } else if (lower) {
    estimatedTop = lower.scrollTop + (idx - lowerIdx) * avgHeight;
    log('Extrapolated from', lowerIdx, ':', estimatedTop);
  } else if (upper) {
    estimatedTop = Math.max(0, upper.scrollTop - (upperIdx - idx) * avgHeight);
    log('Extrapolated from', upperIdx, ':', estimatedTop);
  } else {
    estimatedTop = idx * avgHeight;
    log('Using naive estimate:', estimatedTop);
  }

  // 4. Scroll to estimated position
  if (isWindowScroller) {
    window.scrollTo({ top: estimatedTop, behavior: 'smooth' });
  } else {
    scroller.scrollTo({ top: estimatedTop, behavior: 'smooth' });
  }

  // 5. Poll for element appearance after scroll
  pollForElement(idx, role, scroller, estimatedTop);
}

/** Poll for element to appear after scrolling, with progressive retries */
function pollForElement(
  idx: number,
  role: 'user' | 'assistant',
  scroller: Element | null,
  expectedScrollTop: number,
  attempts = 0
) {
  const maxAttempts = 15; // Increased attempts for better reliability
  const interval = 100; // Shorter interval for faster response

  if (attempts >= maxAttempts) {
    log('Poll timeout for element', idx);
    return;
  }

  setTimeout(() => {
    const target = findTurnElement(idx, role);
    if (target) {
      const targetScrollTop = getElementScrollTop(target, scroller);
      log('Element appeared after poll, scrollTop=', targetScrollTop);
      positionMap.set(idx, {
        scrollTop: targetScrollTop,
        offsetTop: targetScrollTop,
        height: target.scrollHeight,
        timestamp: Date.now(),
      });

      // Fine-tune scroll if needed
      const currentScroll = scroller ? scroller.scrollTop : window.scrollY;
      const diff = Math.abs(currentScroll - targetScrollTop);
      if (diff > 10) {
        log('Fine-tuning scroll, diff=', diff);
        if (!scroller) {
          window.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        } else {
          scroller.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
        }
      }
      return;
    }

    // Element still not found, continue polling
    pollForElement(idx, role, scroller, expectedScrollTop, attempts + 1);
  }, interval);
}

function highlightActiveSegment(activeIndex: number) {
  const segs = document.querySelectorAll(`.${SEGMENT_CLASS}`);
  segs.forEach((s, i) => {
    s.classList.toggle('active', i === activeIndex);
  });
}

function updateActiveSegmentOnScroll(turns: TurnInfo[]) {
  const scroller = findScrollContainer();

  const handler = throttle(() => {
    const viewportCenter = window.innerHeight / 2;
    let bestIndex = 0;
    let bestDistance = Infinity;

    turns.forEach((turn, idx) => {
      const target = findTurnElement(idx, turn.role);

      if (target) {
        const rect = target.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const dist = Math.abs(center - viewportCenter);
        if (dist < bestDistance) {
          bestDistance = dist;
          bestIndex = idx;
        }

        // Cache position for visible elements
        const scrollTop = getElementScrollTop(target, scroller);
        if (
          !positionMap.has(idx) ||
          Math.abs((positionMap.get(idx)?.scrollTop || 0) - scrollTop) > 100
        ) {
          positionMap.set(idx, {
            scrollTop,
            offsetTop: scrollTop,
            height: target.scrollHeight,
            timestamp: Date.now(),
          });
        }
      }
    });

    highlightActiveSegment(bestIndex);
  }, 150);

  // Listen on window for both window-scrolled and container-scrolled cases
  window.addEventListener('scroll', handler, { passive: true });
  if (scroller && scroller !== document.documentElement && scroller !== document.body) {
    scroller.addEventListener('scroll', handler, { passive: true });
  }

  handler();
  return () => {
    window.removeEventListener('scroll', handler);
    if (scroller && scroller !== document.documentElement && scroller !== document.body) {
      scroller.removeEventListener('scroll', handler);
    }
  };
}

export function initNavigator(observer: DomObserver) {
  console.log('[KWA] Initializing navigator');

  let cleanupScroll: (() => void) | null = null;
  let lastTurnCount = 0;

  const scanAndRender = throttle(() => {
    const turns = detectTurns();
    if (turns.length > 0) {
      // Clear position cache if turn count changed significantly (new conversation or messages added)
      if (Math.abs(turns.length - lastTurnCount) > 2) {
        log(
          'Turn count changed from',
          lastTurnCount,
          'to',
          turns.length,
          '- clearing position cache'
        );
        positionMap.clear();
      }
      lastTurnCount = turns.length;

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
    positionMap.clear();
  };
}

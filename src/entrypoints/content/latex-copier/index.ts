import { throttle } from '@/shared/utils';
import type { DomObserver } from '../observer';
import { extractLatex, injectMathJaxApiScript, listenMathJaxV3 } from './extractor';

const INJECTED_ATTR = 'data-kwa-latex-injected';
const BTN_CLASS = 'kwa-latex-btn';

function createCopyButton(): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.className = BTN_CLASS;
  btn.setAttribute('aria-label', '复制 LaTeX');
  btn.innerHTML = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
  `;
  return btn;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for content script
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    textarea.remove();
  }
}

function showToast(message: string) {
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.className = 'kwa-toast';
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 200);
  }, 1500);
}

export function initLatexCopier(observer: DomObserver) {
  console.log('[KWA] Initializing latex-copier');

  injectMathJaxApiScript();

  // Cache for MathJax v3 results
  const mjxCache = new Map<string, string>();
  listenMathJaxV3((latex) => {
    const mjx = document.activeElement?.closest('mjx-container') as HTMLElement | null;
    if (mjx) {
      mjx.setAttribute('data-kwa-latex', latex);
      mjxCache.set(mjx.innerHTML, latex);
    }
  });

  const scanAndInject = throttle(() => {
    // Selectors for math blocks (KaTeX, MathJax, data-math)
    const mathSelectors = [
      '.katex',
      'mjx-container',
      '.MathJax',
      '.mjx-chtml',
      '[data-math]',
      'math',
    ];

    // Selectors for Kimi native HTML math (sub/sup tags)
    const htmlMathSelectors = [
      '.markdown sub',
      '.markdown sup',
      '.segment-content sub',
      '.segment-content sup',
      '.user-content sub',
      '.user-content sup',
    ];

    const elements = new Set<Element>();

    // Add standard math elements
    for (const sel of mathSelectors) {
      document.querySelectorAll(sel).forEach((el) => elements.add(el));
    }

    // Add Kimi HTML math elements (parent paragraph/block)
    for (const sel of htmlMathSelectors) {
      document.querySelectorAll(sel).forEach((el) => {
        // Use the parent block as the container for the button
        const parent = el.closest('p, div, .markdown, .segment-content, .user-content');
        if (parent) elements.add(parent);
      });
    }

    for (const el of elements) {
      if (el.hasAttribute(INJECTED_ATTR)) continue;
      el.setAttribute(INJECTED_ATTR, 'true');

      // Skip inline KaTeX elements that are too small or deeply nested
      if (el.classList.contains('katex') && el.closest('.katex')) continue;

      // Make sure the element can be a positioning context
      const computed = window.getComputedStyle(el as HTMLElement);
      if (computed.position === 'static') {
        (el as HTMLElement).style.position = 'relative';
      }

      const btn = createCopyButton();
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();

        const result = extractLatex(el);
        if (result) {
          await copyToClipboard(result.latex);
          btn.classList.add('copied');
          btn.innerHTML = `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          `;
          showToast('LaTeX 已复制');
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            `;
          }, 2000);
        } else {
          showToast('无法提取 LaTeX');
        }
      });

      el.appendChild(btn);
    }
  }, 300);

  scanAndInject();
  const unsubscribe = observer.subscribe(() => scanAndInject());

  return () => {
    unsubscribe();
    document.querySelectorAll(`.${BTN_CLASS}`).forEach((b) => b.remove());
    document
      .querySelectorAll(`[${INJECTED_ATTR}]`)
      .forEach((el) => el.removeAttribute(INJECTED_ATTR));
  };
}

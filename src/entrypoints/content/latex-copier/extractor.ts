// LaTeX extraction strategies

export interface MathResult {
  source: 'katex' | 'mathjax-v2' | 'mathjax-v3' | 'data-math' | 'html-math' | 'unknown';
  latex: string;
}

export function extractLatex(target: Element): MathResult | null {
  // 1. KaTeX
  const katex = target.closest('.katex');
  if (katex) {
    const ann = katex.querySelector('.katex-mathml annotation[encoding="application/x-tex"]');
    if (ann) return { source: 'katex', latex: ann.textContent!.trim() };

    const dataLatex = katex.getAttribute('data-latex') || katex.getAttribute('data-tex');
    if (dataLatex) return { source: 'katex', latex: dataLatex.trim() };
  }

  // 2. data-math (Gemini style, possibly Kimi)
  const dataMath = target.closest('[data-math]');
  if (dataMath) {
    const latex = dataMath.getAttribute('data-math');
    if (latex) return { source: 'data-math', latex: latex.trim() };
  }

  // 3. MathJax v2
  const mathjax = target.closest('.MathJax, .mjx-chtml');
  if (mathjax) {
    let sib = mathjax.nextElementSibling;
    while (sib) {
      if (sib.tagName === 'SCRIPT') {
        const type = sib.getAttribute('type');
        if (type?.startsWith('math/tex')) {
          return { source: 'mathjax-v2', latex: sib.textContent!.trim() };
        }
      }
      sib = sib.nextElementSibling;
    }
  }

  // 4. MathJax v3/v4 (requires page script injection)
  const mjx = target.closest('mjx-container');
  if (mjx) {
    const latex = mjx.getAttribute('data-kwa-latex');
    if (latex) return { source: 'mathjax-v3', latex: latex.trim() };
  }

  // 5. Kimi native HTML math (sub/sup tags in markdown)
  // Try to reconstruct LaTeX from HTML sub/sup elements
  const htmlMath = target.closest(
    '.markdown sub, .markdown sup, .segment-content sub, .segment-content sup'
  );
  if (htmlMath) {
    // Find the parent math expression
    const parentBlock = htmlMath.closest(
      '.markdown p, .segment-content p, .markdown div, .segment-content div'
    );
    if (parentBlock) {
      // Try to reconstruct from the text content with sub/sup
      const text = parentBlock.textContent?.trim() || '';
      if (text) {
        return { source: 'html-math', latex: reconstructLatexFromHtml(parentBlock) };
      }
    }
  }

  return null;
}

/**
 * Reconstruct a plausible LaTeX representation from HTML with sub/sup tags.
 * This is a best-effort reconstruction for Kimi's native math rendering.
 */
function reconstructLatexFromHtml(el: Element): string {
  let result = '';
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      result += node.textContent || '';
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as Element).tagName.toLowerCase();
      if (tag === 'sub') {
        result += '_{';
        node.childNodes.forEach(walk);
        result += '}';
      } else if (tag === 'sup') {
        result += '^{';
        node.childNodes.forEach(walk);
        result += '}';
      } else {
        node.childNodes.forEach(walk);
      }
    }
  };
  walk(el);
  return result.trim();
}

export function injectMathJaxApiScript(): void {
  if (document.getElementById('kwa-mathjax-script')) return;
  const script = document.createElement('script');
  script.id = 'kwa-mathjax-script';
  script.src = chrome.runtime.getURL('mathjax-api.js');
  document.documentElement.appendChild(script);
}

export function listenMathJaxV3(callback: (latex: string) => void): () => void {
  const handler = (e: MessageEvent) => {
    if (e.source !== window) return;
    if (e.data?.type === 'KWA_MathJaxV3' && e.data.latex) {
      callback(e.data.latex as string);
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

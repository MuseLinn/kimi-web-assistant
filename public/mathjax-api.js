/**
 * Kimi Web Assistant — MathJax v3/v4 Page Script
 * Injected into the page context to access MathJax's internal API.
 */
(function () {
  if (typeof window.MathJax === 'undefined') return;

  const version = window.MathJax.version;
  if (!version || (!version.startsWith('3') && !version.startsWith('4'))) return;

  function getLatexForContainer(mjxContainer) {
    if (
      typeof window.MathJax !== 'undefined' &&
      window.MathJax.startup &&
      window.MathJax.startup.document &&
      window.MathJax.startup.document.math
    ) {
      let current = window.MathJax.startup.document.math.list;
      const targetHTML = mjxContainer.innerHTML;
      while (current && current.data) {
        const mathItem = current.data;
        if (mathItem.typesetRoot && mathItem.typesetRoot.innerHTML === targetHTML) {
          if (mathItem.math && typeof mathItem.math === 'string') {
            return mathItem.math.trim();
          }
        }
        current = current.next;
        if (current === window.MathJax.startup.document.math.list) break;
      }
    }
    return null;
  }

  document.addEventListener(
    'mouseover',
    function (e) {
      const mjx = e.target.closest('mjx-container');
      if (!mjx) return;
      const latex = getLatexForContainer(mjx);
      if (latex) {
        window.postMessage(
          {
            type: 'KWA_MathJaxV3',
            latex,
          },
          '*'
        );
      }
    },
    true
  );
})();

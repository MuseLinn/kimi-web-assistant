// Kimi Web Assistant — Shared Utilities

export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay = 200
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return function (...args: Parameters<T>) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  interval = 100
): (...args: Parameters<T>) => void {
  let last = 0;
  return function (...args: Parameters<T>) {
    const now = Date.now();
    if (now - last >= interval) {
      last = now;
      fn(...args);
    }
  };
}

export function waitForElement(selectors: string | string[], timeout = 15000): Promise<Element> {
  return new Promise((resolve, reject) => {
    const selectorsArray = Array.isArray(selectors) ? selectors : [selectors];

    for (const sel of selectorsArray) {
      const el = document.querySelector(sel);
      if (el) return resolve(el);
    }

    const observer = new MutationObserver(() => {
      for (const sel of selectorsArray) {
        const el = document.querySelector(sel);
        if (el) {
          observer.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      }
    });

    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for: ${selectorsArray.join(', ')}`));
    }, timeout);

    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

export function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

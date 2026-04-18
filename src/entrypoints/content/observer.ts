import { throttle } from '@/shared/utils';

export class DomObserver {
  private observer: MutationObserver;
  private subscribers = new Set<(mutations: MutationRecord[]) => void>();

  constructor() {
    this.observer = new MutationObserver((mutations) => {
      this.subscribers.forEach((cb) => cb(mutations));
    });
  }

  subscribe(
    callback: (mutations: MutationRecord[]) => void,
    { throttleMs = 100 }: { throttleMs?: number } = {}
  ) {
    const handler = throttleMs ? throttle(callback, throttleMs) : callback;
    this.subscribers.add(handler);
    return () => this.subscribers.delete(handler);
  }

  start(target: Node = document.body) {
    this.observer.observe(target, { childList: true, subtree: true });
  }

  stop() {
    this.observer.disconnect();
  }
}

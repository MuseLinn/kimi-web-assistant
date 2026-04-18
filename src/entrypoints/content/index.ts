import { defineContentScript } from 'wxt/utils/define-content-script';
import { waitForElement } from '@/shared/utils';
import { KIMI_SELECTORS } from '@/shared/selectors';
import { Storage } from '@/shared/storage';
import type { Settings } from '@/shared/messages';
import { DEFAULT_SETTINGS } from '@/shared/messages';
import { DomObserver } from './observer';
import { initCollectionInject } from './collection-inject';
import { initLatexCopier } from './latex-copier';
import { initNavigator } from './navigator';

// Import feature styles
import './collection-inject/styles.css';
import './latex-copier/styles.css';
import './navigator/styles.css';

export default defineContentScript({
  matches: ['https://kimi.moonshot.cn/*', 'https://www.kimi.com/*', 'https://kimi.com/*'],
  runAt: 'document_end',

  async main() {
    console.log('[KWA] Content script loaded');

    try {
      await waitForElement([...KIMI_SELECTORS.appRoot]);
    } catch {
      console.warn('[KWA] App root not found, initializing anyway');
    }

    const settings =
      (await Storage.get<Settings>('settings', DEFAULT_SETTINGS)) ?? DEFAULT_SETTINGS;

    const root =
      document.querySelector('.chat-detail-content') ||
      document.querySelector('.chat-content') ||
      document.querySelector('.message-list') ||
      document.querySelector('[data-testid="virtuoso-item-list"]') ||
      document.body;

    const observer = new DomObserver();
    observer.start(root);

    // Initialize features based on settings
    const cleanupFns: Array<() => void> = [];

    if (settings.collectionInject) {
      try {
        const cleanup = await initCollectionInject(observer);
        if (cleanup) cleanupFns.push(cleanup);
      } catch (e) {
        console.error('[KWA] Failed to initialize collection-inject:', e);
      }
    }

    if (settings.latexCopier) {
      try {
        const cleanup = initLatexCopier(observer);
        if (cleanup) cleanupFns.push(cleanup);
      } catch (e) {
        console.error('[KWA] Failed to initialize latex-copier:', e);
      }
    }

    if (settings.navigator) {
      try {
        const cleanup = initNavigator(observer);
        if (cleanup) cleanupFns.push(cleanup);
      } catch (e) {
        console.error('[KWA] Failed to initialize navigator:', e);
      }
    }

    console.log('[KWA] Initialized with settings:', settings);

    // Return cleanup function
    return () => {
      cleanupFns.forEach((fn) => fn());
      observer.stop();
    };
  },
});

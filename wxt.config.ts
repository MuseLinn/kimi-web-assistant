import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  manifest: {
    name: 'Kimi Web Assistant',
    version: '0.1.0',
    description:
      'Enhance Kimi web with conversation navigator, LaTeX copier, and collection manager.',
    permissions: ['storage', 'activeTab', 'clipboardWrite', 'scripting', 'unlimitedStorage'],
    host_permissions: [
      'https://kimi.moonshot.cn/*',
      'https://www.kimi.com/*',
      'https://kimi.com/*',
    ],
    action: {
      default_popup: 'popup.html',
    },
    options_page: 'options.html',
    icons: {
      16: 'icons/icon16.png',
      48: 'icons/icon48.png',
      128: 'icons/icon128.png',
    },
    web_accessible_resources: [
      {
        resources: ['mathjax-api.js'],
        matches: ['https://kimi.moonshot.cn/*', 'https://www.kimi.com/*', 'https://kimi.com/*'],
      },
    ],
  },
});

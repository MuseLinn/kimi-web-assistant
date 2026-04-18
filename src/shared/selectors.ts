// Kimi Web Assistant — DOM Selectors for Kimi Web
// Based on live DOM inspection of kimi.moonshot.cn / www.kimi.com
// NOTE: These selectors may change as Kimi updates its frontend.

export const KIMI_SELECTORS = {
  // App root (Vue scoped)
  appRoot: ['.app', '.n-config-provider', '#app'],

  // Sidebar conversation list items
  sidebar: ['aside.sidebar', '.sidebar', '[role="complementary"]'],
  sidebarHistoryPart: ['.history-part'],
  sidebarConversationItems: [
    '.history-part a.chat-info-item',
    'a.chat-info-item',
    '.history-item',
    '[data-testid="conversation-item"]',
  ],

  // Main chat container
  mainContent: ['.chat-detail-main', '.chat-page', '.main'],
  chatBox: ['.chat-box'],
  chatContainer: ['#chat-container', '.chat-container', '.chat-page', 'main'],

  // Message list / turns
  // Kimi uses custom class names, not standard .message-list
  messageList: ['.chat-detail-content', '.chat-content', '.message-list'],
  messageItems: ['.chat-content-item', '.chat-content-item-user', '.chat-content-item-assistant'],

  // User / Assistant message containers
  userMessage: ['.chat-content-item-user', '.segment-user'],
  assistantMessage: ['.chat-content-item-assistant', '.segment-assistant'],

  // Input / composer
  composer: [
    '.chat-input-editor[role="textbox"]',
    '[data-lexical-editor="true"]',
    '.chat-editor [contenteditable="true"]',
    'textarea',
  ],

  // Math / LaTeX blocks
  // Kimi renders math with custom HTML (sub/sup tags) rather than KaTeX/MathJax always
  mathBlocks: [
    'math',
    '.katex',
    '.katex-display',
    '.mjx-container',
    '.MathJax',
    '[class*="math"]',
    '[class*="latex"]',
  ],
  // Inline math may use sub/sup tags in markdown content
  mathInline: ['.markdown sub', '.markdown sup', '.segment-content sub', '.segment-content sup'],

  // Math inline source (if available in data attribute)
  mathSourceAttr: 'data-latex',
  mathDataMath: 'data-math',
} as const;

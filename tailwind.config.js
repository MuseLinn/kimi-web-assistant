/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ['./src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        kwa: {
          primary: '#16a34a',
          'primary-soft': '#bbf7d0',
          'primary-dark': '#22c55e',
          forest: '#0d4a1c',
          sand: '#f5f5dc',
          'sand-deep': '#e8d5b5',
          bark: '#5d4037',
          clay: '#E29578',
          'clay-dark': '#8E443D',
          teal: '#006D77',
          ice: '#EDF6F9',
          charcoal: '#1c2326',
          gray: {
            50: '#f9fafb',
            100: '#f3f4f6',
            200: '#e5e7eb',
            300: '#d1d5db',
            400: '#9ca3af',
            500: '#6b7280',
            600: '#4b5563',
            700: '#374151',
            800: '#1f2937',
            900: '#111827',
          },
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          '"Helvetica Neue"',
          'Arial',
          '"Noto Sans SC"',
          'sans-serif',
        ],
        mono: ['"SF Mono"', 'Menlo', 'Monaco', '"Cascadia Mono"', 'Consolas', 'monospace'],
      },
      animation: {
        'fade-slide-in': 'fadeSlideIn 200ms ease-out both',
      },
      keyframes: {
        fadeSlideIn: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

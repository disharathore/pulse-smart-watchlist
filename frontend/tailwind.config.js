/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#09090b',
        surface: '#121214',       // slightly lighter than bg — cards "sit above"
        'surface-2': '#1a1a1e',
        'surface-raised': '#16161a',  // for hover/elevated states
        border: '#1e1e22',
        'border-hover': '#2e2e34',
        accent: '#4f46e5',
        'accent-hover': '#4338ca',
        'accent-muted': 'rgba(79, 70, 229, 0.12)',
        good: '#22c55e',
        bad: '#ef4444',
        warn: '#f59e0b',
        text: '#ececef',
        muted: '#71717a',
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"SF Mono"', '"Cascadia Code"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'page-title':     ['22px', { lineHeight: '28px', fontWeight: '700' }],
        'section-header': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        'card-title':     ['15px', { lineHeight: '20px', fontWeight: '600' }],
        'body':           ['13px', { lineHeight: '20px', fontWeight: '400' }],
        'small':          ['12px', { lineHeight: '16px', fontWeight: '400' }],
      },
      borderRadius: {
        DEFAULT: '6px',
        lg: '8px',
        xl: '12px',
      },
      boxShadow: {
        'subtle': '0 1px 2px rgba(0, 0, 0, 0.15)',
        'card':   '0 1px 3px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(255,255,255,0.03) inset',
        'card-hover': '0 4px 12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255,255,255,0.06) inset',
        'header': '0 1px 0 rgba(255,255,255,0.05), 0 4px 20px rgba(0,0,0,0.4)',
        'xs': '0 1px 2px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
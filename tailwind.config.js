/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        infra: {
          dark: '#1a1a2e',
          darker: '#16213e',
          accent: '#0f3460',
          /** Primary brand accent — orange (replaces red #e94560) */
          highlight: '#f97316',
          'highlight-hover': '#fb923c',
          'highlight-dim': '#ea580c',
        },
      },
      fontSize: {
        'workspace-sm': ['0.9375rem', { lineHeight: '1.4' }],
        'workspace-base': ['1rem', { lineHeight: '1.5' }],
        'workspace-lg': ['1.125rem', { lineHeight: '1.5' }],
      },
      spacing: {
        'panel-sidebar': '5rem',
        'panel-tree': '18rem',
        'panel-workspace': '30rem',
        'panel-inspector': '22rem',
      },
    },
  },
  plugins: [],
};

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
          highlight: '#e94560',
        },
      },
    },
  },
  plugins: [],
};

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@infraafrica/shared': path.resolve(__dirname, './packages/shared/src/index.ts'),
    },
  },
  base: './',
  server: {
    port: 5173,
  },
  optimizeDeps: {
    exclude: ['web-ifc'],
  },
  assetsInclude: ['**/*.wasm'],
  build: {
    outDir: 'dist',
  },
});

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
    dedupe: ['react', 'react-dom', 'three'],
  },
  base: './',
  server: {
    port: 5173,
    // OneDrive / cloud-sync folders fire rapid file watchers → HMR storms.
    watch: {
      awaitWriteFinish: {
        stabilityThreshold: 400,
        pollInterval: 100,
      },
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/.cursor/**',
        '**/agent-transcripts/**',
        '**/python/**',
        '**/*.db',
        '**/*.sqlite',
        '**/dist/**',
        '**/dist-electron/**',
      ],
    },
  },
  optimizeDeps: {
    exclude: ['web-ifc'],
    include: ['three'],
  },
  assetsInclude: ['**/*.wasm'],
  build: {
    outDir: 'dist',
  },
});

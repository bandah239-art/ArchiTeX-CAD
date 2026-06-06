import { defineConfig } from 'vitest/config';
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
    // Dedicated port so Electron never loads another Vite app on the default 5173.
    port: Number(process.env.VITE_DEV_PORT) || 5190,
    strictPort: true,
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
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    include: ['src/tests/**/*.test.ts', 'src/tests/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/tests/**', 'src/**/*.d.ts'],
    },
  },
});

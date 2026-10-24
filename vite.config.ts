import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: { outDir: 'dist/client', emptyOutDir: true },
  // In development, the page (5173) forwards /api to the quickstart server (8787).
  server: { proxy: { '/api': 'http://localhost:8787' } },
  test: { include: ['test/**/*.test.ts'] },
});

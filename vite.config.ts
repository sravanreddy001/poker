import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // GitHub Pages serves this project from /poker/, not from the domain root,
  // so every asset URL needs that prefix. Local dev stays at /.
  base: process.env.GITHUB_ACTIONS ? '/poker/' : '/',
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

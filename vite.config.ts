/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` makes every asset URL relative, so the built app works from
// any GitHub Pages subdirectory (https://<user>.github.io/<repo>/) without
// knowing the repository name. If this app ever gains a history-based router
// or is served from a custom domain root, switch to an explicit
// `base: '/<repo-name>/'` instead — see docs/decisions.md.
export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});

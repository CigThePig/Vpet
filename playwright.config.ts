import { defineConfig, devices } from '@playwright/test';

/**
 * Visual & interaction tests run against the Vite dev server in Chromium
 * (the pre-installed browser in agent environments).
 *
 * Baselines live in ux/baseline/ and are Linux-Chromium specific — regenerate
 * them with `npm run test:visual:update` and review the diff before
 * committing (see docs/visual-testing.md).
 */
export default defineConfig({
  testDir: 'tests/visual',
  outputDir: 'ux/diffs',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  snapshotPathTemplate: '{testDir}/../../ux/baseline/{arg}{ext}',
  expect: {
    toHaveScreenshot: {
      // Tight enough to catch layout shifts; loose enough to absorb minor
      // anti-aliasing variation. 0.002 of a 393×851 frame ≈ 670 pixels.
      maxDiffPixelRatio: 0.002,
      animations: 'disabled',
    },
  },
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    ...devices['Pixel 7'],
    viewport: { width: 393, height: 851 },
    deviceScaleFactor: 1,
  },
  webServer: {
    command: 'npm run dev -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
  },
});

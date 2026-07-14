#!/usr/bin/env node
/**
 * Capture screenshots of every deterministic visual scenario into ux/current/.
 *
 * Starts an in-process Vite dev server, drives the pre-installed Chromium via
 * Playwright, waits for the app's explicit ready signal, and saves one PNG per
 * scenario at deviceScaleFactor 2 (crisp enough for close visual inspection).
 * Also writes ux/current/manifest.json, which `npm run ux:report` uses to
 * build the labelled contact sheet.
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'ux', 'current');

const scenarios = JSON.parse(
  await readFile(path.join(root, 'tests', 'visual', 'scenarios.json'), 'utf8'),
);

const server = await createServer({
  root,
  server: { port: 0 },
  logLevel: 'error',
});
await server.listen();
const baseUrl = server.resolvedUrls.local[0];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch();
const manifest = [];
let failures = 0;

for (const scenario of scenarios) {
  const context = await browser.newContext({
    viewport: scenario.viewport,
    deviceScaleFactor: 2,
    isMobile: scenario.viewport.width < scenario.viewport.height,
    hasTouch: true,
    reducedMotion: scenario.reducedMotion ? 'reduce' : 'no-preference',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  try {
    await page.goto(new URL(scenario.query, baseUrl).href, { waitUntil: 'load' });
    await page.locator('html[data-app-ready="true"]').waitFor({ state: 'attached' });
    const file = `${scenario.name}.png`;
    await page.screenshot({ path: path.join(outDir, file), animations: 'disabled' });
    if (errors.length > 0) {
      failures += 1;
      console.error(`✗ ${scenario.name}: console errors\n  ${errors.join('\n  ')}`);
    } else {
      console.log(`✓ ${scenario.name}  (${scenario.viewport.width}×${scenario.viewport.height})`);
    }
    manifest.push({ ...scenario, file, capturedAt: new Date().toISOString() });
  } catch (error) {
    failures += 1;
    console.error(`✗ ${scenario.name}: ${error.message}`);
  } finally {
    await context.close();
  }
}

await writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
await browser.close();
await server.close();

console.log(`\n${manifest.length} screenshots in ux/current/ — next: npm run ux:report`);
if (failures > 0) {
  console.error(`${failures} scenario(s) failed`);
  process.exit(1);
}
